using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public interface IReimbursementService
{
    /// <summary>Bundles the given purchase orders into a new Pending reimbursement. The total
    /// is computed as SUM(qty * unitPrice) over each order's non-Cancelled items — not the
    /// order's own TotalAmount — so a partially-cancelled order doesn't overclaim; see
    /// PROJECT-PLAN.md section 2.2 on why cancellations don't just adjust TotalAmount directly.</summary>
    Task<Reimbursement> CreateAsync(int requestedByUserId, List<int> purchaseOrderIds, CancellationToken ct);

    Task<Reimbursement> ApproveAsync(int reimbursementId, CancellationToken ct);

    /// <summary>Marks Paid, flips every linked purchase order to Reimbursed, and records one
    /// Reimbursed ledger entry (negative — settles the earlier AdvancePaid entries).</summary>
    Task<Reimbursement> PayAsync(int reimbursementId, CancellationToken ct);
}
