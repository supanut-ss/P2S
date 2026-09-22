namespace P2S.Api.Dtos;

public record InventoryItemResponse(
    int Id,
    int ProductId,
    string ProductName,
    string SkuCode,
    int QtyReceived,
    int QtyOnHand,
    decimal CostPerUnit,
    string Status,
    DateTime ReceivedAt
);

public record WithdrawRequest(int Qty, int WithdrawalReasonId, string? Note);

public record InventoryWithdrawalResponse(int Id, int InventoryItemId, int Qty, DateTime WithdrawnAt);
