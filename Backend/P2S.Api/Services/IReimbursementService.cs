using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public interface IReimbursementService
{
    /// <summary>Bundles the given purchase orders into a new Pending reimbursement. The total
    /// is based on actual paid amounts, less settled refunds, and is blocked while refunds are
    /// pending; item quantities are used only as a legacy fallback when actual payment is unknown.</summary>
    Task<Reimbursement> CreateAsync(int requestedByUserId, List<int> purchaseOrderIds, CancellationToken ct);

    Task<Reimbursement> ApproveAsync(int reimbursementId, CancellationToken ct, int? approvedByUserId = null);

    Task<Reimbursement> CorrectOrderPaymentAmountAsync(
        int reimbursementId,
        int purchaseOrderId,
        decimal actualPaidAmount,
        string reason,
        int correctedByUserId,
        CancellationToken ct);

    /// <summary>Marks Paid, flips every linked purchase order to Reimbursed, and records one
    /// Reimbursed ledger entry (negative — settles the earlier AdvancePaid entries).</summary>
    Task<Reimbursement> PayAsync(int reimbursementId, CancellationToken ct, int? paidByUserId = null);
}
