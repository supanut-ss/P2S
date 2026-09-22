namespace P2S.Api.Data.Entities;

/// <summary>One received lot of a product — auto-created the moment its order item is confirmed arrived. One purchase batch = one lot, so cost-per-unit and FIFO come for free.</summary>
public class InventoryItem
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int OrderItemId { get; set; }
    public OrderItem OrderItem { get; set; } = null!;

    public int QtyReceived { get; set; }
    public int QtyOnHand { get; set; }
    public decimal CostPerUnit { get; set; }
    public InventoryItemStatus Status { get; set; } = InventoryItemStatus.InStock;
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Optimistic concurrency token, app-managed (MySQL has no native rowversion type) — incremented on every update via DbContext.SaveChanges, required because withdrawals can race (two people withdrawing the same lot at once).</summary>
    public uint RowVersion { get; set; }

    public ICollection<InventoryWithdrawal> Withdrawals { get; set; } = new List<InventoryWithdrawal>();
}
