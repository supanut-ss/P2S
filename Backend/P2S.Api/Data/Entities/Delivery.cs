namespace P2S.Api.Data.Entities;

/// <summary>One scan event at goods-receiving — records what was scanned and which order item it matched, for audit even when the match came from manual search.</summary>
public class Delivery
{
    public int Id { get; set; }
    public int OrderItemId { get; set; }
    public OrderItem OrderItem { get; set; } = null!;

    /// <summary>Raw barcode/tracking value read by the scanner, or the tracking number typed in manually.</summary>
    public string ScannedCode { get; set; } = null!;
    public DeliveryMatchMethod MatchMethod { get; set; }

    public int ScannedByUserId { get; set; }
    public User ScannedByUser { get; set; } = null!;
    public DateTime ScannedAt { get; set; } = DateTime.UtcNow;
}
