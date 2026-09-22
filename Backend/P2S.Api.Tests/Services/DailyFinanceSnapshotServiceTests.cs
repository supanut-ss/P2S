using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Services;

namespace P2S.Api.Tests.Services;

public class DailyFinanceSnapshotServiceTests
{
    private static P2SDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var context = new P2SDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    private static DateTime BangkokToUtc(DateOnly date, int hour) =>
        date.ToDateTime(new TimeOnly(hour, 0)) - BangkokClock.Offset;

    [Fact]
    public async Task ComputeAndSaveAsync_SumsOnlyOrdersPlacedOnTheBusinessDate()
    {
        await using var db = CreateContext();
        var businessDate = new DateOnly(2026, 3, 10);

        db.PurchaseOrders.AddRange(
            new PurchaseOrder { PlatformId = 1, OrderedByUserId = 1, PlatformOrderNo = "A", TotalAmount = 100m, OrderedAt = BangkokToUtc(businessDate, 9) },
            new PurchaseOrder { PlatformId = 1, OrderedByUserId = 1, PlatformOrderNo = "B", TotalAmount = 250m, OrderedAt = BangkokToUtc(businessDate, 23) },
            // Just past midnight Bangkok time the next day — must NOT be counted in businessDate's total.
            new PurchaseOrder { PlatformId = 1, OrderedByUserId = 1, PlatformOrderNo = "C", TotalAmount = 999m, OrderedAt = BangkokToUtc(businessDate.AddDays(1), 0).AddMinutes(1) }
        );
        await db.SaveChangesAsync();

        var service = new DailyFinanceSnapshotService(db);
        var snapshot = await service.ComputeAndSaveAsync(businessDate, CancellationToken.None);

        Assert.Equal(350m, snapshot.TotalOrderedAmount);
    }

    [Fact]
    public async Task ComputeAndSaveAsync_ReimbursementPending_ExcludesPaidOnes()
    {
        await using var db = CreateContext();
        db.Users.Add(new User { Id = 100, Username = "u1", PasswordHash = "x", FullName = "U1", RoleId = 1 });
        db.Reimbursements.AddRange(
            new Reimbursement { RequestedByUserId = 100, Status = ReimbursementStatus.Pending, TotalAmount = 500m },
            new Reimbursement { RequestedByUserId = 100, Status = ReimbursementStatus.Approved, TotalAmount = 300m },
            new Reimbursement { RequestedByUserId = 100, Status = ReimbursementStatus.Paid, TotalAmount = 1000m }
        );
        await db.SaveChangesAsync();

        var service = new DailyFinanceSnapshotService(db);
        var snapshot = await service.ComputeAndSaveAsync(new DateOnly(2026, 3, 10), CancellationToken.None);

        Assert.Equal(800m, snapshot.TotalReimbursementPending);
    }

    [Fact]
    public async Task ComputeAndSaveAsync_CalledTwiceForSameDate_UpsertsRatherThanDuplicating()
    {
        await using var db = CreateContext();
        var businessDate = new DateOnly(2026, 3, 10);
        var service = new DailyFinanceSnapshotService(db);

        await service.ComputeAndSaveAsync(businessDate, CancellationToken.None);

        db.PurchaseOrders.Add(new PurchaseOrder { PlatformId = 1, OrderedByUserId = 1, PlatformOrderNo = "A", TotalAmount = 42m, OrderedAt = BangkokToUtc(businessDate, 10) });
        await db.SaveChangesAsync();

        await service.ComputeAndSaveAsync(businessDate, CancellationToken.None);

        var rows = await db.DailyFinanceSnapshots.Where(s => s.SnapshotDate == businessDate).ToListAsync();
        Assert.Single(rows);
        Assert.Equal(42m, rows[0].TotalOrderedAmount);
    }

    [Fact]
    public async Task ComputeAndSaveAsync_CountsOnlyRefundPendingCancellations()
    {
        await using var db = CreateContext();
        // Ids offset well clear of the seeded rows (Role/User/Platform/WithdrawalReason all
        // seed at Id 1-4 via SeedData) to avoid an InMemory-provider duplicate-key collision.
        db.Products.Add(new Product { Id = 501, Name = "P", SkuCode = "SKU1" });
        db.Users.Add(new User { Id = 501, Username = "u", PasswordHash = "x", FullName = "U", RoleId = 1 });
        db.PurchaseOrders.Add(new PurchaseOrder { Id = 501, PlatformId = 1, OrderedByUserId = 501, PlatformOrderNo = "A", TotalAmount = 10m });
        db.OrderItems.AddRange(
            new OrderItem { Id = 501, PurchaseOrderId = 501, ProductId = 501, Qty = 1, UnitPrice = 10m },
            new OrderItem { Id = 502, PurchaseOrderId = 501, ProductId = 501, Qty = 1, UnitPrice = 10m },
            new OrderItem { Id = 503, PurchaseOrderId = 501, ProductId = 501, Qty = 1, UnitPrice = 10m }
        );
        db.Cancellations.AddRange(
            new Cancellation { OrderItemId = 501, Status = CancellationStatus.RefundPending },
            new Cancellation { OrderItemId = 502, Status = CancellationStatus.RefundPending },
            new Cancellation { OrderItemId = 503, Status = CancellationStatus.Refunded }
        );
        await db.SaveChangesAsync();

        var service = new DailyFinanceSnapshotService(db);
        var snapshot = await service.ComputeAndSaveAsync(new DateOnly(2026, 3, 10), CancellationToken.None);

        Assert.Equal(2, snapshot.OpenCancellationsCount);
    }
}
