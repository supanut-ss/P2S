using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public class DailyFinanceSnapshotService : IDailyFinanceSnapshotService
{
    private readonly P2SDbContext _db;

    public DailyFinanceSnapshotService(P2SDbContext db)
    {
        _db = db;
    }

    public async Task<DailyFinanceSnapshot> ComputeAndSaveAsync(DateOnly businessDate, CancellationToken cancellationToken)
    {
        // Timestamps are stored as UTC; convert the Asia/Bangkok business-date window to a
        // UTC range for the query rather than converting each stored value per-row.
        var utcRangeStart = businessDate.ToDateTime(TimeOnly.MinValue) - BangkokClock.Offset;
        var utcRangeEnd = utcRangeStart.AddDays(1);

        var totalOrderedAmount = await _db.PurchaseOrders
            .Where(o => o.OrderedAt >= utcRangeStart && o.OrderedAt < utcRangeEnd)
            .SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        // "Outstanding" reimbursement — a running balance as of this snapshot, not scoped to
        // orders placed on this particular day (a reimbursement can bundle older orders).
        var totalReimbursementPending = await _db.Reimbursements
            .Where(r => r.Status != ReimbursementStatus.Paid)
            .SumAsync(r => (decimal?)r.TotalAmount, cancellationToken) ?? 0m;

        // Rounded explicitly: MySQL widens the scale of SUM(int * decimal(18,2)) beyond 2
        // decimal places, and since this value is read straight back off the entity after
        // SaveChangesAsync (not re-queried from the DB, which would apply the column's
        // HasPrecision(18,2) truncation), the oversized scale would otherwise leak into the
        // API response the very first time this runs in a request/response cycle.
        var totalInventoryValueToday = Math.Round(
            await _db.InventoryItems
                .Where(i => i.ReceivedAt >= utcRangeStart && i.ReceivedAt < utcRangeEnd)
                .SumAsync(i => (decimal?)(i.QtyReceived * i.CostPerUnit), cancellationToken) ?? 0m,
            2);

        // Open cancellations are a running count too — "cases not yet cleared", not scoped
        // to cancellations flagged specifically today.
        var openCancellationsCount = await _db.Cancellations
            .CountAsync(c => c.Status == CancellationStatus.RefundPending, cancellationToken);

        var snapshot = await _db.DailyFinanceSnapshots
            .FirstOrDefaultAsync(s => s.SnapshotDate == businessDate, cancellationToken);

        if (snapshot is null)
        {
            snapshot = new DailyFinanceSnapshot { SnapshotDate = businessDate };
            _db.DailyFinanceSnapshots.Add(snapshot);
        }

        snapshot.TotalOrderedAmount = totalOrderedAmount;
        snapshot.TotalReimbursementPending = totalReimbursementPending;
        snapshot.TotalInventoryValueToday = totalInventoryValueToday;
        snapshot.OpenCancellationsCount = openCancellationsCount;

        await _db.SaveChangesAsync(cancellationToken);
        return snapshot;
    }
}
