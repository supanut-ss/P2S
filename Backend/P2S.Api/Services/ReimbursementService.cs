using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public class ReimbursementService : IReimbursementService
{
    private readonly P2SDbContext _db;

    public ReimbursementService(P2SDbContext db)
    {
        _db = db;
    }

    public async Task<Reimbursement> CreateAsync(int requestedByUserId, List<int> purchaseOrderIds, CancellationToken ct)
    {
        if (purchaseOrderIds.Count == 0)
        {
            throw new ArgumentException("ต้องเลือกอย่างน้อย 1 ออเดอร์", nameof(purchaseOrderIds));
        }

        var orders = await _db.PurchaseOrders
            .Include(o => o.OrderItems)
            .Where(o => purchaseOrderIds.Contains(o.Id))
            .ToListAsync(ct);

        if (orders.Count != purchaseOrderIds.Distinct().Count())
        {
            throw new ArgumentException("มีออเดอร์ที่ไม่พบในรายการ", nameof(purchaseOrderIds));
        }

        var notPaidByStaff = orders.Where(o => o.Status != PurchaseOrderStatus.PaidByStaff).ToList();
        if (notPaidByStaff.Count > 0)
        {
            throw new InvalidOperationException(
                $"ออเดอร์ #{string.Join(", ", notPaidByStaff.Select(o => o.PlatformOrderNo))} ยังไม่ได้ mark-paid หรือถูกเบิกไปแล้ว");
        }

        var totalAmount = orders.Sum(o => o.OrderItems
            .Where(i => i.Status != OrderItemStatus.Cancelled)
            .Sum(i => i.Qty * i.UnitPrice));

        var reimbursement = new Reimbursement
        {
            RequestedByUserId = requestedByUserId,
            Status = ReimbursementStatus.Pending,
            TotalAmount = totalAmount,
            RequestedAt = DateTime.UtcNow,
            PurchaseOrders = orders,
        };
        _db.Reimbursements.Add(reimbursement);
        await _db.SaveChangesAsync(ct);
        return reimbursement;
    }

    public async Task<Reimbursement> ApproveAsync(int reimbursementId, CancellationToken ct)
    {
        var reimbursement = await GetTrackedAsync(reimbursementId, ct);
        if (reimbursement.Status != ReimbursementStatus.Pending)
        {
            throw new InvalidOperationException($"Reimbursement นี้อยู่ในสถานะ {reimbursement.Status} แล้ว ไม่ใช่ Pending");
        }

        reimbursement.Status = ReimbursementStatus.Approved;
        reimbursement.ApprovedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return reimbursement;
    }

    public async Task<Reimbursement> PayAsync(int reimbursementId, CancellationToken ct)
    {
        var reimbursement = await GetTrackedAsync(reimbursementId, ct);
        if (reimbursement.Status != ReimbursementStatus.Approved)
        {
            throw new InvalidOperationException($"Reimbursement นี้อยู่ในสถานะ {reimbursement.Status} แล้ว ต้อง Approved ก่อนจ่ายได้");
        }

        reimbursement.Status = ReimbursementStatus.Paid;
        reimbursement.PaidAt = DateTime.UtcNow;
        foreach (var order in reimbursement.PurchaseOrders)
        {
            order.Status = PurchaseOrderStatus.Reimbursed;
        }

        _db.StaffLedgerEntries.Add(new StaffLedgerEntry
        {
            UserId = reimbursement.RequestedByUserId,
            EntryType = StaffLedgerEntryType.Reimbursed,
            Amount = -reimbursement.TotalAmount,
            RelatedReimbursementId = reimbursement.Id,
            Note = $"บริษัทจ่ายคืนตามคำขอเบิก #{reimbursement.Id}",
        });

        await _db.SaveChangesAsync(ct);
        return reimbursement;
    }

    private async Task<Reimbursement> GetTrackedAsync(int id, CancellationToken ct) =>
        await _db.Reimbursements
            .Include(r => r.PurchaseOrders)
            .FirstOrDefaultAsync(r => r.Id == id, ct)
        ?? throw new KeyNotFoundException($"ไม่พบ reimbursement id={id}");
}
