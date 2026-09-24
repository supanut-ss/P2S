namespace P2S.Api.Dtos;

public record CancellationResponse(
    int Id,
    int OrderItemId,
    string ProductName,
    int PurchaseOrderId,
    string PlatformCode,
    string PlatformOrderNo,
    string RequestedByUsername,
    string? ReportedByUsername,
    string? ResolvedByUsername,
    int Quantity,
    decimal RefundAmount,
    int? ReimbursementId,
    string Status,
    DateTime FlaggedAt,
    DateTime? ResolvedAt,
    string? Note
);

/// <summary>Outcome must be "Refunded" or "Adjusted" — RefundPending is the starting state,
/// never a resolution.</summary>
public record ResolveCancellationRequest(string Outcome);

public record CreateSupplierReturnRequest(int InventoryItemId, int Quantity, decimal RefundAmount, string? Note);
