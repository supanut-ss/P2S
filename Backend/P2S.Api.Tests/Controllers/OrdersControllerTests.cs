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

namespace P2S.Api.Tests.Controllers;

public class OrdersControllerTests
{
    [Fact]
    public void OrderMutations_AreRestrictedToStaffAndAdmin()
    {
        foreach (var methodName in new[] { nameof(OrdersController.Create), nameof(OrdersController.MarkPaid), nameof(OrdersController.SetTracking) })
        {
            var authorize = typeof(OrdersController).GetMethod(methodName)!.GetCustomAttribute<AuthorizeAttribute>();
            Assert.Equal("staff,admin", authorize?.Roles);
        }
    }

    [Fact]
    public async Task List_OnlyReturnsCurrentUsersOrdersAndIgnoresAnotherUsersFilter()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        var (staff, otherStaff, ownOrder, _) = await SeedOrders(db);

        var controller = CreateController(db, staff.Id, "staff");

        var result = await controller.List(null, null, null, null, false, CancellationToken.None);
        var response = Assert.IsType<OkObjectResult>(result.Result);
        var orders = Assert.IsType<List<PurchaseOrderResponse>>(response.Value);
        Assert.Equal([ownOrder.Id], orders.Select(order => order.Id));

        var spoofedResult = await controller.List(null, otherStaff.Id, null, null, false, CancellationToken.None);
        var spoofedResponse = Assert.IsType<OkObjectResult>(spoofedResult.Result);
        Assert.Empty(Assert.IsType<List<PurchaseOrderResponse>>(spoofedResponse.Value));
    }

    [Fact]
    public async Task List_AdminCanSeeOrdersFromAllUsers()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        await SeedOrders(db);

        var controller = CreateController(db, 999, "admin");

        var result = await controller.List(null, null, null, null, false, CancellationToken.None);
        var response = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(2, Assert.IsType<List<PurchaseOrderResponse>>(response.Value).Count);
    }

    [Fact]
    public async Task Get_DoesNotExposeAnotherUsersOrderToNonAdmin()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        var (staff, _, _, otherOrder) = await SeedOrders(db);

        var controller = CreateController(db, staff.Id, "finance");

        var result = await controller.Get(otherOrder.Id, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);

        var adminResult = await CreateController(db, 999, "admin").Get(otherOrder.Id, CancellationToken.None);
        Assert.IsType<OkObjectResult>(adminResult.Result);
    }

    [Fact]
    public async Task MarkPaid_DoesNotChangeAnotherUsersOrderForNonAdmin()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        var (staff, _, _, otherOrder) = await SeedOrders(db);
        var originalStatus = otherOrder.Status;

        var controller = CreateController(db, staff.Id, "staff");

        var result = await controller.MarkPaid(otherOrder.Id, CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
        Assert.Equal(originalStatus, otherOrder.Status);
        Assert.Empty(db.StaffLedgerEntries);
    }

    [Fact]
    public async Task SetTracking_DoesNotChangeAnotherUsersOrderItemForNonAdmin()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();
        var (staff, _, _, otherOrder) = await SeedOrders(db);
        var otherItem = Assert.Single(otherOrder.OrderItems);

        var controller = CreateController(db, staff.Id, "staff");

        var result = await controller.SetTracking(
            otherItem.Id,
            new SetTrackingRequest("TRACK-OTHER", "Courier"),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        Assert.Null(otherItem.TrackingNo);
        Assert.Null(otherItem.Courier);
    }

    [Fact]
    public async Task List_EligibleReimbursementOrdersAreLimitedToTheCurrentStaffMember()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var db = new P2SDbContext(options);
        db.Database.EnsureCreated();

        var staff = new User { Username = "staff1", PasswordHash = "x", FullName = "Staff 1", RoleId = 1 };
        var otherStaff = new User { Username = "staff2", PasswordHash = "x", FullName = "Staff 2", RoleId = 1 };
        var platform = new Platform { Code = "TEST", Name = "Test" };
        var product = new Product { Name = "Product", SkuCode = "SKU-ORDERS-1" };
        db.Users.AddRange(staff, otherStaff);
        db.Platforms.Add(platform);
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var ownOrder = CreatePaidOrder(staff, platform, product, "OWN-1");
        var otherOrder = CreatePaidOrder(otherStaff, platform, product, "OTHER-1");
        db.PurchaseOrders.AddRange(ownOrder, otherOrder);
        await db.SaveChangesAsync();

        var controller = CreateController(db, staff.Id, "staff");

        var result = await controller.List(null, null, "PaidByStaff", null, true, CancellationToken.None);
        var response = Assert.IsType<OkObjectResult>(result.Result);
        var orders = Assert.IsType<List<PurchaseOrderResponse>>(response.Value);

        var order = Assert.Single(orders);
        Assert.Equal(ownOrder.Id, order.Id);
    }

    private static OrdersController CreateController(P2SDbContext db, int userId, string role) => new(db)
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

    private static async Task<(User Staff, User OtherStaff, PurchaseOrder OwnOrder, PurchaseOrder OtherOrder)> SeedOrders(P2SDbContext db)
    {
        var staff = new User { Username = "staff1", PasswordHash = "x", FullName = "Staff 1", RoleId = 1 };
        var otherStaff = new User { Username = "staff2", PasswordHash = "x", FullName = "Staff 2", RoleId = 1 };
        var platform = new Platform { Code = "TEST", Name = "Test" };
        var product = new Product { Name = "Product", SkuCode = "SKU-ORDERS-1" };
        db.Users.AddRange(staff, otherStaff);
        db.Platforms.Add(platform);
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var ownOrder = CreatePaidOrder(staff, platform, product, "OWN-1");
        var otherOrder = CreatePaidOrder(otherStaff, platform, product, "OTHER-1");
        db.PurchaseOrders.AddRange(ownOrder, otherOrder);
        await db.SaveChangesAsync();
        return (staff, otherStaff, ownOrder, otherOrder);
    }

    private static PurchaseOrder CreatePaidOrder(User owner, Platform platform, Product product, string orderNo)
    {
        var order = new PurchaseOrder
        {
            PlatformId = platform.Id,
            Platform = platform,
            OrderedByUserId = owner.Id,
            OrderedByUser = owner,
            PlatformOrderNo = orderNo,
            TotalAmount = 100m,
            Status = PurchaseOrderStatus.PaidByStaff,
        };
        order.OrderItems.Add(new OrderItem
        {
            ProductId = product.Id,
            Product = product,
            Qty = 1,
            UnitPrice = 100m,
            Status = OrderItemStatus.Arrived,
        });
        return order;
    }
}
