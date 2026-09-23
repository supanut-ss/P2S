using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

/// <summary>The goods-receiving scan screen (PROJECT-PLAN.md section 4, screen 4). Matching
/// is by the shop's own courier barcode/tracking number, not a QR code the system generates —
/// see design decisions recorded in PROJECT-PLAN.md section 2.2. A manual search is always
/// available as a fallback since barcodes don't scan cleanly on every phone/box.</summary>
[ApiController]
[Route("api/deliveries")]
[Authorize(Roles = "staff,admin")]
public class DeliveriesController : ControllerBase
{
    private readonly P2SDbContext _db;
    private readonly IInventoryService _inventoryService;
    private readonly ICancellationService _cancellationService;

    public DeliveriesController(P2SDbContext db, IInventoryService inventoryService, ICancellationService cancellationService)
    {
        _db = db;
        _inventoryService = inventoryService;
        _cancellationService = cancellationService;
    }

    /// <summary>Lists order items still awaiting arrival. `search` matches against order
    /// number, tracking number, or product name — this single endpoint serves both the
    /// "scan matched this exact tracking number" case and the manual-search fallback.</summary>
    [HttpGet("pending")]
    public async Task<ActionResult<List<PendingOrderItemResponse>>> GetPending([FromQuery] string? search, CancellationToken ct)
    {
        var query = _db.OrderItems
            .Include(i => i.Product)
            .Include(i => i.PurchaseOrder).ThenInclude(o => o.Platform)
            .Where(i => i.Status == OrderItemStatus.Pending);

        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(i => i.PurchaseOrder.OrderedByUserId == currentUserId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(i =>
                i.PurchaseOrder.PlatformOrderNo.Contains(search) ||
                (i.TrackingNo != null && i.TrackingNo.Contains(search)) ||
                i.Product.Name.Contains(search));
        }

        var items = await query.OrderBy(i => i.PurchaseOrder.OrderedAt).ToListAsync(ct);
        return Ok(items.Select(i => new PendingOrderItemResponse(
            i.Id, i.PurchaseOrderId, i.PurchaseOrder.Platform.Code, i.PurchaseOrder.PlatformOrderNo,
            i.Product.Name, i.Qty, i.UnitPrice, i.TrackingNo, i.Courier)).ToList());
    }

    /// <summary>Confirms receipt: records the scan event, marks the order item Arrived, and
    /// auto-creates the inventory lot (PROJECT-PLAN.md section 1.10 — no separate "create
    /// inventory" step). MatchMethod is one of Barcode / ManualTrackingEntry / OrderNumberSearch,
    /// recorded for audit of how staff actually found the match in practice.</summary>
    [HttpPost("{orderItemId:int}/confirm-arrived")]
    public async Task<IActionResult> ConfirmArrived(int orderItemId, ConfirmArrivedRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<DeliveryMatchMethod>(request.MatchMethod, out var matchMethod))
        {
            return BadRequest(new { message = $"ไม่รู้จัก match method '{request.MatchMethod}'" });
        }

        var orderItem = await _db.OrderItems
            .Include(i => i.PurchaseOrder)
            .FirstOrDefaultAsync(i => i.Id == orderItemId, ct);
        if (orderItem is null) return NotFound();
        if (!User.IsInRole("admin") && orderItem.PurchaseOrder.OrderedByUserId != this.CurrentUserId()) return NotFound();
        if (orderItem.Status != OrderItemStatus.Pending)
        {
            return BadRequest(new { message = $"รายการนี้อยู่ในสถานะ {orderItem.Status} แล้ว ไม่ใช่ Pending" });
        }

        _db.Deliveries.Add(new Delivery
        {
            OrderItemId = orderItemId,
            ScannedCode = request.ScannedCode,
            MatchMethod = matchMethod,
            ScannedByUserId = this.CurrentUserId(),
            ScannedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        var lot = await _inventoryService.ReceiveAsync(orderItem, ct);
        return Ok(new { inventoryItemId = lot.Id, orderItemId, status = orderItem.Status.ToString() });
    }

    /// <summary>Shop cancelled or the item never arrived — does not create an inventory lot,
    /// but the order item record stays (audit trail per PROJECT-PLAN.md section 1.8).</summary>
    [HttpPost("{orderItemId:int}/cancel")]
    public async Task<IActionResult> Cancel(int orderItemId, CancelOrderItemRequest request, CancellationToken ct)
    {
        var orderItem = await _db.OrderItems
            .Include(i => i.PurchaseOrder)
            .FirstOrDefaultAsync(i => i.Id == orderItemId, ct);
        if (orderItem is null) return NotFound();
        if (!User.IsInRole("admin") && orderItem.PurchaseOrder.OrderedByUserId != this.CurrentUserId()) return NotFound();
        if (orderItem.Status != OrderItemStatus.Pending)
        {
            return BadRequest(new { message = $"รายการนี้อยู่ในสถานะ {orderItem.Status} แล้ว ไม่ใช่ Pending" });
        }

        orderItem.Status = OrderItemStatus.Cancelled;
        orderItem.CancelledAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _cancellationService.FlagFromOrderItemCancellationAsync(orderItem, ct);
        return Ok(new { orderItemId, status = orderItem.Status.ToString() });
    }
}
