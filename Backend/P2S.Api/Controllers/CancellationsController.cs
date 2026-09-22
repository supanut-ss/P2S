using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

/// <summary>The cancellation report (PROJECT-PLAN.md screen 7) — cases where the shop
/// cancelled after the item was already paid for/reimbursed, waiting on finance action.</summary>
[ApiController]
[Route("api/cancellations")]
[Authorize]
public class CancellationsController : ControllerBase
{
    private readonly P2SDbContext _db;
    private readonly ICancellationService _cancellationService;

    public CancellationsController(P2SDbContext db, ICancellationService cancellationService)
    {
        _db = db;
        _cancellationService = cancellationService;
    }

    [HttpGet]
    public async Task<ActionResult<List<CancellationResponse>>> List([FromQuery] string? status, CancellationToken ct)
    {
        var query = _db.Cancellations.Include(c => c.OrderItem).ThenInclude(i => i.Product).AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CancellationStatus>(status, out var parsedStatus))
        {
            query = query.Where(c => c.Status == parsedStatus);
        }

        var cancellations = await query.OrderByDescending(c => c.FlaggedAt).ToListAsync(ct);
        return Ok(cancellations.Select(c => new CancellationResponse(
            c.Id, c.OrderItemId, c.OrderItem.Product.Name, c.ReimbursementId, c.Status.ToString(),
            c.FlaggedAt, c.ResolvedAt, c.Note)).ToList());
    }

    [HttpPost("{id:int}/resolve")]
    [Authorize(Roles = "finance,admin")]
    public async Task<IActionResult> Resolve(int id, ResolveCancellationRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<CancellationStatus>(request.Outcome, out var outcome))
        {
            return BadRequest(new { message = $"ไม่รู้จักสถานะ '{request.Outcome}'" });
        }

        try
        {
            var cancellation = await _cancellationService.ResolveAsync(id, outcome, ct);
            return Ok(new { id = cancellation.Id, status = cancellation.Status.ToString() });
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
