namespace P2S.Api.Data.Entities;

/// <summary>A cash reimbursement request bundling one or more purchase orders — tracked independently of the inventory flow.</summary>
public class Reimbursement
{
    public int Id { get; set; }
    public int RequestedByUserId { get; set; }
    public User RequestedByUser { get; set; } = null!;

    public ReimbursementStatus Status { get; set; } = ReimbursementStatus.Pending;
    public decimal TotalAmount { get; set; }

    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAt { get; set; }
    public DateTime? PaidAt { get; set; }

    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
    public ICollection<Cancellation> Cancellations { get; set; } = new List<Cancellation>();
    public ICollection<StaffLedgerEntry> StaffLedgerEntries { get; set; } = new List<StaffLedgerEntry>();
}
