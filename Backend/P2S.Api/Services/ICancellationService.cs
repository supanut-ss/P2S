using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public interface ICancellationService
{
    /// <summary>Called when an order item is cancelled by the shop. Only creates a
    /// Cancellation + RefundDue ledger entry when the order had already been reimbursed
    /// (money already left the company's pocket via reimbursement AND landed back on the
    /// staff member's own card via the shop's refund — the staff member now owes it back).
    /// If the order was only PaidByStaff (not yet reimbursed), nothing has actually left the
    /// company yet, so there's nothing to claw back — the item is simply excluded from future
    /// reimbursement requests (see ReimbursementService), no ledger entry needed.</summary>
    Task FlagFromOrderItemCancellationAsync(OrderItem orderItem, CancellationToken ct);

    Task<Cancellation> ResolveAsync(int cancellationId, CancellationStatus outcome, CancellationToken ct);
}
