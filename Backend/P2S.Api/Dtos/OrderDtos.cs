namespace P2S.Api.Dtos;

public record CreateOrderItemRequest(int ProductId, int Qty, decimal UnitPrice);
public record CreateOrderRequest(int PlatformId, string PlatformOrderNo, List<CreateOrderItemRequest> Items);

public record OrderItemResponse(
    int Id,
    int ProductId,
    string ProductName,
    int Qty,
    decimal UnitPrice,
    string Status,
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
    List<OrderItemResponse> Items
);

public record SetTrackingRequest(string TrackingNo, string? Courier);
