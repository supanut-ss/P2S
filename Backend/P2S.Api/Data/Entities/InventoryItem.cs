namespace P2S.Api.Data.Entities;

/// <summary>Aggregated inventory lot for one purchase-order line. Receipt events retain each partial-receipt quantity and timestamp.</summary>
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
