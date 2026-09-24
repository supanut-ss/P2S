namespace P2S.Api.Dtos;

public record CreateOrderItemRequest(int ProductId, int Qty, decimal UnitPrice);
public record CreateOrderRequest(
    int PlatformId,
    string PlatformOrderNo,
    string PlannedPaymentSource,
    int? PlannedPaymentPayerUserId,
    List<CreateOrderItemRequest> Items);

public record OrderItemResponse(
    int Id,
    int ProductId,
    string ProductName,
    int Qty,
    decimal UnitPrice,
    string Status,
    int ReturnedQty,
    string? TrackingNo,
    string? Courier,
    DateTime? ArrivedAt,
    DateTime? CancelledAt
);

public record PurchaseOrderResponse(
    int Id,
    string PlatformCode,
    string PlatformOrderNo,
    decimal TotalAmount,
    string Status,
    DateTime OrderedAt,
    int OrderedByUserId,
    string OrderedByUsername,
    decimal? ActualPaidAmount,
    decimal? ReimbursableAmount,
    string? PaymentSource,
    int? PaymentPayerUserId,
    string? PaymentPayerUsername,
    string? PaymentRecordedByUsername,
    DateTime? PaidAt,
    bool HasPaymentEvidence,
    string? PlannedPaymentSource,
    int? PlannedPaymentPayerUserId,
    string? PlannedPaymentPayerUsername,
    List<OrderItemResponse> Items
);

public record SetTrackingRequest(string TrackingNo, string? Courier);

public sealed class MarkOrderPaidRequest
{
    public string PaymentSource { get; set; } = string.Empty;
    public decimal ActualPaidAmount { get; set; }
    public int? PaymentPayerUserId { get; set; }
    public IFormFile? Evidence { get; set; }
}
