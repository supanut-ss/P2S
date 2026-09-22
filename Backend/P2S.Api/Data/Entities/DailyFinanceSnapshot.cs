namespace P2S.Api.Data.Entities;

/// <summary>One row per day, written by the scheduled snapshot job. SnapshotDate is the Asia/Bangkok business date the cutoff (23:59 local) closed.</summary>
public class DailyFinanceSnapshot
{
    public int Id { get; set; }
    public DateOnly SnapshotDate { get; set; }

    public decimal TotalOrderedAmount { get; set; }
    public decimal TotalReimbursementPending { get; set; }
    public decimal TotalInventoryValueToday { get; set; }
    public int OpenCancellationsCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
