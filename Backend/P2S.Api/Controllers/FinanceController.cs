using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
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

    [HttpGet("staff-balances")]
    [Authorize(Roles = "finance,admin")]
    public async Task<ActionResult<List<StaffBalanceResponse>>> GetStaffBalances(CancellationToken cancellationToken)
    {
        var balances = await _db.StaffLedgerEntries
            .GroupBy(entry => new { entry.UserId, entry.User.Username, entry.User.FullName })
            .Select(group => new StaffBalanceResponse(
                group.Key.UserId,
                group.Key.Username,
                group.Key.FullName,
                group.Sum(entry => entry.Amount),
                group.Sum(entry => entry.EntryType == StaffLedgerEntryType.AdvancePaid ? entry.Amount : 0m),
                group.Sum(entry => entry.EntryType == StaffLedgerEntryType.Reimbursed ? -entry.Amount : 0m),
                group.Sum(entry => entry.EntryType == StaffLedgerEntryType.RefundDue || entry.EntryType == StaffLedgerEntryType.RefundSettled ? -entry.Amount : 0m),
                group.Sum(entry => entry.EntryType == StaffLedgerEntryType.Adjustment ? entry.Amount : 0m)))
            .OrderByDescending(balance => balance.Balance)
            .ToListAsync(cancellationToken);

        return Ok(balances);
    }
}
