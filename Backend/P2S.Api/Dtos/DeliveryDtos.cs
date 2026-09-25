namespace P2S.Api.Dtos;

public record PendingOrderItemResponse(
    int OrderItemId,
    int PurchaseOrderId,
    string PlatformCode,
    string PlatformOrderNo,
    string ProductName,
    int Qty,
    int ReceivedQty,
    int RemainingQty,
    decimal UnitPrice,
    string Status
);

public record GoodsReceiptOrderResponse(
    int PurchaseOrderId,
    string PlatformCode,
    string PlatformOrderNo,
    string? PackageName,
    string? ShopName,
    DateTime OrderedAt,
    List<GoodsReceiptOrderLineResponse> Items,
    List<GoodsReceiptEventResponse> ReceiptHistory
);

public record GoodsReceiptOrderLineResponse(
    int OrderItemId,
    string ProductName,
    string SkuCode,
    string? Model,
    string? TrackingNo,
    DateTime? ArrivedAt,
    string? Description,
    int Qty,
    int ReceivedQty,
    int RemainingQty,
    decimal UnitPrice,
    string Status
);

public record GoodsReceiptEventResponse(
    int Id,
    string EventType,
    DateTime OccurredAt,
    string ActorUsername,
    int LineCount,
    int UnitCount,
    string? Reason,
    bool IsReversed,
    int? ReversesEventId,
    List<GoodsReceiptHistoryLineResponse> Lines
);

public record GoodsReceiptHistoryLineResponse(string ProductName, string SkuCode, int Quantity, decimal UnitPrice);

public record ReceiveGoodsRequest(int PurchaseOrderId, List<ReceiveGoodsLineRequest> Lines);

public record ReceiveGoodsLineRequest(int OrderItemId, int Quantity);

public record ReverseGoodsReceiptRequest(string? Reason);

public record ConfirmArrivedRequest(string ScannedCode, string MatchMethod);

public record CancelOrderItemRequest(string? Note, decimal? RefundAmount = null);
