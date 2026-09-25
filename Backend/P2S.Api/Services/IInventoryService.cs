using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public class InsufficientStockException : Exception
{
    public InsufficientStockException(string message) : base(message) { }
}

public interface IInventoryService
{
    /// <summary>Auto-creates a new inventory lot from an order item confirmed as arrived —
    /// the "auto, no re-create button" behavior required by PROJECT-PLAN.md section 1.10.
    /// Caller must have already verified orderItem.Status == Pending.</summary>
    Task<InventoryItem> ReceiveAsync(OrderItem orderItem, int quantity, CancellationToken ct);

    /// <summary>Withdraws qty from a lot, decrementing QtyOnHand and flipping to Depleted at
    /// zero. Uses the lot's optimistic concurrency token so two simultaneous withdrawals can't
    /// both succeed past the available quantity.</summary>
    Task<InventoryWithdrawal> WithdrawAsync(int inventoryItemId, int qty, int withdrawalReasonId, int withdrawnByUserId, string? note, CancellationToken ct);
}
