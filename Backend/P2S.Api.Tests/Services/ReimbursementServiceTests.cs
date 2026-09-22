using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Services;

namespace P2S.Api.Tests.Services;

public class ReimbursementServiceTests
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

    private static async Task<(User user, Product product)> SeedBaseAsync(P2SDbContext db)
    {
        var user = new User { Username = "u1", PasswordHash = "x", FullName = "U1", RoleId = 1 };
        var product = new Product { Name = "P", SkuCode = "SKU-R1", Unit = "ชิ้น" };
        db.Users.Add(user);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return (user, product);
    }

    [Fact]
    public async Task CreateAsync_ExcludesCancelledItems_FromTotal()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O1", TotalAmount = 300m, Status = PurchaseOrderStatus.PaidByStaff };
        order.OrderItems.Add(new OrderItem { ProductId = product.Id, Qty = 2, UnitPrice = 100m, Status = OrderItemStatus.Arrived });
        order.OrderItems.Add(new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 100m, Status = OrderItemStatus.Cancelled });
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var service = new ReimbursementService(db);
        var reimbursement = await service.CreateAsync(user.Id, [order.Id], CancellationToken.None);

        Assert.Equal(200m, reimbursement.TotalAmount);
    }

    [Fact]
    public async Task CreateAsync_RejectsOrdersNotYetPaidByStaff()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O2", TotalAmount = 100m, Status = PurchaseOrderStatus.Ordered };
        order.OrderItems.Add(new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 100m, Status = OrderItemStatus.Pending });
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var service = new ReimbursementService(db);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(user.Id, [order.Id], CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_RejectsOrderAlreadyInAnUnpaidReimbursement()
    {
        // order.Status stays PaidByStaff until a reimbursement is actually Paid, so a second
        // CreateAsync call for the same order must be rejected while the first request is
        // still Pending/Approved — otherwise the same order could be double-reimbursed.
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O5", TotalAmount = 90m, Status = PurchaseOrderStatus.PaidByStaff };
        order.OrderItems.Add(new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 90m, Status = OrderItemStatus.Arrived });
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var service = new ReimbursementService(db);
        await service.CreateAsync(user.Id, [order.Id], CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(user.Id, [order.Id], CancellationToken.None));
    }

    [Fact]
    public async Task PayAsync_FlipsOrdersToReimbursed_AndRecordsNegativeLedgerEntry()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O3", TotalAmount = 150m, Status = PurchaseOrderStatus.PaidByStaff };
        order.OrderItems.Add(new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 150m, Status = OrderItemStatus.Arrived });
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var service = new ReimbursementService(db);
        var reimbursement = await service.CreateAsync(user.Id, [order.Id], CancellationToken.None);
        await service.ApproveAsync(reimbursement.Id, CancellationToken.None);
        await service.PayAsync(reimbursement.Id, CancellationToken.None);

        var reloadedOrder = await db.PurchaseOrders.FindAsync(order.Id);
        Assert.Equal(PurchaseOrderStatus.Reimbursed, reloadedOrder!.Status);

        var ledgerEntry = await db.StaffLedgerEntries.SingleAsync(e => e.RelatedReimbursementId == reimbursement.Id);
        Assert.Equal(StaffLedgerEntryType.Reimbursed, ledgerEntry.EntryType);
        Assert.Equal(-150m, ledgerEntry.Amount);
    }

    [Fact]
    public async Task PayAsync_RejectsUnapprovedReimbursement()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O4", TotalAmount = 50m, Status = PurchaseOrderStatus.PaidByStaff };
        order.OrderItems.Add(new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 50m, Status = OrderItemStatus.Arrived });
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var service = new ReimbursementService(db);
        var reimbursement = await service.CreateAsync(user.Id, [order.Id], CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.PayAsync(reimbursement.Id, CancellationToken.None));
    }
}
