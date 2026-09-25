using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public class InventoryService : IInventoryService
{
    private const int MaxConcurrencyRetries = 3;

    private readonly P2SDbContext _db;

    public InventoryService(P2SDbContext db)
    {
        _db = db;
    }

    public Task<InventoryItem> ReceiveAsync(OrderItem orderItem, int quantity, CancellationToken ct)
    {
        if (quantity <= 0 || quantity > orderItem.Qty - orderItem.ReceivedQty)
        {
            throw new ArgumentOutOfRangeException(nameof(quantity), "จำนวนรับต้องมากกว่า 0 และไม่เกินจำนวนที่ยังรอรับ");
        }

        var receivedAt = DateTime.UtcNow;
        var lot = orderItem.InventoryItem;
        if (lot is null)
        {
            lot = new InventoryItem
            {
                ProductId = orderItem.ProductId,
                OrderItemId = orderItem.Id,
                QtyReceived = 0,
                QtyOnHand = 0,
                CostPerUnit = orderItem.UnitPrice,
                Status = InventoryItemStatus.InStock,
                ReceivedAt = receivedAt,
            };
            orderItem.InventoryItem = lot;
            _db.InventoryItems.Add(lot);
        }

        lot.QtyReceived += quantity;
        lot.QtyOnHand += quantity;
        lot.Status = InventoryItemStatus.InStock;
        lot.RowVersion += 1;
        orderItem.ReceivedQty += quantity;
        orderItem.Status = orderItem.ReceivedQty == orderItem.Qty ? OrderItemStatus.Arrived : OrderItemStatus.Pending;
        orderItem.ArrivedAt ??= receivedAt;
        orderItem.RowVersion += 1;

        return Task.FromResult(lot);
    }

    [Obsolete("Use the quantity overload as part of an audited goods-receipt event.")]
    public async Task<InventoryItem> ReceiveAsync(OrderItem orderItem, CancellationToken ct)
    {
        var remainingQty = orderItem.Qty - orderItem.ReceivedQty;
        var lot = await ReceiveAsync(orderItem, remainingQty, ct);
        await _db.SaveChangesAsync(ct);
        return lot;
    }

    public async Task<InventoryWithdrawal> WithdrawAsync(int inventoryItemId, int qty, int withdrawalReasonId, int withdrawnByUserId, string? note, CancellationToken ct)
    {
        if (qty <= 0) throw new ArgumentOutOfRangeException(nameof(qty), "จำนวนที่เบิกต้องมากกว่า 0");

        for (var attempt = 1; attempt <= MaxConcurrencyRetries; attempt++)
        {
            // Reload each attempt (not just on retry) so a fresh QtyOnHand/RowVersion pair is
            // always read right before the check-then-decrement below.
            var lot = await _db.InventoryItems.FirstOrDefaultAsync(i => i.Id == inventoryItemId, ct)
                ?? throw new KeyNotFoundException($"ไม่พบ inventory item id={inventoryItemId}");

            if (lot.QtyOnHand < qty)
            {
                throw new InsufficientStockException($"คงเหลือ {lot.QtyOnHand} ชิ้น แต่ขอเบิก {qty} ชิ้น");
            }

            lot.QtyOnHand -= qty;
            lot.Status = lot.QtyOnHand == 0 ? InventoryItemStatus.Depleted : InventoryItemStatus.InStock;
            lot.RowVersion += 1;

            var withdrawal = new InventoryWithdrawal
            {
                InventoryItemId = inventoryItemId,
                Qty = qty,
                WithdrawalReasonId = withdrawalReasonId,
                WithdrawnByUserId = withdrawnByUserId,
                WithdrawnAt = DateTime.UtcNow,
                Note = note,
            };
            _db.InventoryWithdrawals.Add(withdrawal);

            try
            {
                await _db.SaveChangesAsync(ct);
                return withdrawal;
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyRetries)
            {
                // Someone else withdrew from this same lot between our read and our write —
                // detach the failed attempt's tracked entities and retry with a fresh read
                // rather than surfacing a raw concurrency error for what's a routine race.
                foreach (var entry in _db.ChangeTracker.Entries().ToList())
                {
                    entry.State = EntityState.Detached;
                }
            }
        }

        throw new InvalidOperationException($"เบิกของไม่สำเร็จหลังลอง {MaxConcurrencyRetries} ครั้ง (มีการเบิกซ้อนกันถี่เกินไป) กรุณาลองใหม่");
    }
}
