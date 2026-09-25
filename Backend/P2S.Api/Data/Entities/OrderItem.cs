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
    public int ReceivedQty { get; set; }
    public int ReturnedQty { get; set; }
    public uint RowVersion { get; set; }
    public decimal UnitPrice { get; set; }
    public OrderItemStatus Status { get; set; } = OrderItemStatus.Pending;

    /// <summary>Label printed on the outside of the parcel for this purchased item.</summary>
    public string? PackageName { get; set; }
    public string? Model { get; set; }
    public string? ShopName { get; set; }
    public string? Description { get; set; }

    /// <summary>Optional legacy shipping reference; order-number goods receiving does not depend on it.</summary>
    public string? TrackingNo { get; set; }
    public string? Courier { get; set; }

    public DateTime? ArrivedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    public InventoryItem? InventoryItem { get; set; }
    public Delivery? Delivery { get; set; }
    public ICollection<GoodsReceiptEventLine> GoodsReceiptLines { get; set; } = new List<GoodsReceiptEventLine>();
    public ICollection<Cancellation> Cancellations { get; set; } = new List<Cancellation>();
}
