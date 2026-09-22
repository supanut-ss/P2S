using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public interface IDailyFinanceSnapshotService
{
    /// <summary>Computes and upserts the snapshot row for the given Asia/Bangkok business date.</summary>
    Task<DailyFinanceSnapshot> ComputeAndSaveAsync(DateOnly businessDate, CancellationToken cancellationToken);
}
