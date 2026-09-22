using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Services;

namespace P2S.Api.Tests.Services;

public class CancellationServiceTests
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
        var product = new Product { Name = "P", SkuCode = "SKU-C1", Unit = "ชิ้น" };
        db.Users.Add(user);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return (user, product);
    }

    [Fact]
    public async Task FlagFromOrderItemCancellationAsync_OrderNotYetReimbursed_NoLedgerEntry()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O1", TotalAmount = 100m, Status = PurchaseOrderStatus.PaidByStaff };
        var item = new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 100m, Status = OrderItemStatus.Cancelled };
        order.OrderItems.Add(item);
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var service = new CancellationService(db);
        await service.FlagFromOrderItemCancellationAsync(item, CancellationToken.None);

        var cancellation = await db.Cancellations.SingleAsync(c => c.OrderItemId == item.Id);
        Assert.Null(cancellation.ReimbursementId);
        Assert.False(await db.StaffLedgerEntries.AnyAsync());
    }

    [Fact]
    public async Task FlagFromOrderItemCancellationAsync_OrderAlreadyReimbursed_RecordsRefundDueLedgerEntry()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O2", TotalAmount = 200m, Status = PurchaseOrderStatus.Reimbursed };
        var item = new OrderItem { ProductId = product.Id, Qty = 2, UnitPrice = 100m, Status = OrderItemStatus.Cancelled };
        order.OrderItems.Add(item);
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var reimbursement = new Reimbursement { RequestedByUserId = user.Id, Status = ReimbursementStatus.Paid, TotalAmount = 200m, PaidAt = DateTime.UtcNow };
        reimbursement.PurchaseOrders.Add(order);
        db.Reimbursements.Add(reimbursement);
        await db.SaveChangesAsync();

        var service = new CancellationService(db);
        await service.FlagFromOrderItemCancellationAsync(item, CancellationToken.None);

        var cancellation = await db.Cancellations.SingleAsync(c => c.OrderItemId == item.Id);
        Assert.Equal(reimbursement.Id, cancellation.ReimbursementId);

        var ledgerEntry = await db.StaffLedgerEntries.SingleAsync(e => e.RelatedCancellationId == cancellation.Id);
        Assert.Equal(StaffLedgerEntryType.RefundDue, ledgerEntry.EntryType);
        Assert.Equal(-200m, ledgerEntry.Amount);
    }

    [Fact]
    public async Task ResolveAsync_Refunded_RecordsPositiveRefundSettledEntry()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O3", TotalAmount = 80m, Status = PurchaseOrderStatus.Reimbursed };
        var item = new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 80m, Status = OrderItemStatus.Cancelled };
        order.OrderItems.Add(item);
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var reimbursement = new Reimbursement { RequestedByUserId = user.Id, Status = ReimbursementStatus.Paid, TotalAmount = 80m, PaidAt = DateTime.UtcNow };
        reimbursement.PurchaseOrders.Add(order);
        db.Reimbursements.Add(reimbursement);
        await db.SaveChangesAsync();

        var service = new CancellationService(db);
        await service.FlagFromOrderItemCancellationAsync(item, CancellationToken.None);
        var cancellation = await db.Cancellations.SingleAsync(c => c.OrderItemId == item.Id);

        var resolved = await service.ResolveAsync(cancellation.Id, CancellationStatus.Refunded, CancellationToken.None);

        Assert.Equal(CancellationStatus.Refunded, resolved.Status);
        Assert.NotNull(resolved.ResolvedAt);

        var settledEntry = await db.StaffLedgerEntries.SingleAsync(e => e.EntryType == StaffLedgerEntryType.RefundSettled);
        Assert.Equal(80m, settledEntry.Amount);
    }

    [Fact]
    public async Task ResolveAsync_RejectsAlreadyResolvedCancellation()
    {
        await using var db = CreateContext();
        var (user, product) = await SeedBaseAsync(db);

        var order = new PurchaseOrder { PlatformId = 1, OrderedByUserId = user.Id, PlatformOrderNo = "O4", TotalAmount = 10m, Status = PurchaseOrderStatus.PaidByStaff };
        var item = new OrderItem { ProductId = product.Id, Qty = 1, UnitPrice = 10m, Status = OrderItemStatus.Cancelled };
        order.OrderItems.Add(item);
        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync();

        var service = new CancellationService(db);
        await service.FlagFromOrderItemCancellationAsync(item, CancellationToken.None);
        var cancellation = await db.Cancellations.SingleAsync(c => c.OrderItemId == item.Id);

        await service.ResolveAsync(cancellation.Id, CancellationStatus.Adjusted, CancellationToken.None);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.ResolveAsync(cancellation.Id, CancellationStatus.Refunded, CancellationToken.None));
    }
}
