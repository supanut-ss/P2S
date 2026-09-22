using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;

namespace P2S.Api.Tests.Data;

public class SeedDataTests
{
    private static P2SDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<P2SDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var context = new P2SDbContext(options);
        // InMemory provider only materializes HasData() seed rows once the database is created —
        // unlike a real relational provider where migrations do that automatically on deploy.
        context.Database.EnsureCreated();
        return context;
    }

    [Fact]
    public async Task SeededAdminUser_CanLoginWithDefaultPassword()
    {
        await using var db = CreateContext();
        var admin = await db.Users.FirstAsync(u => u.Username == SeedData.DefaultAdminUsername);

        Assert.True(BCrypt.Net.BCrypt.Verify(SeedData.DefaultAdminPassword, admin.PasswordHash));
    }

    [Fact]
    public async Task SeededPlatforms_ContainAllThreeCodes()
    {
        await using var db = CreateContext();
        var codes = await db.Platforms.Select(p => p.Code).OrderBy(c => c).ToListAsync();

        Assert.Equal(new[] { "AM", "SP", "TT" }, codes);
    }

    [Fact]
    public async Task SeededWithdrawalReasons_AreAllActive()
    {
        await using var db = CreateContext();
        var reasons = await db.WithdrawalReasons.ToListAsync();

        Assert.Equal(4, reasons.Count);
        Assert.All(reasons, r => Assert.True(r.IsActive));
    }
}
