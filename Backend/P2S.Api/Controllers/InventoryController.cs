using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly P2SDbContext _db;
    private readonly IInventoryService _inventoryService;

    public InventoryController(P2SDbContext db, IInventoryService inventoryService)
    {
        _db = db;
        _inventoryService = inventoryService;
    }

    [HttpGet]
    public async Task<ActionResult<List<InventoryItemResponse>>> List([FromQuery] string? status, [FromQuery] int? productId, CancellationToken ct)
    {
        var query = _db.InventoryItems
            .Include(i => i.Product)
            .Include(i => i.OrderItem).ThenInclude(o => o.PurchaseOrder).ThenInclude(o => o.Platform)
            .Include(i => i.OrderItem).ThenInclude(o => o.PurchaseOrder).ThenInclude(o => o.OrderedByUser)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<InventoryItemStatus>(status, out var parsedStatus))
        {
            query = query.Where(i => i.Status == parsedStatus);
        }
        if (productId is not null) query = query.Where(i => i.ProductId == productId);

        var items = await query.OrderByDescending(i => i.ReceivedAt).ToListAsync(ct);
        return Ok(items.Select(i => new InventoryItemResponse(
            i.Id, i.ProductId, i.Product.Name, i.Product.SkuCode, i.QtyReceived, i.QtyOnHand,
            i.OrderItemId, i.OrderItem.PurchaseOrder.Platform.Code, i.OrderItem.PurchaseOrder.PlatformOrderNo,
            i.OrderItem.PurchaseOrder.OrderedByUserId, i.OrderItem.PurchaseOrder.OrderedByUser.Username,
            i.CostPerUnit, i.Status.ToString(), i.ReceivedAt)).ToList());
    }

    [HttpPost("{id:int}/withdraw")]
    public async Task<ActionResult<InventoryWithdrawalResponse>> Withdraw(int id, WithdrawRequest request, CancellationToken ct)
    {
        try
        {
            var withdrawal = await _inventoryService.WithdrawAsync(id, request.Qty, request.WithdrawalReasonId, this.CurrentUserId(), request.Note, ct);
            return Ok(new InventoryWithdrawalResponse(withdrawal.Id, withdrawal.InventoryItemId, withdrawal.Qty, withdrawal.WithdrawnAt));
        }
        catch (InsufficientStockException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
