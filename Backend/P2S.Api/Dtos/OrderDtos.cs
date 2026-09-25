namespace P2S.Api.Dtos;

public record CreateOrderItemRequest(
    int ProductId,
    int Qty,
    decimal UnitPrice,
    string? Model = null,
    string? Description = null);
public record CreateOrderRequest(
    int PlatformId,
    string PlatformOrderNo,
    string PlannedPaymentSource,
    int? PlannedPaymentPayerUserId,
    List<CreateOrderItemRequest> Items,
    string? PackageName = null,
    string? ShopName = null);

public record OrderItemResponse(
    int Id,
    int ProductId,
    string ProductName,
    string? Model,
    string? Description,
    int Qty,
    decimal UnitPrice,
    string Status,
    int ReturnedQty,
    DateTime? ArrivedAt,
    DateTime? CancelledAt
);

public record PurchaseOrderResponse(
    int Id,
    string PlatformCode,
    string PlatformOrderNo,
    string? PackageName,
    string? ShopName,
    string? TrackingNo,
    string? Courier,
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

public record SetTrackingRequest(string? TrackingNo, string? Courier);

public sealed class MarkOrderPaidRequest
{
    public string PaymentSource { get; set; } = string.Empty;
    public decimal ActualPaidAmount { get; set; }
    public int? PaymentPayerUserId { get; set; }
    public IFormFile? Evidence { get; set; }
}
