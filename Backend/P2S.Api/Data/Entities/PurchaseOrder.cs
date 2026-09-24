namespace P2S.Api.Data.Entities;

/// <summary>One record per single order placed on a platform (SP/TT/AM), with its actual payer and amount recorded when paid.</summary>
public class PurchaseOrder
{
    public int Id { get; set; }
    public int PlatformId { get; set; }
    public Platform Platform { get; set; } = null!;
    public int OrderedByUserId { get; set; }
    public User OrderedByUser { get; set; } = null!;

    /// <summary>Order number as shown in the platform's own app — unique within its platform.</summary>
    public string PlatformOrderNo { get; set; } = null!;
    public decimal TotalAmount { get; set; }
    public decimal? ActualPaidAmount { get; set; }
    public PaymentSource? PaymentSource { get; set; }
    public int? PaymentPayerUserId { get; set; }
    public User? PaymentPayerUser { get; set; }
    public int? PaymentRecordedByUserId { get; set; }
    public User? PaymentRecordedByUser { get; set; }
    public DateTime? PaidAt { get; set; }
    public byte[]? PaymentEvidence { get; set; }
    public string? PaymentEvidenceContentType { get; set; }
    public string? PaymentEvidenceFileName { get; set; }
    public uint RowVersion { get; set; }
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Ordered;
    public DateTime OrderedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public ICollection<StaffLedgerEntry> StaffLedgerEntries { get; set; } = new List<StaffLedgerEntry>();
}
