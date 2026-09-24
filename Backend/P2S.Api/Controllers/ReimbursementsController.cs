using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using P2S.Api.Data;
using P2S.Api.Data.Entities;
using P2S.Api.Dtos;
using P2S.Api.Services;

namespace P2S.Api.Controllers;

[ApiController]
[Route("api/reimbursements")]
[Authorize]
public class ReimbursementsController : ControllerBase
{
    private readonly P2SDbContext _db;
    private readonly IReimbursementService _reimbursementService;

    public ReimbursementsController(P2SDbContext db, IReimbursementService reimbursementService)
    {
        _db = db;
        _reimbursementService = reimbursementService;
    }

    [HttpPost]
    [Authorize(Roles = "staff,admin")]
    public async Task<ActionResult<ReimbursementResponse>> Create(CreateReimbursementRequest request, CancellationToken ct)
    {
        try
        {
            var reimbursement = await _reimbursementService.CreateAsync(this.CurrentUserId(), request.PurchaseOrderIds, ct);
            return Ok(await ToResponse(reimbursement.Id, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "มีการอัปเดตออเดอร์พร้อมกัน กรุณาโหลดใหม่แล้วลองอีกครั้ง" });
        }
        catch (DbUpdateException ex) when (ex.InnerException is MySqlException { Number: 1062 })
        {
            return Conflict(new { message = "มีออเดอร์อย่างน้อยหนึ่งรายการอยู่ในคำขอเบิกอื่นแล้ว" });
        }
    }

