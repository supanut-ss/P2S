using Microsoft.EntityFrameworkCore;
using P2S.Api.Data.Entities;

namespace P2S.Api.Data;

/// <summary>
/// Seeds the master data every fresh deploy needs to be usable at all: without this, the first
/// migration leaves an empty DB with no login and no platform/reason lists for the UI dropdowns.
/// The seeded admin password ("ChangeMe123!") must be rotated immediately after first login —
/// there is no email-based reset flow by design (users log in with username only).
/// </summary>
public static class SeedData
{
    public const string DefaultAdminUsername = "admin";
    public const string DefaultAdminPassword = "ChangeMe123!";

    public static void Apply(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>().HasData(
            new Role { Id = 1, Name = "staff" },
            new Role { Id = 2, Name = "finance" },
            new Role { Id = 3, Name = "admin" }
        );

        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = 1,
                Username = DefaultAdminUsername,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(DefaultAdminPassword),
                FullName = "System Administrator",
                RoleId = 3,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<Platform>().HasData(
            new Platform { Id = 1, Code = "SP", Name = "Shopee", IsActive = true },
            new Platform { Id = 2, Code = "TT", Name = "TikTok Shop", IsActive = true },
            new Platform { Id = 3, Code = "AM", Name = "Amazon/Lazada", IsActive = true }
        );

        modelBuilder.Entity<WithdrawalReason>().HasData(
            new WithdrawalReason { Id = 1, Name = "ขาย", IsActive = true },
            new WithdrawalReason { Id = 2, Name = "ชำรุด", IsActive = true },
            new WithdrawalReason { Id = 3, Name = "โอนย้าย", IsActive = true },
            new WithdrawalReason { Id = 4, Name = "อื่นๆ", IsActive = true }
        );
    }
}
