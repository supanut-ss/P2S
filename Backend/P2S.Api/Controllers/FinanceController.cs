using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FinanceController : ControllerBase
{
    private readonly P2SDbContext _db;
    private readonly IDailyFinanceSnapshotService _snapshotService;

    public FinanceController(P2SDbContext db, IDailyFinanceSnapshotService snapshotService)
    {
        _db = db;
        _snapshotService = snapshotService;
    }

    /// <summary>Latest computed snapshot — what the Dashboard screen (section 4) renders.</summary>
    [HttpGet("snapshot/latest")]
    public async Task<ActionResult<DailyFinanceSnapshotResponse>> GetLatest(CancellationToken cancellationToken)
    {
        var snapshot = await _db.DailyFinanceSnapshots
            .OrderByDescending(s => s.SnapshotDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (snapshot is null) return NotFound();

        return Ok(new DailyFinanceSnapshotResponse(
            snapshot.SnapshotDate,
            snapshot.TotalOrderedAmount,
            snapshot.TotalReimbursementPending,
            snapshot.TotalInventoryValueToday,
            snapshot.OpenCancellationsCount));
    }

    /// <summary>
    /// Admin-only manual trigger — the snapshot otherwise only runs at the 23:59 Bangkok
    /// cutoff via DailyFinanceSnapshotBackgroundService, so this is the only way to
    /// refresh it on demand (ops asking "why does today's number look wrong" and testing).
    /// </summary>
    [HttpPost("snapshot/run")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<DailyFinanceSnapshotResponse>> RunNow(CancellationToken cancellationToken)
    {
        var businessDate = BangkokClock.TodayBusinessDate();
        var snapshot = await _snapshotService.ComputeAndSaveAsync(businessDate, cancellationToken);

        return Ok(new DailyFinanceSnapshotResponse(
            snapshot.SnapshotDate,
            snapshot.TotalOrderedAmount,
            snapshot.TotalReimbursementPending,
            snapshot.TotalInventoryValueToday,
            snapshot.OpenCancellationsCount));
    }
}
