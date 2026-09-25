namespace P2S.Api.Data.Entities;

public class GoodsReceiptEvent
{
    public int Id { get; set; }

    public int PurchaseOrderId { get; set; }
    public PurchaseOrder PurchaseOrder { get; set; } = null!;

    public GoodsReceiptEventType EventType { get; set; }
    public GoodsReceiptEntryMethod EntryMethod { get; set; }
    public string EnteredOrderNo { get; set; } = null!;
    public int LineCount { get; set; }
    public int UnitCount { get; set; }

    public int ActorUserId { get; set; }
    public User ActorUser { get; set; } = null!;
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    public int? ReversesEventId { get; set; }
    public GoodsReceiptEvent? ReversesEvent { get; set; }
    public ICollection<GoodsReceiptEvent> ReversedByEvents { get; set; } = new List<GoodsReceiptEvent>();
    public string? Reason { get; set; }
    public ICollection<GoodsReceiptEventLine> Lines { get; set; } = new List<GoodsReceiptEventLine>();
}

public class GoodsReceiptEventLine
{
    public int Id { get; set; }
    public int GoodsReceiptEventId { get; set; }
    public GoodsReceiptEvent GoodsReceiptEvent { get; set; } = null!;
    public int OrderItemId { get; set; }
    public OrderItem OrderItem { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
