namespace P2S.Api.Services;

/// <summary>
/// Runs the daily finance snapshot once per day at the 23:59 Asia/Bangkok business-date
/// cutoff (PROJECT-PLAN.md's stated cutoff). A single long-lived BackgroundService with a
/// computed delay is used instead of Hangfire — one daily job doesn't need a job scheduler
/// with persistence/retry UI, and it avoids adding a dependency + its own DB tables.
/// </summary>
public class DailyFinanceSnapshotBackgroundService : BackgroundService
{
    private static readonly TimeSpan CutoffTimeOfDay = new(23, 59, 0);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DailyFinanceSnapshotBackgroundService> _logger;

    public DailyFinanceSnapshotBackgroundService(IServiceScopeFactory scopeFactory, ILogger<DailyFinanceSnapshotBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeUntilNextCutoff();
            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            try
            {
                var businessDate = BangkokClock.TodayBusinessDate();
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IDailyFinanceSnapshotService>();
                await service.ComputeAndSaveAsync(businessDate, stoppingToken);
                _logger.LogInformation("Daily finance snapshot computed for {BusinessDate}", businessDate);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // A missed/failed snapshot for one day must not take the whole background
                // service down — log and retry on the next cutoff.
                _logger.LogError(ex, "Daily finance snapshot run failed");
            }
        }
    }

    private static TimeSpan TimeUntilNextCutoff()
    {
        var nowBangkok = BangkokClock.UtcNowToBangkok();
        var todayCutoff = nowBangkok.Date + CutoffTimeOfDay;
        var nextCutoff = nowBangkok < todayCutoff ? todayCutoff : todayCutoff.AddDays(1);
        return nextCutoff - nowBangkok;
    }
}
