using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;

namespace P2S.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly P2SDbContext _db;

    public OrdersController(P2SDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    [Authorize(Roles = "staff,admin")]
    public async Task<ActionResult<PurchaseOrderResponse>> Create(CreateOrderRequest request, CancellationToken ct)
    {
        if (request.Items.Count == 0)
        {
            return BadRequest(new { message = "ออเดอร์ต้องมีอย่างน้อย 1 รายการ" });
        }

        var platform = await _db.Platforms.FindAsync([request.PlatformId], ct);
        if (platform is null) return BadRequest(new { message = "ไม่รู้จัก platform" });

        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var productCount = await _db.Products.CountAsync(p => productIds.Contains(p.Id), ct);
        if (productCount != productIds.Count) return BadRequest(new { message = "มีสินค้าที่ไม่รู้จักในรายการ" });

        var order = new PurchaseOrder
        {
            PlatformId = request.PlatformId,
            OrderedByUserId = this.CurrentUserId(),
            PlatformOrderNo = request.PlatformOrderNo,
            Status = PurchaseOrderStatus.Ordered,
            TotalAmount = request.Items.Sum(i => i.Qty * i.UnitPrice),
            OrderedAt = DateTime.UtcNow,
        };
        order.OrderItems = request.Items.Select(i => new OrderItem
        {
            ProductId = i.ProductId,
            Qty = i.Qty,
            UnitPrice = i.UnitPrice,
            Status = OrderItemStatus.Pending,
        }).ToList();

        _db.PurchaseOrders.Add(order);
        await _db.SaveChangesAsync(ct);

        return Ok(await ToResponse(order.Id, ct));
    }

    [HttpGet]
    public async Task<ActionResult<List<PurchaseOrderResponse>>> List(
        [FromQuery] int? platformId,
        [FromQuery] int? userId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] bool excludeRequested,
        CancellationToken ct)
    {
        var query = _db.PurchaseOrders
            .Include(o => o.Platform)
            .Include(o => o.OrderedByUser)
            .Include(o => o.OrderItems).ThenInclude(i => i.Product)
            .AsQueryable();

        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(o => o.OrderedByUserId == currentUserId);
        }

        if (platformId is not null) query = query.Where(o => o.PlatformId == platformId);
        if (userId is not null) query = query.Where(o => o.OrderedByUserId == userId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PurchaseOrderStatus>(status, out var parsedStatus))
        {
            query = query.Where(o => o.Status == parsedStatus);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(o => o.PlatformOrderNo.Contains(search));
        }

        // Used by the reimbursement-request picker: a PaidByStaff order stays PaidByStaff
        // until its reimbursement is actually Paid (not merely requested), so without this it
        // would keep showing as selectable even while a Pending/Approved request already
        // covers it — see ReimbursementService.CreateAsync for the matching server-side guard.
        if (excludeRequested)
        {
            var requestedOrderIds = await _db.Reimbursements
                .Where(r => r.Status != ReimbursementStatus.Paid)
                .SelectMany(r => r.PurchaseOrders.Select(po => po.Id))
                .ToListAsync(ct);
            var currentUserId = this.CurrentUserId();
            query = query.Where(o => o.OrderedByUserId == currentUserId && !requestedOrderIds.Contains(o.Id));
        }

        var orders = await query.OrderByDescending(o => o.OrderedAt).ToListAsync(ct);
        return Ok(orders.Select(MapToResponse).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PurchaseOrderResponse>> Get(int id, CancellationToken ct)
    {
        var response = await ToResponse(id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    /// <summary>Staff confirms they've paid the shop with their own card — creates the
    /// AdvancePaid ledger entry (company now owes this amount to the staff member).</summary>
    [HttpPost("{id:int}/mark-paid")]
    [Authorize(Roles = "staff,admin")]
    public async Task<ActionResult<PurchaseOrderResponse>> MarkPaid(int id, CancellationToken ct)
    {
        var order = await _db.PurchaseOrders.FindAsync([id], ct);
        if (order is null) return NotFound();
        if (!User.IsInRole("admin") && order.OrderedByUserId != this.CurrentUserId()) return NotFound();
        if (order.Status != PurchaseOrderStatus.Ordered)
        {
            return BadRequest(new { message = $"ออเดอร์นี้อยู่ในสถานะ {order.Status} แล้ว ไม่สามารถ mark-paid ซ้ำได้" });
        }

        order.Status = PurchaseOrderStatus.PaidByStaff;
        _db.StaffLedgerEntries.Add(new StaffLedgerEntry
        {
            UserId = order.OrderedByUserId,
            EntryType = StaffLedgerEntryType.AdvancePaid,
            Amount = order.TotalAmount,
            RelatedPurchaseOrderId = order.Id,
            Note = $"สำรองจ่ายออเดอร์ {order.PlatformOrderNo}",
        });
        await _db.SaveChangesAsync(ct);

        return Ok(await ToResponse(id, ct));
    }

    /// <summary>Staff records the shop's tracking number once it ships — required before the
    /// scan-receiving screen can barcode-match this item (see DeliveriesController).</summary>
    [HttpPost("items/{orderItemId:int}/tracking")]
    [Authorize(Roles = "staff,admin")]
    public async Task<IActionResult> SetTracking(int orderItemId, SetTrackingRequest request, CancellationToken ct)
    {
        var item = await _db.OrderItems
            .Include(i => i.PurchaseOrder)
            .FirstOrDefaultAsync(i => i.Id == orderItemId, ct);
        if (item is null) return NotFound();
        if (!User.IsInRole("admin") && item.PurchaseOrder.OrderedByUserId != this.CurrentUserId()) return NotFound();
        if (item.Status != OrderItemStatus.Pending)
        {
            return BadRequest(new { message = $"รายการนี้อยู่ในสถานะ {item.Status} แล้ว ไม่ใช่ Pending" });
        }

        item.TrackingNo = request.TrackingNo;
        item.Courier = request.Courier;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<PurchaseOrderResponse?> ToResponse(int id, CancellationToken ct)
    {
        var query = _db.PurchaseOrders.AsQueryable();
        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(o => o.OrderedByUserId == currentUserId);
        }

        var order = await query
            .Include(o => o.Platform)
            .Include(o => o.OrderedByUser)
            .Include(o => o.OrderItems).ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
        return order is null ? null : MapToResponse(order);
    }

    private static PurchaseOrderResponse MapToResponse(PurchaseOrder order) => new(
        order.Id,
        order.Platform.Code,
        order.PlatformOrderNo,
        order.TotalAmount,
        order.Status.ToString(),
        order.OrderedAt,
        order.OrderedByUserId,
        order.OrderedByUser.Username,
        order.OrderItems.Select(i => new OrderItemResponse(
            i.Id, i.ProductId, i.Product.Name, i.Qty, i.UnitPrice, i.Status.ToString(),
            i.TrackingNo, i.Courier, i.ArrivedAt, i.CancelledAt)).ToList()
    );
}
