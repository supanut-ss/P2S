namespace P2S.Api.Data.Entities;

/// <summary>A cancellation or supplier return case that tracks the affected quantity and refund through finance resolution.</summary>
public class Cancellation
{
    public int Id { get; set; }
    public int OrderItemId { get; set; }
    public OrderItem OrderItem { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal RefundAmount { get; set; }
    public int? ReportedByUserId { get; set; }
    public User? ReportedByUser { get; set; }

    /// <summary>Null when the purchase order hadn't been reimbursed yet at cancellation time — nothing to claw back.</summary>
    public int? ReimbursementId { get; set; }
    public Reimbursement? Reimbursement { get; set; }

    public CancellationStatus Status { get; set; } = CancellationStatus.RefundPending;
    public DateTime FlaggedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
    public int? ResolvedByUserId { get; set; }
    public User? ResolvedByUser { get; set; }
    public string? Note { get; set; }
    public uint RowVersion { get; set; }

    public ICollection<StaffLedgerEntry> StaffLedgerEntries { get; set; } = new List<StaffLedgerEntry>();
}
