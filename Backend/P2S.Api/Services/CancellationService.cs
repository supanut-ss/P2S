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

    public async Task FlagFromOrderItemCancellationAsync(OrderItem orderItem, CancellationToken ct)
    {
        var order = await _db.PurchaseOrders.FirstAsync(o => o.Id == orderItem.PurchaseOrderId, ct);

        Reimbursement? reimbursement = null;
        if (order.Status == PurchaseOrderStatus.Reimbursed)
        {
            reimbursement = await _db.Reimbursements
                .Where(r => r.Status == ReimbursementStatus.Paid && r.PurchaseOrders.Any(po => po.Id == order.Id))
                .OrderByDescending(r => r.PaidAt)
                .FirstOrDefaultAsync(ct);
        }

        var cancellation = new Cancellation
        {
            OrderItemId = orderItem.Id,
            ReimbursementId = reimbursement?.Id,
            Status = CancellationStatus.RefundPending,
            FlaggedAt = DateTime.UtcNow,
        };
        _db.Cancellations.Add(cancellation);
        await _db.SaveChangesAsync(ct);

        if (reimbursement is not null)
        {
            var refundAmount = orderItem.Qty * orderItem.UnitPrice;
            _db.StaffLedgerEntries.Add(new StaffLedgerEntry
            {
                UserId = order.OrderedByUserId,
                EntryType = StaffLedgerEntryType.RefundDue,
                Amount = -refundAmount,
                RelatedCancellationId = cancellation.Id,
                Note = $"ร้านยกเลิกหลังเบิกเงินแล้ว — order item #{orderItem.Id}",
            });
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task<Cancellation> ResolveAsync(int cancellationId, CancellationStatus outcome, CancellationToken ct)
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

        // Only a genuine cash refund settles the staff ledger — an "Adjusted" outcome means
        // finance chose to net it against something else instead, so no ledger entry here.
        if (outcome == CancellationStatus.Refunded && cancellation.ReimbursementId is not null)
        {
            var refundAmount = cancellation.OrderItem.Qty * cancellation.OrderItem.UnitPrice;
            _db.StaffLedgerEntries.Add(new StaffLedgerEntry
            {
                UserId = cancellation.OrderItem.PurchaseOrder.OrderedByUserId,
                EntryType = StaffLedgerEntryType.RefundSettled,
                Amount = refundAmount,
                RelatedCancellationId = cancellation.Id,
                Note = $"เคลียร์ยอดคืนเงินแล้ว — order item #{cancellation.OrderItemId}",
            });
        }

        await _db.SaveChangesAsync(ct);
        return cancellation;
    }
}
