using System.Security.Claims;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Controllers;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Tests.Controllers;

public class DeliveriesControllerTests
{
    [Fact]
    public void Endpoints_AreRestrictedToStaffAndAdmin()
    {
        var authorize = typeof(DeliveriesController).GetCustomAttribute<AuthorizeAttribute>();

        Assert.Equal("staff,admin", authorize?.Roles);
    }

    [Fact]
    public async Task GetPending_OnlyReturnsCurrentUsersOrderItemsForStaff()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        var (staff, _, ownItem, _) = await SeedOrderItems(db);

        var result = await CreateController(db, staff.Id, "staff").GetPending(null, CancellationToken.None);
        var response = Assert.IsType<OkObjectResult>(result.Result);
        var items = Assert.IsType<List<PendingOrderItemResponse>>(response.Value);

        Assert.Equal([ownItem.Id], items.Select(item => item.OrderItemId));
    }

    [Fact]
    public async Task GetPending_AdminCanSeeAllOrderItems()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        await SeedOrderItems(db);

        var result = await CreateController(db, 999, "admin").GetPending(null, CancellationToken.None);
        var response = Assert.IsType<OkObjectResult>(result.Result);
        var items = Assert.IsType<List<PendingOrderItemResponse>>(response.Value);

        Assert.Equal(2, items.Count);
    }

    [Fact]
    public async Task ConfirmArrived_DoesNotReceiveAnotherUsersOrderItem()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        var (staff, _, _, otherItem) = await SeedOrderItems(db);

        var result = await CreateController(db, staff.Id, "staff").ConfirmArrived(
            otherItem.Id,
            new ConfirmArrivedRequest("TRACK-OTHER", "Barcode"),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal(OrderItemStatus.Pending, otherItem.Status);
        Assert.Empty(db.Deliveries);
        Assert.Empty(db.InventoryItems);
    }

    [Fact]
    public async Task Cancel_DoesNotCancelAnotherUsersOrderItem()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        var (staff, _, _, otherItem) = await SeedOrderItems(db);

        var result = await CreateController(db, staff.Id, "staff").Cancel(
            otherItem.Id,
            new CancelOrderItemRequest("test"),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal(OrderItemStatus.Pending, otherItem.Status);
        Assert.Empty(db.Cancellations);
    }

    private static DeliveriesController CreateController(P2SDbContext db, int userId, string role) => new(
        db,
        new InventoryService(db),
        new CancellationService(db))
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                    new Claim(ClaimTypes.Role, role)
                ], "test"))
            }
        }
    };

    private static async Task<(User Staff, User OtherStaff, OrderItem OwnItem, OrderItem OtherItem)> SeedOrderItems(P2SDbContext db)
    {
        var staff = new User { Username = "staff1", PasswordHash = "x", FullName = "Staff 1", RoleId = 1 };
        var otherStaff = new User { Username = "staff2", PasswordHash = "x", FullName = "Staff 2", RoleId = 1 };
        var platform = new Platform { Code = "TEST", Name = "Test" };
        var product = new Product { Name = "Product", SkuCode = "SKU-DELIVERY-1" };
        db.Users.AddRange(staff, otherStaff);
        db.Platforms.Add(platform);
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var ownOrder = CreateOrder(staff, platform, product, "OWN-1");
        var otherOrder = CreateOrder(otherStaff, platform, product, "OTHER-1");
        db.PurchaseOrders.AddRange(ownOrder, otherOrder);
        await db.SaveChangesAsync();
        return (staff, otherStaff, Assert.Single(ownOrder.OrderItems), Assert.Single(otherOrder.OrderItems));
    }

    private static PurchaseOrder CreateOrder(User owner, Platform platform, Product product, string orderNo)
    {
        var order = new PurchaseOrder
        {
            PlatformId = platform.Id,
            Platform = platform,
            OrderedByUserId = owner.Id,
            OrderedByUser = owner,
            PlatformOrderNo = orderNo,
            TotalAmount = 100m,
            Status = PurchaseOrderStatus.Ordered,
        };
        order.OrderItems.Add(new OrderItem
        {
            ProductId = product.Id,
            Product = product,
            Qty = 1,
            UnitPrice = 100m,
            Status = OrderItemStatus.Pending,
        });
        return order;
    }
}
