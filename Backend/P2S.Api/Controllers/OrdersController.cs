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
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly P2SDbContext _db;

    public OrdersController(P2SDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    [Authorize(Roles = "staff,admin")]
    public async Task<ActionResult<PurchaseOrderResponse>> Create(CreateOrderRequest request, CancellationToken ct)
    {
        if (request.Items.Count == 0)
        {
            return BadRequest(new { message = "ออเดอร์ต้องมีอย่างน้อย 1 รายการ" });
        }
        if (request.Items.Any(item => item.Qty <= 0 || item.UnitPrice < 0))
        {
            return BadRequest(new { message = "จำนวนสินค้าต้องมากกว่า 0 และราคาต้องไม่ติดลบ" });
        }
        if (string.IsNullOrWhiteSpace(request.PlatformOrderNo))
        {
            return BadRequest(new { message = "กรอกเลขออเดอร์จากแพลตฟอร์ม" });
        }

        var platform = await _db.Platforms.FindAsync([request.PlatformId], ct);
        if (platform is null) return BadRequest(new { message = "ไม่รู้จัก platform" });

        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var productCount = await _db.Products.CountAsync(p => productIds.Contains(p.Id), ct);
        if (productCount != productIds.Count) return BadRequest(new { message = "มีสินค้าที่ไม่รู้จักในรายการ" });

        var order = new PurchaseOrder
        {
            PlatformId = request.PlatformId,
            OrderedByUserId = this.CurrentUserId(),
            PlatformOrderNo = request.PlatformOrderNo.Trim(),
            Status = PurchaseOrderStatus.Ordered,
            TotalAmount = request.Items.Sum(i => i.Qty * i.UnitPrice),
            OrderedAt = DateTime.UtcNow,
        };
        order.OrderItems = request.Items.Select(i => new OrderItem
        {
            ProductId = i.ProductId,
            Qty = i.Qty,
            UnitPrice = i.UnitPrice,
            Status = OrderItemStatus.Pending,
        }).ToList();

        if (await _db.PurchaseOrders.AnyAsync(o => o.PlatformId == order.PlatformId && o.PlatformOrderNo == order.PlatformOrderNo, ct))
        {
            return Conflict(new { message = $"เลขออเดอร์ '{order.PlatformOrderNo}' มีอยู่แล้วในแพลตฟอร์มนี้" });
        }

        _db.PurchaseOrders.Add(order);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is MySqlException { Number: 1062 })
        {
            return Conflict(new { message = $"เลขออเดอร์ '{order.PlatformOrderNo}' มีอยู่แล้วในแพลตฟอร์มนี้" });
        }

        return Ok(await ToResponse(order.Id, ct));
    }

    [HttpGet]
    public async Task<ActionResult<List<PurchaseOrderResponse>>> List(
        [FromQuery] int? platformId,
        [FromQuery] int? userId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] bool excludeRequested,
        CancellationToken ct)
    {
        var query = _db.PurchaseOrders
            .Include(o => o.Platform)
            .Include(o => o.OrderedByUser)
            .Include(o => o.PaymentPayerUser)
            .Include(o => o.PaymentRecordedByUser)
            .Include(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(o => o.OrderItems).ThenInclude(i => i.Cancellations)
            .AsQueryable();

        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(o => o.OrderedByUserId == currentUserId);
        }

        if (platformId is not null) query = query.Where(o => o.PlatformId == platformId);
        if (userId is not null) query = query.Where(o => o.OrderedByUserId == userId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PurchaseOrderStatus>(status, out var parsedStatus))
        {
            query = query.Where(o => o.Status == parsedStatus);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(o => o.PlatformOrderNo.Contains(search));
        }

        // Used by the reimbursement-request picker: a PaidByStaff order stays PaidByStaff
        // until its reimbursement is actually Paid (not merely requested), so without this it
        // would keep showing as selectable even while a Pending/Approved request already
        // covers it — see ReimbursementService.CreateAsync for the matching server-side guard.
        if (excludeRequested)
        {
            var requestedOrderIds = await _db.Reimbursements
                .Where(r => r.Status == ReimbursementStatus.Pending || r.Status == ReimbursementStatus.Approved)
                .SelectMany(r => r.PurchaseOrders.Select(po => po.Id))
                .ToListAsync(ct);
            var currentUserId = this.CurrentUserId();
            query = query.Where(o => o.OrderedByUserId == currentUserId && !requestedOrderIds.Contains(o.Id));
        }

        var orders = await query.OrderByDescending(o => o.OrderedAt).ToListAsync(ct);
        return Ok(orders.Select(MapToResponse).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PurchaseOrderResponse>> Get(int id, CancellationToken ct)
    {
        var response = await ToResponse(id, ct);
        return response is null ? NotFound() : Ok(response);
    }

    /// <summary>Records the actual payment source, payer, amount, and optional receipt. Staff advances create a ledger entry; company-direct payments do not.</summary>
    [HttpPost("{id:int}/mark-paid")]
    [Authorize(Roles = "staff,admin")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult<PurchaseOrderResponse>> MarkPaid(int id, [FromForm] MarkOrderPaidRequest request, CancellationToken ct)
    {
        var order = await _db.PurchaseOrders.FindAsync([id], ct);
        if (order is null) return NotFound();
        if (!User.IsInRole("admin") && order.OrderedByUserId != this.CurrentUserId()) return NotFound();
        if (order.Status != PurchaseOrderStatus.Ordered)
        {
            return BadRequest(new { message = $"ออเดอร์นี้อยู่ในสถานะ {order.Status} แล้ว ไม่สามารถ mark-paid ซ้ำได้" });
        }

        if (!Enum.TryParse<PaymentSource>(request.PaymentSource, true, out var paymentSource) || !Enum.IsDefined(paymentSource))
        {
            return BadRequest(new { message = "เลือกวิธีจ่ายเงินไม่ถูกต้อง" });
        }
        if (request.ActualPaidAmount < 0)
        {
            return BadRequest(new { message = "ยอดจ่ายจริงต้องไม่ติดลบ" });
        }

        var payerUserId = request.PaymentPayerUserId ?? order.OrderedByUserId;
        if (paymentSource == PaymentSource.StaffAdvance && payerUserId != order.OrderedByUserId)
        {
            return BadRequest(new { message = "กรณีพนักงานสำรองจ่าย ผู้เบิกต้องเป็นเจ้าของออเดอร์" });
        }
        if (!await _db.Users.AnyAsync(u => u.Id == payerUserId && (paymentSource == PaymentSource.StaffAdvance || u.IsActive), ct))
        {
            return BadRequest(new { message = "ไม่พบผู้จ่ายเงินที่ใช้งานอยู่" });
        }

        var cancellationCases = await _db.Cancellations
            .Where(c => c.OrderItem.PurchaseOrderId == order.Id)
            .ToListAsync(ct);
        if (cancellationCases.Sum(c => c.RefundAmount) > request.ActualPaidAmount)
        {
            return BadRequest(new { message = "ยอดคืนรวมเกินยอดจ่ายจริงของออเดอร์" });
        }

        byte[]? evidenceBytes = null;
        string? evidenceContentType = null;
        string? evidenceFileName = null;
        if (request.Evidence is not null)
        {
            if (request.Evidence.Length is <= 0 or > 5 * 1024 * 1024)
            {
                return BadRequest(new { message = "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB" });
            }

            var extension = Path.GetExtension(request.Evidence.FileName).ToLowerInvariant();
            evidenceContentType = extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".pdf" => "application/pdf",
                _ => null,
            };
            if (evidenceContentType is null)
            {
                return BadRequest(new { message = "แนบได้เฉพาะไฟล์ JPG, PNG หรือ PDF" });
            }

            var prefix = new byte[8];
            await using (var stream = request.Evidence.OpenReadStream())
            {
                var read = Math.Min(prefix.Length, (int)request.Evidence.Length);
                await stream.ReadExactlyAsync(prefix.AsMemory(0, read), ct);
                var validSignature = extension switch
                {
                    ".jpg" or ".jpeg" => read >= 3 && prefix[0] == 0xff && prefix[1] == 0xd8 && prefix[2] == 0xff,
                    ".png" => read >= 8 && prefix.SequenceEqual(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }),
                    ".pdf" => read >= 5 && prefix[0] == '%' && prefix[1] == 'P' && prefix[2] == 'D' && prefix[3] == 'F' && prefix[4] == '-',
                    _ => false,
                };
                if (!validSignature)
                {
                    return BadRequest(new { message = "ชนิดไฟล์หลักฐานไม่ตรงกับนามสกุลไฟล์" });
                }

                stream.Position = 0;
                using var buffer = new MemoryStream((int)request.Evidence.Length);
                await stream.CopyToAsync(buffer, ct);
                evidenceBytes = buffer.ToArray();
            }
            evidenceFileName = Path.GetFileName(request.Evidence.FileName);
        }

        order.ActualPaidAmount = request.ActualPaidAmount;
        order.PaymentSource = paymentSource;
        order.PaymentPayerUserId = payerUserId;
        order.PaymentRecordedByUserId = this.CurrentUserId();
        order.PaidAt = DateTime.UtcNow;
        order.PaymentEvidence = evidenceBytes;
        order.PaymentEvidenceContentType = evidenceContentType;
        order.PaymentEvidenceFileName = evidenceFileName;
        order.RowVersion += 1;

        if (paymentSource == PaymentSource.StaffAdvance)
        {
            order.Status = PurchaseOrderStatus.PaidByStaff;
            _db.StaffLedgerEntries.Add(new StaffLedgerEntry
            {
                UserId = payerUserId,
                EntryType = StaffLedgerEntryType.AdvancePaid,
                Amount = request.ActualPaidAmount,
                RelatedPurchaseOrderId = order.Id,
                Note = $"สำรองจ่ายออเดอร์ {order.PlatformOrderNo}",
            });

            var settledRefunds = cancellationCases
                .Where(c => c.Status != CancellationStatus.RefundPending && c.ReimbursementId == null);
            foreach (var cancellation in settledRefunds.Where(cancellation => cancellation.RefundAmount > 0))
            {
                _db.StaffLedgerEntries.Add(new StaffLedgerEntry
                {
                    UserId = payerUserId,
                    EntryType = StaffLedgerEntryType.Adjustment,
                    Amount = -cancellation.RefundAmount,
                    RelatedCancellation = cancellation,
                    Note = $"ปรับยอดสำรองจ่ายจากเงินคืนก่อนบันทึกจ่าย — order item #{cancellation.OrderItemId}",
                });
            }
        }
        else
        {
            order.Status = PurchaseOrderStatus.PaidByCompany;
        }

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "ออเดอร์นี้ถูกบันทึกการจ่ายเงินไปพร้อมกันแล้ว กรุณาโหลดข้อมูลใหม่" });
        }

        return Ok(await ToResponse(id, ct));
    }

    [HttpGet("{id:int}/payment-evidence")]
    [Authorize(Roles = "staff,finance,admin")]
    public async Task<IActionResult> GetPaymentEvidence(int id, CancellationToken ct)
    {
        var order = await _db.PurchaseOrders.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (order is null) return NotFound();
        if (User.IsInRole("staff") && order.OrderedByUserId != this.CurrentUserId() && order.PaymentPayerUserId != this.CurrentUserId()) return NotFound();
        if (order.PaymentEvidence is null || order.PaymentEvidenceContentType is null || order.PaymentEvidenceFileName is null) return NotFound();

        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(order.PaymentEvidence, order.PaymentEvidenceContentType, order.PaymentEvidenceFileName, enableRangeProcessing: true);
    }

    /// <summary>Staff records the shop's tracking number once it ships — required before the
    /// scan-receiving screen can barcode-match this item (see DeliveriesController).</summary>
    [HttpPost("items/{orderItemId:int}/tracking")]
    [Authorize(Roles = "staff,admin")]
    public async Task<IActionResult> SetTracking(int orderItemId, SetTrackingRequest request, CancellationToken ct)
    {
        var item = await _db.OrderItems
            .Include(i => i.PurchaseOrder)
            .FirstOrDefaultAsync(i => i.Id == orderItemId, ct);
        if (item is null) return NotFound();
        if (!User.IsInRole("admin") && item.PurchaseOrder.OrderedByUserId != this.CurrentUserId()) return NotFound();
        if (item.Status != OrderItemStatus.Pending)
        {
            return BadRequest(new { message = $"รายการนี้อยู่ในสถานะ {item.Status} แล้ว ไม่ใช่ Pending" });
        }

        item.TrackingNo = request.TrackingNo;
        item.Courier = request.Courier;
        item.RowVersion += 1;
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "รายการนี้เปลี่ยนพร้อมกัน กรุณาโหลดใหม่" });
        }
        return NoContent();
    }

    private async Task<PurchaseOrderResponse?> ToResponse(int id, CancellationToken ct)
    {
        var query = _db.PurchaseOrders.AsQueryable();
        if (!User.IsInRole("admin"))
        {
            var currentUserId = this.CurrentUserId();
            query = query.Where(o => o.OrderedByUserId == currentUserId);
        }

        var order = await query
            .Include(o => o.Platform)
            .Include(o => o.OrderedByUser)
            .Include(o => o.PaymentPayerUser)
            .Include(o => o.PaymentRecordedByUser)
            .Include(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(o => o.OrderItems).ThenInclude(i => i.Cancellations)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
        return order is null ? null : MapToResponse(order);
    }

    private static PurchaseOrderResponse MapToResponse(PurchaseOrder order) => new(
        order.Id,
        order.Platform.Code,
        order.PlatformOrderNo,
        order.TotalAmount,
        order.Status.ToString(),
        order.OrderedAt,
        order.OrderedByUserId,
        order.OrderedByUser.Username,
        order.ActualPaidAmount,
        order.PaymentSource == PaymentSource.StaffAdvance ? ReimbursementAmountCalculator.Calculate(order) : null,
        order.PaymentSource?.ToString(),
        order.PaymentPayerUserId,
        order.PaymentPayerUser?.Username,
        order.PaymentRecordedByUser?.Username,
        order.PaidAt,
        order.PaymentEvidence is not null,
        order.OrderItems.Select(i => new OrderItemResponse(
            i.Id, i.ProductId, i.Product.Name, i.Qty, i.UnitPrice, i.Status.ToString(), i.ReturnedQty,
            i.TrackingNo, i.Courier, i.ArrivedAt, i.CancelledAt)).ToList()
    );
}
