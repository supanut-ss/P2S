namespace P2S.Api.Data.Entities;

/// <summary>A shop-side cancellation after the item was already paid for / reimbursed — flags finance to claw back or refund, without touching inventory (the item never arrived, so it was never stocked).</summary>
public class Cancellation
{
    public int Id { get; set; }
    public int OrderItemId { get; set; }
    public OrderItem OrderItem { get; set; } = null!;

    /// <summary>Null when the purchase order hadn't been reimbursed yet at cancellation time — nothing to claw back.</summary>
    public int? ReimbursementId { get; set; }
    public Reimbursement? Reimbursement { get; set; }

    public CancellationStatus Status { get; set; } = CancellationStatus.RefundPending;
    public DateTime FlaggedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
    public string? Note { get; set; }

    public ICollection<StaffLedgerEntry> StaffLedgerEntries { get; set; } = new List<StaffLedgerEntry>();
}
