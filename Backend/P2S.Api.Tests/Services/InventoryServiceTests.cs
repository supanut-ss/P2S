using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Services;

namespace P2S.Api.Tests.Services;

public class InventoryServiceTests
{
    private static P2SDbContext CreateContext(string? dbName = null)
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(dbName ?? Guid.NewGuid().ToString())
            .Options;
        var context = new P2SDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    private static async Task<(Product product, OrderItem orderItem)> SeedPendingOrderItemAsync(P2SDbContext db)
    {
        var product = new Product { Name = "เคสมือถือ", SkuCode = "SKU-TEST-1", Unit = "ชิ้น" };
        db.Products.Add(product);
        var user = new User { Username = "seedstaff", PasswordHash = "x", FullName = "Seed Staff", RoleId = 1 };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "ORD-1", TotalAmount = 100m };
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var orderItem = new OrderItem { PurchaseOrderId = order.Id, ProductId = product.Id, Qty = 10, UnitPrice = 10m, Status = OrderItemStatus.Pending };
        db.OrderItems.Add(orderItem);
        await db.SaveChangesAsync();

        return (product, orderItem);
    }

    [Fact]
    public async Task ReceiveAsync_CreatesLotAndMarksOrderItemArrived()
    {
        await using var db = CreateContext();
        var (_, orderItem) = await SeedPendingOrderItemAsync(db);

        var service = new InventoryService(db);
        var lot = await service.ReceiveAsync(orderItem, CancellationToken.None);

        Assert.Equal(10, lot.QtyReceived);
        Assert.Equal(10, lot.QtyOnHand);
        Assert.Equal(InventoryItemStatus.InStock, lot.Status);
        Assert.Equal(OrderItemStatus.Arrived, orderItem.Status);
        Assert.NotNull(orderItem.ArrivedAt);
    }

    [Fact]
    public async Task WithdrawAsync_ReducesQtyOnHand_AndFlipsToDepletedAtZero()
    {
        await using var db = CreateContext();
        var (_, orderItem) = await SeedPendingOrderItemAsync(db);
        var service = new InventoryService(db);
        var lot = await service.ReceiveAsync(orderItem, CancellationToken.None);

        db.WithdrawalReasons.Add(new WithdrawalReason { Id = 501, Name = "test reason" });
        db.Users.Add(new User { Id = 502, Username = "withdrawer", PasswordHash = "x", FullName = "W", RoleId = 1 });
        await db.SaveChangesAsync();

        await service.WithdrawAsync(lot.Id, 4, 501, 502, "test withdraw", CancellationToken.None);
        var afterFirst = await db.InventoryItems.FindAsync(lot.Id);
        Assert.Equal(6, afterFirst!.QtyOnHand);
        Assert.Equal(InventoryItemStatus.InStock, afterFirst.Status);

        await service.WithdrawAsync(lot.Id, 6, 501, 502, null, CancellationToken.None);
        var afterSecond = await db.InventoryItems.FindAsync(lot.Id);
        Assert.Equal(0, afterSecond!.QtyOnHand);
        Assert.Equal(InventoryItemStatus.Depleted, afterSecond.Status);
    }

    [Fact]
    public async Task WithdrawAsync_ThrowsInsufficientStock_RatherThanGoingNegative()
    {
        await using var db = CreateContext();
        var (_, orderItem) = await SeedPendingOrderItemAsync(db);
        var service = new InventoryService(db);
        var lot = await service.ReceiveAsync(orderItem, CancellationToken.None);

        db.WithdrawalReasons.Add(new WithdrawalReason { Id = 601, Name = "test reason" });
        db.Users.Add(new User { Id = 602, Username = "withdrawer2", PasswordHash = "x", FullName = "W2", RoleId = 1 });
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InsufficientStockException>(
            () => service.WithdrawAsync(lot.Id, 11, 601, 602, null, CancellationToken.None));

        var unchanged = await db.InventoryItems.FindAsync(lot.Id);
        Assert.Equal(10, unchanged!.QtyOnHand);
    }

    [Fact]
    public async Task WithdrawAsync_SequentialWithdrawalsFromSeparateRequests_NeverGoNegative()
    {
        // Each withdrawal here uses its own DbContext, matching how two separate HTTP
        // requests would each get a scoped context — proves WithdrawAsync re-reads the
        // authoritative QtyOnHand every call rather than trusting a value cached from
        // construction. (InMemory can't reliably simulate a true interleaved race hitting
        // the RowVersion optimistic-concurrency retry path itself — that needs a real
        // relational provider — so this covers the business rule the retry exists to protect.)
        var dbName = Guid.NewGuid().ToString();
        await using (var seedDb = CreateContext(dbName))
        {
            await SeedPendingOrderItemAsync(seedDb);
        }

        int lotId;
        await using (var db = CreateContext(dbName))
        {
            var orderItem = await db.OrderItems.FirstAsync();
            var lot = await new InventoryService(db).ReceiveAsync(orderItem, CancellationToken.None);
            lotId = lot.Id;
            db.WithdrawalReasons.Add(new WithdrawalReason { Id = 701, Name = "r" });
            db.Users.Add(new User { Id = 702, Username = "w3", PasswordHash = "x", FullName = "W3", RoleId = 1 });
            await db.SaveChangesAsync();
        }

        // Two separate contexts withdraw 6 each from a lot of 10 — only one can fully succeed
        // before the other's second (retried) read sees the reduced quantity and fails on the
        // remainder, since 6 + 6 > 10.
        await using var dbA = CreateContext(dbName);
        await using var dbB = CreateContext(dbName);
        var serviceA = new InventoryService(dbA);
        var serviceB = new InventoryService(dbB);

        await serviceA.WithdrawAsync(lotId, 6, 701, 702, null, CancellationToken.None);
        await Assert.ThrowsAsync<InsufficientStockException>(
            () => serviceB.WithdrawAsync(lotId, 6, 701, 702, null, CancellationToken.None));

        await using var verifyDb = CreateContext(dbName);
        var finalLot = await verifyDb.InventoryItems.FindAsync(lotId);
        Assert.Equal(4, finalLot!.QtyOnHand);
        Assert.True(finalLot.QtyOnHand >= 0);
    }
}
