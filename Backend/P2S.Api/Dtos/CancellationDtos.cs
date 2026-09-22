namespace P2S.Api.Dtos;

public record CancellationResponse(
    int Id,
    int OrderItemId,
    string ProductName,
    int? ReimbursementId,
    string Status,
    DateTime FlaggedAt,
    DateTime? ResolvedAt,
    string? Note
);

/// <summary>Outcome must be "Refunded" or "Adjusted" — RefundPending is the starting state,
/// never a resolution.</summary>
public record ResolveCancellationRequest(string Outcome);
