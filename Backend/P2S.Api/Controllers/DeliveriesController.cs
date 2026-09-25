using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

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

    [HttpGet("pending")]
    public async Task<ActionResult<List<PendingOrderItemResponse>>> GetPending([FromQuery] string? search, CancellationToken ct)
    {
        var query = _db.OrderItems
            .Include(item => item.Product)
            .Include(item => item.PurchaseOrder).ThenInclude(order => order.Platform)
            .Where(item => item.Status == OrderItemStatus.Pending && item.ReceivedQty < item.Qty);

        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(item => item.PurchaseOrder.OrderedByUserId == currentUserId);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(item => item.PurchaseOrder.PlatformOrderNo.Contains(search) || item.Product.Name.Contains(search));
        }

        var items = await query.OrderBy(item => item.PurchaseOrder.OrderedAt).ToListAsync(ct);
        return Ok(items.Select(item => new PendingOrderItemResponse(
            item.Id,
            item.PurchaseOrderId,
            item.PurchaseOrder.Platform.Code,
            item.PurchaseOrder.PlatformOrderNo,
            item.Product.Name,
            item.Qty,
            item.ReceivedQty,
            item.Qty - item.ReceivedQty,
            item.UnitPrice,
            item.Status.ToString())).ToList());
    }

    [HttpPost("{orderItemId:int}/confirm-arrived")]
    [Obsolete("Use the order-number receipt workflow.")]
    public async Task<IActionResult> ConfirmArrived(int orderItemId, ConfirmArrivedRequest request, CancellationToken ct)
    {
        var orderItem = await _db.OrderItems
            .Include(item => item.PurchaseOrder)
            .FirstOrDefaultAsync(item => item.Id == orderItemId, ct);
        if (orderItem is null) return NotFound();
        if (!User.IsInRole("admin") && orderItem.PurchaseOrder.OrderedByUserId != this.CurrentUserId()) return NotFound();
        return StatusCode(StatusCodes.Status410Gone, new { message = "เปลี่ยนเป็นรับของด้วยเลข Order แล้ว กรุณาใช้หน้ารับของเวอร์ชันล่าสุด" });
    }

    [HttpGet("orders/lookup")]
    public async Task<ActionResult<List<GoodsReceiptOrderResponse>>> LookupOrder([FromQuery] string orderNo, CancellationToken ct)
    {
        var exactOrderNo = orderNo?.Trim();
        if (string.IsNullOrWhiteSpace(exactOrderNo)) return BadRequest(new { message = "กรอกเลข Order ก่อนค้นหา" });

        var query = _db.PurchaseOrders
            .Include(order => order.Platform)
            .Include(order => order.OrderItems).ThenInclude(item => item.Product)
            .Where(order => order.PlatformOrderNo == exactOrderNo);

        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(order => order.OrderedByUserId == currentUserId);
        }

        var orders = await query.OrderByDescending(order => order.OrderedAt).ToListAsync(ct);
        var orderIds = orders.Select(order => order.Id).ToList();
        var receiptEvents = await _db.GoodsReceiptEvents
            .Include(entry => entry.ActorUser)
            .Include(entry => entry.ReversedByEvents)
            .Include(entry => entry.Lines).ThenInclude(line => line.OrderItem).ThenInclude(item => item.Product)
            .Where(entry => orderIds.Contains(entry.PurchaseOrderId))
            .OrderByDescending(entry => entry.OccurredAt)
            .ToListAsync(ct);
        var eventsByOrder = receiptEvents.GroupBy(entry => entry.PurchaseOrderId)
            .ToDictionary(group => group.Key, group => group.Select(entry => new GoodsReceiptEventResponse(
                entry.Id,
                entry.EventType.ToString(),
                entry.OccurredAt,
                entry.ActorUser.Username,
                entry.LineCount,
                entry.UnitCount,
                entry.Reason,
                entry.ReversedByEvents.Count > 0,
                entry.ReversesEventId,
                entry.Lines.Select(line => new GoodsReceiptHistoryLineResponse(
                    line.OrderItem.Product.Name, line.OrderItem.Product.SkuCode, line.Quantity, line.UnitPrice)).ToList())).ToList());

        return Ok(orders.Select(order => new GoodsReceiptOrderResponse(
            order.Id,
            order.Platform.Code,
            order.PlatformOrderNo,
            order.OrderedAt,
            order.OrderItems.OrderBy(item => item.Id).Select(item => new GoodsReceiptOrderLineResponse(
                item.Id,
                item.Product.Name,
                item.Product.SkuCode,
                item.PackageName,
                item.Model,
                item.ShopName,
                item.TrackingNo,
                item.ArrivedAt,
                item.Description,
                item.Qty,
                item.ReceivedQty,
                Math.Max(0, item.Qty - item.ReceivedQty),
                item.UnitPrice,
                item.Status.ToString())).ToList(),
            eventsByOrder.GetValueOrDefault(order.Id, []))).ToList());
    }

    [HttpPost("orders/receive")]
    public async Task<IActionResult> ReceiveOrder(ReceiveGoodsRequest request, CancellationToken ct)
    {
        if (request.Lines is null || request.Lines.Count == 0)
            return BadRequest(new { message = "เลือกสินค้าและระบุจำนวนที่มาถึงอย่างน้อย 1 รายการ" });
        if (request.Lines.Any(line => line.Quantity <= 0))
            return BadRequest(new { message = "จำนวนรับต้องมากกว่า 0" });
        if (request.Lines.Select(line => line.OrderItemId).Distinct().Count() != request.Lines.Count)
            return BadRequest(new { message = "พบรายการสินค้าซ้ำในคำขอรับของ" });

        var orderQuery = _db.PurchaseOrders
            .Include(order => order.Platform)
            .Include(order => order.OrderItems).ThenInclude(item => item.InventoryItem)
            .Where(order => order.Id == request.PurchaseOrderId);
        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            orderQuery = orderQuery.Where(order => order.OrderedByUserId == currentUserId);
        }

        var order = await orderQuery.FirstOrDefaultAsync(ct);
        if (order is null) return NotFound();

        var orderItems = order.OrderItems.ToDictionary(item => item.Id);
        foreach (var line in request.Lines)
        {
            if (!orderItems.TryGetValue(line.OrderItemId, out var item))
                return BadRequest(new { message = "สินค้าที่เลือกไม่ได้อยู่ใน Order นี้" });
            if (item.Status != OrderItemStatus.Pending || item.ReceivedQty >= item.Qty)
                return Conflict(new { message = $"{item.ProductId}: รายการนี้รับครบหรือยกเลิกแล้ว กรุณาค้นหา Order ใหม่" });
            if (line.Quantity > item.Qty - item.ReceivedQty)
                return BadRequest(new { message = $"รับได้ไม่เกิน {item.Qty - item.ReceivedQty} ชิ้นสำหรับรายการนี้" });
        }

        var receipt = new GoodsReceiptEvent
        {
            PurchaseOrderId = order.Id,
            EventType = GoodsReceiptEventType.Receipt,
            EntryMethod = GoodsReceiptEntryMethod.OrderNumber,
            EnteredOrderNo = order.PlatformOrderNo,
            LineCount = request.Lines.Count,
            UnitCount = request.Lines.Sum(line => line.Quantity),
            ActorUserId = this.CurrentUserId(),
            OccurredAt = DateTime.UtcNow,
        };

        foreach (var line in request.Lines)
        {
            var item = orderItems[line.OrderItemId];
            await _inventoryService.ReceiveAsync(item, line.Quantity, ct);
            receipt.Lines.Add(new GoodsReceiptEventLine
            {
                OrderItemId = item.Id,
                Quantity = line.Quantity,
                UnitPrice = item.UnitPrice,
            });
        }

        _db.GoodsReceiptEvents.Add(receipt);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "มีผู้รับ Order นี้พร้อมกัน กรุณาค้นหา Order ใหม่ก่อนรับซ้ำ" });
        }
        catch (DbUpdateException ex) when (ex.InnerException is MySqlConnector.MySqlException { Number: 1062 })
        {
            return Conflict(new { message = "Order นี้ถูกบันทึกรับพร้อมกันแล้ว กรุณาค้นหา Order ใหม่" });
        }

        return Ok(new
        {
            receiptEventId = receipt.Id,
            purchaseOrderId = order.Id,
            platformCode = order.Platform.Code,
            platformOrderNo = order.PlatformOrderNo,
            lineCount = receipt.LineCount,
            unitCount = receipt.UnitCount,
            receivedAt = receipt.OccurredAt,
        });
    }

    [Authorize(Roles = "admin")]
    [HttpPost("receipts/{eventId:int}/reverse")]
    public async Task<IActionResult> ReverseReceipt(int eventId, ReverseGoodsReceiptRequest request, CancellationToken ct)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason)) return BadRequest(new { message = "ระบุเหตุผลก่อนย้อนรายการรับของ" });
        if (reason.Length > 500) return BadRequest(new { message = "เหตุผลต้องไม่เกิน 500 ตัวอักษร" });

        var receipt = await _db.GoodsReceiptEvents
            .Include(entry => entry.Lines).ThenInclude(line => line.OrderItem).ThenInclude(item => item.InventoryItem).ThenInclude(lot => lot!.Withdrawals)
            .FirstOrDefaultAsync(entry => entry.Id == eventId, ct);
        if (receipt is null) return NotFound();
        if (receipt.EventType != GoodsReceiptEventType.Receipt)
            return BadRequest(new { message = "ย้อนกลับได้เฉพาะรายการรับของ" });
        if (await _db.GoodsReceiptEvents.AnyAsync(entry => entry.ReversesEventId == eventId, ct))
            return Conflict(new { message = "รายการรับของนี้ถูกย้อนกลับแล้ว" });

        foreach (var line in receipt.Lines)
        {
            var item = line.OrderItem;
            var lot = item.InventoryItem;
            if (lot is null || item.ReturnedQty > 0 || lot.QtyOnHand != lot.QtyReceived || lot.QtyReceived < line.Quantity)
                return Conflict(new { message = "ย้อนรายการไม่ได้ เพราะสินค้าถูกเบิก คืน หรือยอดคลังเปลี่ยนแล้ว" });

            lot.QtyReceived -= line.Quantity;
            lot.QtyOnHand -= line.Quantity;
            lot.Status = lot.QtyOnHand == 0 ? InventoryItemStatus.Depleted : InventoryItemStatus.InStock;
            lot.RowVersion += 1;
            item.ReceivedQty -= line.Quantity;
            item.Status = item.ReceivedQty == item.Qty ? OrderItemStatus.Arrived : OrderItemStatus.Pending;
            if (item.ReceivedQty == 0) item.ArrivedAt = null;
            item.RowVersion += 1;
        }

        var reversal = new GoodsReceiptEvent
        {
            PurchaseOrderId = receipt.PurchaseOrderId,
            EventType = GoodsReceiptEventType.Reversal,
            EntryMethod = GoodsReceiptEntryMethod.OrderNumber,
            EnteredOrderNo = receipt.EnteredOrderNo,
            LineCount = receipt.LineCount,
            UnitCount = receipt.UnitCount,
            ActorUserId = this.CurrentUserId(),
            OccurredAt = DateTime.UtcNow,
            ReversesEventId = receipt.Id,
            Reason = reason,
        };
        foreach (var line in receipt.Lines)
        {
            reversal.Lines.Add(new GoodsReceiptEventLine
            {
                OrderItemId = line.OrderItemId,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
            });
        }

        _db.GoodsReceiptEvents.Add(reversal);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "ยอดคลังเปลี่ยนพร้อมกัน กรุณาโหลดข้อมูลใหม่" });
        }
        catch (DbUpdateException ex) when (ex.InnerException is MySqlConnector.MySqlException { Number: 1062 })
        {
            return Conflict(new { message = "รายการรับของนี้ถูกย้อนกลับพร้อมกันแล้ว" });
        }
        return Ok(new { receiptEventId = receipt.Id, reversalEventId = reversal.Id });
    }

    [HttpPost("{orderItemId:int}/cancel")]
    public async Task<IActionResult> Cancel(int orderItemId, CancelOrderItemRequest request, CancellationToken ct)
    {
        var orderItem = await _db.OrderItems
            .Include(item => item.PurchaseOrder)
            .FirstOrDefaultAsync(item => item.Id == orderItemId, ct);
        if (orderItem is null) return NotFound();
        if (!User.IsInRole("admin") && orderItem.PurchaseOrder.OrderedByUserId != this.CurrentUserId()) return NotFound();
        if (orderItem.Status != OrderItemStatus.Pending || orderItem.ReceivedQty > 0)
            return BadRequest(new { message = "ยกเลิกได้เฉพาะรายการที่ยังไม่เคยรับของเข้าคลัง" });
        if (request.RefundAmount < 0) return BadRequest(new { message = "ยอดคืนเงินต้องไม่ติดลบ" });

        try
        {
            await _cancellationService.FlagFromOrderItemCancellationAsync(
                orderItem, ct, this.CurrentUserId(), request.RefundAmount, request.Note);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "สถานะรายการเปลี่ยนพร้อมกัน กรุณาค้นหา Order ใหม่" });
        }
        return Ok(new { orderItemId, status = orderItem.Status.ToString() });
    }
}
