using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

[ApiController]
[Route("api/reimbursements")]
[Authorize]
public class ReimbursementsController : ControllerBase
{
    private readonly P2SDbContext _db;
    private readonly IReimbursementService _reimbursementService;

    public ReimbursementsController(P2SDbContext db, IReimbursementService reimbursementService)
    {
        _db = db;
        _reimbursementService = reimbursementService;
    }

    [HttpPost]
    [Authorize(Roles = "staff,admin")]
    public async Task<ActionResult<ReimbursementResponse>> Create(CreateReimbursementRequest request, CancellationToken ct)
    {
        try
        {
            var reimbursement = await _reimbursementService.CreateAsync(this.CurrentUserId(), request.PurchaseOrderIds, ct);
            return Ok(await ToResponse(reimbursement.Id, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>The reimbursement queue (PROJECT-PLAN.md screen 3) — finance filters to
    /// Pending/Approved to work through it as a batch.</summary>
    [HttpGet]
    public async Task<ActionResult<List<ReimbursementResponse>>> List([FromQuery] string? status, CancellationToken ct)
    {
        var query = _db.Reimbursements
            .Include(r => r.RequestedByUser)
            .Include(r => r.PurchaseOrders)
            .AsQueryable();

        if (User.IsInRole("staff"))
        {
            query = query.Where(r => r.RequestedByUserId == this.CurrentUserId());
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReimbursementStatus>(status, out var parsedStatus))
        {
            query = query.Where(r => r.Status == parsedStatus);
        }

        var reimbursements = await query.OrderByDescending(r => r.RequestedAt).ToListAsync(ct);
        return Ok(reimbursements.Select(MapToResponse).ToList());
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = "finance,admin")]
    public async Task<ActionResult<ReimbursementResponse>> Approve(int id, CancellationToken ct)
    {
        try
        {
            await _reimbursementService.ApproveAsync(id, ct);
            return Ok(await ToResponse(id, ct));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id:int}/pay")]
    [Authorize(Roles = "finance,admin")]
    public async Task<ActionResult<ReimbursementResponse>> Pay(int id, CancellationToken ct)
    {
        try
        {
            await _reimbursementService.PayAsync(id, ct);
            return Ok(await ToResponse(id, ct));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    private async Task<ReimbursementResponse?> ToResponse(int id, CancellationToken ct)
    {
        var reimbursement = await _db.Reimbursements
            .Include(r => r.RequestedByUser)
            .Include(r => r.PurchaseOrders)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        return reimbursement is null ? null : MapToResponse(reimbursement);
    }

    private static ReimbursementResponse MapToResponse(Reimbursement r) => new(
        r.Id, r.RequestedByUserId, r.RequestedByUser.Username, r.Status.ToString(), r.TotalAmount,
        r.RequestedAt, r.ApprovedAt, r.PaidAt, r.PurchaseOrders.Select(o => o.Id).ToList());
}
