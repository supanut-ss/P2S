namespace P2S.Api.Data.Entities;

public class PurchaseOrderPaymentCorrection
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    public int ReimbursementId { get; set; }

    public decimal PreviousActualPaidAmount { get; set; }
    public decimal CorrectedActualPaidAmount { get; set; }
    public ReimbursementStatus PreviousRequestStatus { get; set; }
    public int? PreviousApprovedByUserId { get; set; }
    public User? PreviousApprovedByUser { get; set; }
    public DateTime? PreviousApprovedAt { get; set; }

    public int CorrectedByUserId { get; set; }
    public User CorrectedByUser { get; set; } = null!;
    public DateTime CorrectedAt { get; set; } = DateTime.UtcNow;
    public string Reason { get; set; } = string.Empty;
}
