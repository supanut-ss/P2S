namespace P2S.Api.Data.Entities;

/// <summary>One withdrawal event that cuts QtyOnHand of an inventory lot — the only write path allowed to reduce stock.</summary>
public class InventoryWithdrawal
{
    public int Id { get; set; }
    public int InventoryItemId { get; set; }
    public InventoryItem InventoryItem { get; set; } = null!;

    public int Qty { get; set; }
    public int WithdrawalReasonId { get; set; }
    public WithdrawalReason WithdrawalReason { get; set; } = null!;

    public int WithdrawnByUserId { get; set; }
    public User WithdrawnByUser { get; set; } = null!;
    public DateTime WithdrawnAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }
}
