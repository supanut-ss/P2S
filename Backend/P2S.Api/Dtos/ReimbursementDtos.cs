namespace P2S.Api.Dtos;

public record CreateReimbursementRequest(List<int> PurchaseOrderIds);

public record ReimbursementResponse(
    int Id,
    int RequestedByUserId,
    string RequestedByUsername,
    string Status,
    decimal TotalAmount,
    DateTime RequestedAt,
    DateTime? ApprovedAt,
    DateTime? PaidAt,
    List<int> PurchaseOrderIds
);
