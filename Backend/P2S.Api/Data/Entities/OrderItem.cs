namespace P2S.Api.Data.Entities;

/// <summary>One line item within a purchase order — split out because items in the same order can arrive separately.</summary>
public class OrderItem
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public int Qty { get; set; }
    public decimal UnitPrice { get; set; }
    public OrderItemStatus Status { get; set; } = OrderItemStatus.Pending;

    /// <summary>Shipping tracking number as printed on the courier's own barcode — filled in by staff once the shop ships, used to match a scan.</summary>
    public string? TrackingNo { get; set; }
    public string? Courier { get; set; }

    public DateTime? ArrivedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    public InventoryItem? InventoryItem { get; set; }
    public Delivery? Delivery { get; set; }
    public Cancellation? Cancellation { get; set; }
}
