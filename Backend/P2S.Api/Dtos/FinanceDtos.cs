namespace P2S.Api.Dtos;

public record DailyFinanceSnapshotResponse(
    DateOnly SnapshotDate,
    decimal TotalOrderedAmount,
    decimal TotalReimbursementPending,
    decimal TotalInventoryValueToday,
    int OpenCancellationsCount
);
