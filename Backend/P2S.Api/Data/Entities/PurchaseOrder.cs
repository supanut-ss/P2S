namespace P2S.Api.Data.Entities;

/// <summary>One platform order, with its planned payment routing and actual payment recorded separately.</summary>
public class PurchaseOrder
{
    public int Id { get; set; }
    public int PlatformId { get; set; }
    public Platform Platform { get; set; } = null!;
    public int OrderedByUserId { get; set; }
    public User OrderedByUser { get; set; } = null!;

    /// <summary>Order number as shown in the platform's own app — unique within its platform.</summary>
    public string PlatformOrderNo { get; set; } = null!;
    public string? PackageName { get; set; }
    public string? ShopName { get; set; }
    public string? TrackingNo { get; set; }
    public string? Courier { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal? ActualPaidAmount { get; set; }
    public PaymentSource? PlannedPaymentSource { get; set; }
    public int? PlannedPaymentPayerUserId { get; set; }
    public User? PlannedPaymentPayerUser { get; set; }
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
    public ICollection<GoodsReceiptEvent> GoodsReceiptEvents { get; set; } = new List<GoodsReceiptEvent>();
}
