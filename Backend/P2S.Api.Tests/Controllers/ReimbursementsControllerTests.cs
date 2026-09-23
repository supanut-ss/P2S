using System.Reflection;
using System.Security.Claims;
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

public class ReimbursementsControllerTests
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

    private static ClaimsPrincipal Principal(int userId, string role) =>
        new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        ], "test"));

    private static ReimbursementsController CreateController(P2SDbContext db, int userId, string role)
    {
        var controller = new ReimbursementsController(db, new ReimbursementService(db))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = Principal(userId, role) }
            }
        };
        return controller;
    }

    private static async Task<(User Staff, User OtherStaff)> SeedRequestsAsync(P2SDbContext db)
    {
        var staff = new User { Username = "staff1", PasswordHash = "x", FullName = "Staff 1", RoleId = 1 };
        var otherStaff = new User { Username = "staff2", PasswordHash = "x", FullName = "Staff 2", RoleId = 1 };
        db.Users.AddRange(staff, otherStaff);
        await db.SaveChangesAsync();

        db.Reimbursements.AddRange(
            new Reimbursement { RequestedByUserId = staff.Id, RequestedByUser = staff, TotalAmount = 100m },
            new Reimbursement { RequestedByUserId = otherStaff.Id, RequestedByUser = otherStaff, TotalAmount = 200m });
        await db.SaveChangesAsync();
        return (staff, otherStaff);
    }

    private static async Task<List<ReimbursementResponse>> ListAsAsync(
        P2SDbContext db, int userId, string role)
    {
        var result = await CreateController(db, userId, role).List(null, CancellationToken.None);
        var response = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<List<ReimbursementResponse>>(response.Value);
    }

    [Fact]
    public async Task List_StaffSeesOnlyTheirOwnRequests()
    {
        await using var db = CreateContext();
        var (staff, _) = await SeedRequestsAsync(db);

        var reimbursements = await ListAsAsync(db, staff.Id, "staff");

        var reimbursement = Assert.Single(reimbursements);
        Assert.Equal(staff.Id, reimbursement.RequestedByUserId);
    }

    [Theory]
    [InlineData("finance")]
    [InlineData("admin")]
    public async Task List_FinanceAndAdminCanSeeTheQueue(string role)
    {
        await using var db = CreateContext();
        var (staff, _) = await SeedRequestsAsync(db);

        var reimbursements = await ListAsAsync(db, staff.Id, role);

        Assert.Equal(2, reimbursements.Count);
    }

    [Fact]
    public void Create_IsRestrictedToStaffAndAdmin()
    {
        var authorize = typeof(ReimbursementsController)
            .GetMethod(nameof(ReimbursementsController.Create))!
            .GetCustomAttribute<AuthorizeAttribute>();

        Assert.Equal("staff,admin", authorize?.Roles);
    }
}
