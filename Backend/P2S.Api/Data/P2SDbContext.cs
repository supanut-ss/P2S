using Microsoft.EntityFrameworkCore;
using P2S.Api.Data.Entities;

namespace P2S.Api.Data;

public class P2SDbContext : DbContext
{
    public P2SDbContext(DbContextOptions<P2SDbContext> options) : base(options) { }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Platform> Platforms => Set<Platform>();
    public DbSet<WithdrawalReason> WithdrawalReasons => Set<WithdrawalReason>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Reimbursement> Reimbursements => Set<Reimbursement>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryWithdrawal> InventoryWithdrawals => Set<InventoryWithdrawal>();
    public DbSet<Cancellation> Cancellations => Set<Cancellation>();
    public DbSet<StaffLedgerEntry> StaffLedgerEntries => Set<StaffLedgerEntry>();
    public DbSet<DailyFinanceSnapshot> DailyFinanceSnapshots => Set<DailyFinanceSnapshot>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Username).HasMaxLength(64);
            e.Property(x => x.CardLast4).HasMaxLength(4);
            e.HasOne(x => x.Role).WithMany(r => r.Users).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Platform>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(8);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.HasIndex(x => x.SkuCode).IsUnique();
        });

        modelBuilder.Entity<PurchaseOrder>(e =>
        {
            e.Property(x => x.TotalAmount).HasPrecision(18, 2);
            e.HasIndex(x => new { x.PlatformId, x.PlatformOrderNo });
            e.HasOne(x => x.Platform).WithMany().HasForeignKey(x => x.PlatformId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.OrderedByUser).WithMany().HasForeignKey(x => x.OrderedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItem>(e =>
        {
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.HasIndex(x => x.TrackingNo);
            e.HasOne(x => x.PurchaseOrder).WithMany(p => p.OrderItems).HasForeignKey(x => x.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product).WithMany(p => p.OrderItems).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Reimbursement>(e =>
        {
            e.Property(x => x.TotalAmount).HasPrecision(18, 2);
            e.HasOne(x => x.RequestedByUser).WithMany().HasForeignKey(x => x.RequestedByUserId).OnDelete(DeleteBehavior.Restrict);
            // Reimbursement <-> PurchaseOrder: many-to-many, independent of the inventory flow by design.
            e.HasMany(x => x.PurchaseOrders).WithMany();
        });

        modelBuilder.Entity<Delivery>(e =>
        {
            e.HasOne(x => x.OrderItem).WithOne(o => o.Delivery).HasForeignKey<Delivery>(x => x.OrderItemId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ScannedByUser).WithMany().HasForeignKey(x => x.ScannedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<InventoryItem>(e =>
        {
            e.Property(x => x.CostPerUnit).HasPrecision(18, 2);
            e.Property(x => x.RowVersion).IsConcurrencyToken();
            e.HasOne(x => x.Product).WithMany(p => p.InventoryItems).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.OrderItem).WithOne(o => o.InventoryItem).HasForeignKey<InventoryItem>(x => x.OrderItemId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<InventoryWithdrawal>(e =>
        {
            e.HasOne(x => x.InventoryItem).WithMany(i => i.Withdrawals).HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.WithdrawalReason).WithMany().HasForeignKey(x => x.WithdrawalReasonId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.WithdrawnByUser).WithMany().HasForeignKey(x => x.WithdrawnByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Cancellation>(e =>
        {
            e.HasOne(x => x.OrderItem).WithOne(o => o.Cancellation).HasForeignKey<Cancellation>(x => x.OrderItemId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Reimbursement).WithMany(r => r.Cancellations).HasForeignKey(x => x.ReimbursementId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StaffLedgerEntry>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.RelatedPurchaseOrder).WithMany(p => p.StaffLedgerEntries).HasForeignKey(x => x.RelatedPurchaseOrderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.RelatedReimbursement).WithMany(r => r.StaffLedgerEntries).HasForeignKey(x => x.RelatedReimbursementId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.RelatedCancellation).WithMany(c => c.StaffLedgerEntries).HasForeignKey(x => x.RelatedCancellationId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DailyFinanceSnapshot>(e =>
        {
            e.Property(x => x.TotalOrderedAmount).HasPrecision(18, 2);
            e.Property(x => x.TotalReimbursementPending).HasPrecision(18, 2);
            e.Property(x => x.TotalInventoryValueToday).HasPrecision(18, 2);
            e.HasIndex(x => x.SnapshotDate).IsUnique();
        });

        SeedData.Apply(modelBuilder);
    }
}
