namespace P2S.Api.Data.Entities;

/// <summary>One line in a staff member's running balance with the company — the only place that answers "who owes what right now".
/// Positive amounts = company owes staff (advance paid), negative = staff owes company (refund landed on their own card after a cancellation).</summary>
public class StaffLedgerEntry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public StaffLedgerEntryType EntryType { get; set; }
    public decimal Amount { get; set; }

    public int? RelatedPurchaseOrderId { get; set; }
    public PurchaseOrder? RelatedPurchaseOrder { get; set; }
    public int? RelatedReimbursementId { get; set; }
    public Reimbursement? RelatedReimbursement { get; set; }
    public int? RelatedCancellationId { get; set; }
    public Cancellation? RelatedCancellation { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
