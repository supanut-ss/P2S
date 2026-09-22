namespace P2S.Api.Data.Entities;

/// <summary>One record per single order placed on a platform (SP/TT/AM), paid up front by the staff member's own card.</summary>
public class PurchaseOrder
{
    public int Id { get; set; }
    public int PlatformId { get; set; }
    public Platform Platform { get; set; } = null!;
    public int OrderedByUserId { get; set; }
    public User OrderedByUser { get; set; } = null!;

    /// <summary>Order number as shown in the platform's own app — not unique across platforms, so never used alone as a key.</summary>
    public string PlatformOrderNo { get; set; } = null!;
    public decimal TotalAmount { get; set; }
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Ordered;
    public DateTime OrderedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public ICollection<StaffLedgerEntry> StaffLedgerEntries { get; set; } = new List<StaffLedgerEntry>();
}