    /// <summary>The reimbursement queue (PROJECT-PLAN.md screen 3) — finance filters to
    /// Pending/Approved to work through it as a batch.</summary>
    [HttpGet]
    public async Task<ActionResult<List<ReimbursementResponse>>> List([FromQuery] string? status, CancellationToken ct)
    {
        var query = _db.Reimbursements
            .Include(r => r.RequestedByUser)
            .Include(r => r.ApprovedByUser)
            .Include(r => r.PaidByUser)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.Platform)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.PaymentPayerUser)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.PaymentRecordedByUser)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Cancellations)
            .AsQueryable();

        if (User.IsInRole("staff"))
        {
            query = query.Where(r => r.RequestedByUserId == this.CurrentUserId());
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReimbursementStatus>(status, out var parsedStatus))
        {
            query = query.Where(r => r.Status == parsedStatus);
        }

        var reimbursements = await query.OrderByDescending(r => r.RequestedAt).ToListAsync(ct);
        var corrections = await GetCorrectionsAsync(reimbursements.Select(r => r.Id).ToList(), ct);
        return Ok(reimbursements.Select(r => MapToResponse(r, corrections)).ToList());
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = "finance,admin")]
    public async Task<ActionResult<ReimbursementResponse>> Approve(int id, CancellationToken ct)
    {
        try
        {
            await _reimbursementService.ApproveAsync(id, ct, this.CurrentUserId());
            return Ok(await ToResponse(id, ct));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "คำขอนี้ถูกดำเนินการพร้อมกัน กรุณาโหลดใหม่" }); }
    }

    [HttpPost("{id:int}/pay")]
    [Authorize(Roles = "finance,admin")]
    public async Task<ActionResult<ReimbursementResponse>> Pay(int id, CancellationToken ct)
    {
        try
        {
            await _reimbursementService.PayAsync(id, ct, this.CurrentUserId());
            return Ok(await ToResponse(id, ct));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "คำขอนี้ถูกดำเนินการพร้อมกัน กรุณาโหลดใหม่" }); }
    }

    [HttpPut("{id:int}/orders/{purchaseOrderId:int}/payment-amount")]
    [Authorize(Roles = "finance,admin")]
    public async Task<ActionResult<ReimbursementResponse>> CorrectOrderPaymentAmount(
        int id,
        int purchaseOrderId,
        CorrectOrderPaymentAmountRequest request,
        CancellationToken ct)
    {
        try
        {
            await _reimbursementService.CorrectOrderPaymentAmountAsync(
                id, purchaseOrderId, request.ActualPaidAmount, request.Reason, this.CurrentUserId(), ct);
            return Ok(await ToResponse(id, ct));
        }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "คำขอหรือออเดอร์ถูกแก้ไขพร้อมกัน กรุณาโหลดข้อมูลใหม่" }); }
    }

    private async Task<ReimbursementResponse?> ToResponse(int id, CancellationToken ct)
    {
        var reimbursement = await _db.Reimbursements
            .Include(r => r.RequestedByUser)
            .Include(r => r.ApprovedByUser)
            .Include(r => r.PaidByUser)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.Platform)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.PaymentPayerUser)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.PaymentRecordedByUser)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Cancellations)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (reimbursement is null) return null;
        var corrections = await GetCorrectionsAsync([reimbursement.Id], ct);
        return MapToResponse(reimbursement, corrections);
    }

    private async Task<IReadOnlyDictionary<int, List<PaymentAmountCorrectionResponse>>> GetCorrectionsAsync(
        List<int> reimbursementIds,
        CancellationToken ct)
    {
        if (reimbursementIds.Count == 0) return new Dictionary<int, List<PaymentAmountCorrectionResponse>>();

        var rows = await _db.PurchaseOrderPaymentCorrections
            .Where(correction => reimbursementIds.Contains(correction.ReimbursementId))
            .OrderBy(correction => correction.CorrectedAt)
            .Select(correction => new
            {
                correction.PurchaseOrderId,
                correction.Id,
                correction.PreviousActualPaidAmount,
                correction.CorrectedActualPaidAmount,
                correction.PreviousRequestStatus,
                PreviousApprovedByUsername = correction.PreviousApprovedByUser == null ? null : correction.PreviousApprovedByUser.Username,
                correction.PreviousApprovedAt,
                CorrectedByUsername = correction.CorrectedByUser.Username,
                correction.CorrectedAt,
                correction.Reason,
            })
            .ToListAsync(ct);

        return rows.GroupBy(row => row.PurchaseOrderId)
            .ToDictionary(group => group.Key, group => group.Select(row => new PaymentAmountCorrectionResponse(
                row.Id,
                row.PurchaseOrderId,
                row.PreviousActualPaidAmount,
                row.CorrectedActualPaidAmount,
                row.PreviousRequestStatus.ToString(),
                row.PreviousApprovedByUsername,
                row.PreviousApprovedAt,
                row.CorrectedByUsername,
                row.CorrectedAt,
                row.Reason)).ToList());
    }

    private static ReimbursementResponse MapToResponse(
        Reimbursement r,
        IReadOnlyDictionary<int, List<PaymentAmountCorrectionResponse>> corrections) => new(
        r.Id, r.RequestedByUserId, r.RequestedByUser.Username, r.Status.ToString(), r.TotalAmount,
        r.RequestedAt, r.ApprovedAt, r.PaidAt, r.ApprovedByUser?.Username, r.PaidByUser?.Username,
        r.PurchaseOrders.Select(o => o.Id).ToList(),
        r.PurchaseOrders.Select(o => new ReimbursementOrderDetailResponse(
            o.Id, o.Platform.Code, o.PlatformOrderNo,
            o.OrderItems.Sum(i => i.Qty * i.UnitPrice), o.ActualPaidAmount,
            o.PaymentSource == PaymentSource.StaffAdvance ? ReimbursementAmountCalculator.Calculate(o) : 0m,
            o.PaymentSource?.ToString(), o.PaymentPayerUser?.Username,
            o.PaymentRecordedByUser?.Username, o.PaymentEvidence is not null,
            o.OrderItems.Select(i => new ReimbursementOrderItemDetailResponse(
                i.Id, i.Product.Name, i.Qty, i.UnitPrice, i.ReturnedQty, i.Status.ToString())).ToList(),
            corrections.TryGetValue(o.Id, out var orderCorrections) ? orderCorrections : [])).ToList());
}
