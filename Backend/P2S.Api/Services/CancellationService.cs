using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public class CancellationService : ICancellationService
{
    private readonly P2SDbContext _db;

    public CancellationService(P2SDbContext db)
    {
        _db = db;
    }

    public async Task FlagFromOrderItemCancellationAsync(OrderItem orderItem, CancellationToken ct, int? reportedByUserId = null, decimal? refundAmount = null, string? note = null)
    {
        if (orderItem.Status is not (OrderItemStatus.Pending or OrderItemStatus.Cancelled))
        {
            throw new InvalidOperationException($"ยกเลิกได้เฉพาะรายการ Pending (สถานะปัจจุบัน: {orderItem.Status})");
        }
        if (refundAmount < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(refundAmount), "ยอดคืนเงินต้องไม่ติดลบ");
        }

        var order = await _db.PurchaseOrders.FirstAsync(o => o.Id == orderItem.PurchaseOrderId, ct);
        var existingRefunds = await _db.Cancellations
            .Where(c => c.OrderItem.PurchaseOrderId == order.Id)
            .SumAsync(c => (decimal?)c.RefundAmount, ct) ?? 0m;
        var effectiveRefund = refundAmount ?? orderItem.Qty * orderItem.UnitPrice;
        if (effectiveRefund < 0 || existingRefunds + effectiveRefund > (order.ActualPaidAmount ?? order.TotalAmount))
        {
            throw new ArgumentOutOfRangeException(nameof(refundAmount), "ยอดคืนรวมเกินยอดจ่ายจริงของออเดอร์");
        }
        order.RowVersion += 1;

        Reimbursement? reimbursement = null;
        if (order.Status == PurchaseOrderStatus.Reimbursed)
        {
            reimbursement = await _db.Reimbursements
                .Where(r => r.Status == ReimbursementStatus.Paid && r.PurchaseOrders.Any(po => po.Id == order.Id))
                .OrderByDescending(r => r.PaidAt)
                .FirstOrDefaultAsync(ct);
        }

        if (orderItem.Status == OrderItemStatus.Pending)
        {
            orderItem.Status = OrderItemStatus.Cancelled;
            orderItem.CancelledAt = DateTime.UtcNow;
            orderItem.RowVersion += 1;
        }
        var cancellation = new Cancellation
        {
            OrderItemId = orderItem.Id,
            Quantity = orderItem.Qty,
            RefundAmount = effectiveRefund,
            ReportedByUserId = reportedByUserId,
            ReimbursementId = reimbursement?.Id,
            Status = CancellationStatus.RefundPending,
            FlaggedAt = DateTime.UtcNow,
            Note = note,
        };
        _db.Cancellations.Add(cancellation);

        if (reimbursement is not null && order.PaymentSource != PaymentSource.CompanyDirect && cancellation.RefundAmount > 0)
        {
            _db.StaffLedgerEntries.Add(new StaffLedgerEntry
            {
                UserId = order.PaymentPayerUserId ?? order.OrderedByUserId,
                EntryType = StaffLedgerEntryType.RefundDue,
                Amount = -cancellation.RefundAmount,
                RelatedCancellation = cancellation,
                Note = $"ร้านยกเลิกหลังเบิกเงินแล้ว — order item #{orderItem.Id}",
            });
        }

        await _db.SaveChangesAsync(ct);
    }

    public async Task<Cancellation> CreateSupplierReturnAsync(int inventoryItemId, int quantity, decimal refundAmount, string? note, int reportedByUserId, CancellationToken ct)
    {
        if (quantity <= 0) throw new ArgumentOutOfRangeException(nameof(quantity), "จำนวนที่คืนต้องมากกว่า 0");
        if (refundAmount < 0) throw new ArgumentOutOfRangeException(nameof(refundAmount), "ยอดคืนเงินต้องไม่ติดลบ");

        var inventoryItem = await _db.InventoryItems
            .Include(i => i.OrderItem).ThenInclude(i => i.PurchaseOrder)
            .Include(i => i.OrderItem).ThenInclude(i => i.Cancellations)
            .FirstOrDefaultAsync(i => i.Id == inventoryItemId, ct)
            ?? throw new KeyNotFoundException($"ไม่พบ inventory item id={inventoryItemId}");

        var orderItem = inventoryItem.OrderItem;
        if (orderItem.Status is not (OrderItemStatus.Arrived or OrderItemStatus.Returned))
        {
            throw new InvalidOperationException("คืนผู้ขายได้เฉพาะสินค้าที่รับเข้าคลังแล้ว");
        }
        if (quantity > inventoryItem.QtyOnHand || quantity > orderItem.Qty - orderItem.ReturnedQty)
        {
            throw new InvalidOperationException($"จำนวนคืนเกินยอดที่ยังอยู่ในคลังหรือยังไม่คืน (คงเหลือในคลัง {inventoryItem.QtyOnHand} ชิ้น)");
        }

        var order = orderItem.PurchaseOrder;
        var existingRefunds = await _db.Cancellations
            .Where(c => c.OrderItem.PurchaseOrderId == order.Id)
            .SumAsync(c => (decimal?)c.RefundAmount, ct) ?? 0m;
        if (existingRefunds + refundAmount > (order.ActualPaidAmount ?? order.TotalAmount))
        {
            throw new ArgumentOutOfRangeException(nameof(refundAmount), "ยอดคืนรวมเกินยอดจ่ายจริงของออเดอร์");
        }
        order.RowVersion += 1;
        var reimbursement = order.Status == PurchaseOrderStatus.Reimbursed
            ? await _db.Reimbursements
                .Where(r => r.Status == ReimbursementStatus.Paid && r.PurchaseOrders.Any(po => po.Id == order.Id))
                .OrderByDescending(r => r.PaidAt)
                .FirstOrDefaultAsync(ct)
            : null;

        inventoryItem.QtyOnHand -= quantity;
        inventoryItem.Status = inventoryItem.QtyOnHand == 0 ? InventoryItemStatus.Depleted : InventoryItemStatus.InStock;
        inventoryItem.RowVersion += 1;
        orderItem.ReturnedQty += quantity;
        orderItem.RowVersion += 1;
        if (orderItem.ReturnedQty == orderItem.Qty) orderItem.Status = OrderItemStatus.Returned;

        var cancellation = new Cancellation
        {
            OrderItemId = orderItem.Id,
            Quantity = quantity,
            RefundAmount = refundAmount,
            ReportedByUserId = reportedByUserId,
            ReimbursementId = reimbursement?.Id,
            Status = CancellationStatus.RefundPending,
            FlaggedAt = DateTime.UtcNow,
            Note = note,
        };
        _db.Cancellations.Add(cancellation);

        if (reimbursement is not null && order.PaymentSource != PaymentSource.CompanyDirect && refundAmount > 0)
        {
            _db.StaffLedgerEntries.Add(new StaffLedgerEntry
            {
                UserId = order.PaymentPayerUserId ?? order.OrderedByUserId,
                EntryType = StaffLedgerEntryType.RefundDue,
                Amount = -refundAmount,
                RelatedCancellation = cancellation,
                Note = $"คืนผู้ขาย — order item #{orderItem.Id}",
            });
        }

        await _db.SaveChangesAsync(ct);
        return cancellation;
    }

    public async Task<Cancellation> ResolveAsync(int cancellationId, CancellationStatus outcome, CancellationToken ct, int? resolvedByUserId = null)
    {
        if (outcome == CancellationStatus.RefundPending)
        {
            throw new ArgumentException("Resolve ต้องเป็น Refunded หรือ Adjusted เท่านั้น", nameof(outcome));
        }

        var cancellation = await _db.Cancellations
            .Include(c => c.OrderItem).ThenInclude(oi => oi.PurchaseOrder)
            .FirstOrDefaultAsync(c => c.Id == cancellationId, ct)
            ?? throw new KeyNotFoundException($"ไม่พบ cancellation id={cancellationId}");

        if (cancellation.Status != CancellationStatus.RefundPending)
        {
            throw new InvalidOperationException($"Cancellation นี้อยู่ในสถานะ {cancellation.Status} แล้ว");
        }

        cancellation.Status = outcome;
        cancellation.ResolvedAt = DateTime.UtcNow;
        cancellation.ResolvedByUserId = resolvedByUserId;
        cancellation.RowVersion += 1;
        cancellation.OrderItem.PurchaseOrder.RowVersion += 1;

        var paymentOrder = cancellation.OrderItem.PurchaseOrder;
        if (paymentOrder.PaymentSource != PaymentSource.CompanyDirect && cancellation.RefundAmount > 0)
        {
            if (cancellation.ReimbursementId is not null)
            {
                // Clear the liability posted when a refund arrives after the company has reimbursed the staff member.
                _db.StaffLedgerEntries.Add(new StaffLedgerEntry
                {
                    UserId = paymentOrder.PaymentPayerUserId ?? paymentOrder.OrderedByUserId,
                    EntryType = StaffLedgerEntryType.RefundSettled,
                    Amount = cancellation.RefundAmount,
                    RelatedCancellationId = cancellation.Id,
                    Note = $"เคลียร์ยอดคืนเงิน/ปรับยอดแล้ว — order item #{cancellation.OrderItemId}",
                });
            }
            else
            {
                // If the employee receives the refund before reimbursement, reduce the outstanding advance instead.
                _db.StaffLedgerEntries.Add(new StaffLedgerEntry
                {
                    UserId = paymentOrder.PaymentPayerUserId ?? paymentOrder.OrderedByUserId,
                    EntryType = StaffLedgerEntryType.Adjustment,
                    Amount = -cancellation.RefundAmount,
                    RelatedCancellationId = cancellation.Id,
                    Note = $"ปรับยอดสำรองจ่ายจากเงินคืนก่อนเบิก — order item #{cancellation.OrderItemId}",
                });
            }
        }

        var openReimbursements = await _db.Reimbursements
            .Where(r => (r.Status == ReimbursementStatus.Pending || r.Status == ReimbursementStatus.Approved) && r.PurchaseOrders.Any(po => po.Id == cancellation.OrderItem.PurchaseOrderId))
            .Include(r => r.PurchaseOrders).ThenInclude(po => po.OrderItems).ThenInclude(item => item.Cancellations)
            .ToListAsync(ct);

        foreach (var reimbursement in openReimbursements)
        {
            var updatedTotal = reimbursement.PurchaseOrders.Sum(ReimbursementAmountCalculator.Calculate);
            if (updatedTotal == reimbursement.TotalAmount) continue;

            reimbursement.TotalAmount = updatedTotal;
            reimbursement.RowVersion += 1;
            if (updatedTotal <= 0)
            {
                reimbursement.Status = ReimbursementStatus.Voided;
                reimbursement.ApprovedAt = null;
                reimbursement.ApprovedByUserId = null;
            }
            else if (reimbursement.Status == ReimbursementStatus.Approved)
            {
                reimbursement.Status = ReimbursementStatus.Pending;
                reimbursement.ApprovedAt = null;
                reimbursement.ApprovedByUserId = null;
            }
        }

        await _db.SaveChangesAsync(ct);
        return cancellation;
    }
}
