namespace P2S.Api.Dtos;

/// <summary>A pending order item as shown on the scan-receiving screen — enough context for
/// staff to recognize "yes, this is the box in front of me" without opening the full order.</summary>
public record PendingOrderItemResponse(
    int OrderItemId,
    int PurchaseOrderId,
    string PlatformCode,
    string PlatformOrderNo,
    string ProductName,
    int Qty,
    decimal UnitPrice,
    string? TrackingNo,
    string? Courier
);

public record ScanMatchRequest(string ScannedCode);

public record ConfirmArrivedRequest(string ScannedCode, string MatchMethod);

public record CancelOrderItemRequest(string? Note);
