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
        var query = _db.Cancellations
            .Include(c => c.OrderItem).ThenInclude(i => i.Product)
            .Include(c => c.OrderItem).ThenInclude(i => i.PurchaseOrder).ThenInclude(o => o.Platform)
            .Include(c => c.OrderItem).ThenInclude(i => i.PurchaseOrder).ThenInclude(o => o.OrderedByUser)
            .Include(c => c.ReportedByUser)
            .Include(c => c.ResolvedByUser)
            .AsQueryable();

        if (User.IsInRole("staff"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(c => c.OrderItem.PurchaseOrder.OrderedByUserId == currentUserId);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CancellationStatus>(status, out var parsedStatus))
        {
            query = query.Where(c => c.Status == parsedStatus);
        }

        var cancellations = await query.OrderByDescending(c => c.FlaggedAt).ToListAsync(ct);
        return Ok(cancellations.Select(MapToResponse).ToList());
    }

    [HttpPost("returns")]
    [Authorize(Roles = "staff,admin")]
    public async Task<ActionResult<CancellationResponse>> CreateSupplierReturn(CreateSupplierReturnRequest request, CancellationToken ct)
    {
        var ownerId = await _db.InventoryItems
            .Where(i => i.Id == request.InventoryItemId)
            .Select(i => (int?)i.OrderItem.PurchaseOrder.OrderedByUserId)
            .FirstOrDefaultAsync(ct);
        if (ownerId is null) return NotFound();
        if (!User.IsInRole("admin") && ownerId != this.CurrentUserId()) return NotFound();

        try
        {
            var cancellation = await _cancellationService.CreateSupplierReturnAsync(
                request.InventoryItemId, request.Quantity, request.RefundAmount, request.Note, this.CurrentUserId(), ct);
            return Ok(await ToResponse(cancellation.Id, ct));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ArgumentOutOfRangeException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "สต็อกเปลี่ยนพร้อมกัน กรุณาโหลดใหม่แล้วลองอีกครั้ง" }); }
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
            var cancellation = await _cancellationService.ResolveAsync(id, outcome, ct, this.CurrentUserId());
            return Ok(new { id = cancellation.Id, status = cancellation.Status.ToString() });
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "รายการนี้ถูกจัดการพร้อมกัน กรุณาโหลดใหม่" }); }
    }

    private async Task<CancellationResponse?> ToResponse(int id, CancellationToken ct)
    {
        var cancellation = await _db.Cancellations
            .Include(c => c.OrderItem).ThenInclude(i => i.Product)
            .Include(c => c.OrderItem).ThenInclude(i => i.PurchaseOrder).ThenInclude(o => o.Platform)
            .Include(c => c.OrderItem).ThenInclude(i => i.PurchaseOrder).ThenInclude(o => o.OrderedByUser)
            .Include(c => c.ReportedByUser)
            .Include(c => c.ResolvedByUser)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        return cancellation is null ? null : MapToResponse(cancellation);
    }

    private static CancellationResponse MapToResponse(Cancellation c) => new(
        c.Id, c.OrderItemId, c.OrderItem.Product.Name, c.OrderItem.PurchaseOrderId,
        c.OrderItem.PurchaseOrder.Platform.Code, c.OrderItem.PurchaseOrder.PlatformOrderNo,
        c.OrderItem.PurchaseOrder.OrderedByUser.Username, c.ReportedByUser?.Username,
        c.ResolvedByUser?.Username, c.Quantity, c.RefundAmount, c.ReimbursementId,
        c.Status.ToString(), c.FlaggedAt, c.ResolvedAt, c.Note);
}
