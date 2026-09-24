using Microsoft.EntityFrameworkCore;
using P2S.Api.Data;
using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public class ReimbursementService : IReimbursementService
{
    private readonly P2SDbContext _db;

    public ReimbursementService(P2SDbContext db)
    {
        _db = db;
    }

    public async Task<Reimbursement> CreateAsync(int requestedByUserId, List<int> purchaseOrderIds, CancellationToken ct)
    {
        if (purchaseOrderIds.Count == 0)
        {
            throw new ArgumentException("ต้องเลือกอย่างน้อย 1 ออเดอร์", nameof(purchaseOrderIds));
        }

        var orders = await _db.PurchaseOrders
            .Include(o => o.OrderItems).ThenInclude(i => i.Cancellations)
            .Where(o => purchaseOrderIds.Contains(o.Id))
            .ToListAsync(ct);

        if (orders.Count != purchaseOrderIds.Distinct().Count())
        {
            throw new ArgumentException("มีออเดอร์ที่ไม่พบในรายการ", nameof(purchaseOrderIds));
        }

        var otherOwners = orders.Where(o => o.OrderedByUserId != requestedByUserId).ToList();
        if (otherOwners.Count > 0)
        {
            throw new InvalidOperationException("ขอเบิกได้เฉพาะออเดอร์ที่ตนเองสำรองจ่าย");
        }

        var notPaidByStaff = orders.Where(o => o.Status != PurchaseOrderStatus.PaidByStaff || o.PaymentSource == PaymentSource.CompanyDirect).ToList();
        if (notPaidByStaff.Count > 0)
        {
            throw new InvalidOperationException(
                $"ออเดอร์ #{string.Join(", ", notPaidByStaff.Select(o => o.PlatformOrderNo))} ยังไม่ได้ mark-paid หรือถูกเบิกไปแล้ว");
        }

        // order.Status only flips to Reimbursed once a reimbursement is actually Paid, not
        // when it's merely requested — so without this check, the same PaidByStaff order
        // could be selected into a second, overlapping reimbursement while the first one is
        // still sitting Pending/Approved.
        var orderIds = orders.Select(o => o.Id).ToList();
        var alreadyRequested = await _db.Reimbursements
            .Where(r => (r.Status == ReimbursementStatus.Pending || r.Status == ReimbursementStatus.Approved) && r.PurchaseOrders.Any(po => orderIds.Contains(po.Id)))
            .SelectMany(r => r.PurchaseOrders.Where(po => orderIds.Contains(po.Id)))
            .Select(po => po.PlatformOrderNo)
            .ToListAsync(ct);
        if (alreadyRequested.Count > 0)
        {
            throw new InvalidOperationException(
                $"ออเดอร์ #{string.Join(", ", alreadyRequested.Distinct())} มีคำขอเบิกเงินที่ยังไม่จ่ายอยู่แล้ว");
        }

        var pendingRefunds = orders
            .SelectMany(o => o.OrderItems.SelectMany(i => i.Cancellations))
            .Where(c => c.Status == CancellationStatus.RefundPending)
            .ToList();
        if (pendingRefunds.Count > 0)
        {
            throw new InvalidOperationException("ต้องเคลียร์รายการคืนเงินที่ค้างอยู่ก่อนส่งคำขอเบิก");
        }

        var totalAmount = orders.Sum(ReimbursementAmountCalculator.Calculate);
        if (totalAmount <= 0)
        {
            throw new InvalidOperationException("ยอดสุทธิที่ขอเบิกต้องมากกว่า 0 บาท");
        }

        var reimbursement = new Reimbursement
        {
            RequestedByUserId = requestedByUserId,
            Status = ReimbursementStatus.Pending,
            TotalAmount = totalAmount,
            RequestedAt = DateTime.UtcNow,
            PurchaseOrders = orders,
        };
        foreach (var order in orders)
        {
            order.RowVersion += 1;
        }
        _db.Reimbursements.Add(reimbursement);
        await _db.SaveChangesAsync(ct);
        return reimbursement;
    }

    public async Task<Reimbursement> ApproveAsync(int reimbursementId, CancellationToken ct, int? approvedByUserId = null)
    {
        var reimbursement = await GetTrackedAsync(reimbursementId, ct);
        if (reimbursement.Status != ReimbursementStatus.Pending)
        {
            throw new InvalidOperationException($"Reimbursement นี้อยู่ในสถานะ {reimbursement.Status} แล้ว ไม่ใช่ Pending");
        }

        var orderIds = reimbursement.PurchaseOrders.Select(order => order.Id).ToList();
        if (await _db.Cancellations.AnyAsync(c => orderIds.Contains(c.OrderItem.PurchaseOrderId) && c.Status == CancellationStatus.RefundPending, ct))
        {
            throw new InvalidOperationException("ยังอนุมัติไม่ได้จนกว่าจะเคลียร์รายการคืนเงินที่ผูกกับออเดอร์นี้");
        }

        reimbursement.Status = ReimbursementStatus.Approved;
        reimbursement.ApprovedAt = DateTime.UtcNow;
        reimbursement.ApprovedByUserId = approvedByUserId;
        reimbursement.RowVersion += 1;
        await _db.SaveChangesAsync(ct);
        return reimbursement;
    }

    public async Task<Reimbursement> CorrectOrderPaymentAmountAsync(
        int reimbursementId,
        int purchaseOrderId,
        decimal actualPaidAmount,
        string reason,
        int correctedByUserId,
        CancellationToken ct)
    {
        if (actualPaidAmount < 0 || decimal.Round(actualPaidAmount, 2) != actualPaidAmount)
        {
            throw new ArgumentException("ยอดจ่ายจริงต้องเป็นจำนวนเงินตั้งแต่ 0 บาท และมีทศนิยมไม่เกิน 2 ตำแหน่ง", nameof(actualPaidAmount));
        }

        reason = reason?.Trim() ?? string.Empty;
        if (reason.Length == 0 || reason.Length > 500)
        {
            throw new ArgumentException("กรุณาระบุเหตุผลไม่เกิน 500 ตัวอักษร", nameof(reason));
        }

        var reimbursement = await _db.Reimbursements
            .Include(r => r.PurchaseOrders).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Cancellations)
            .FirstOrDefaultAsync(r => r.Id == reimbursementId, ct)
            ?? throw new KeyNotFoundException($"ไม่พบ reimbursement id={reimbursementId}");

        if (reimbursement.Status is not (ReimbursementStatus.Pending or ReimbursementStatus.Approved))
        {
            throw new InvalidOperationException("แก้ยอดได้เฉพาะคำขอที่รอตรวจสอบหรืออนุมัติแล้วและยังไม่จ่ายเงิน");
        }

        var order = reimbursement.PurchaseOrders.FirstOrDefault(o => o.Id == purchaseOrderId)
            ?? throw new KeyNotFoundException($"ไม่พบออเดอร์ #{purchaseOrderId} ในคำขอนี้");
        if (order.PaymentSource != PaymentSource.StaffAdvance || order.Status != PurchaseOrderStatus.PaidByStaff)
        {
            throw new InvalidOperationException("แก้ยอดได้เฉพาะออเดอร์ที่พนักงานสำรองจ่ายและยังไม่รับเงินคืน");
        }

        var previousAmount = order.ActualPaidAmount ?? order.OrderItems
            .Where(item => item.Status is not (OrderItemStatus.Cancelled or OrderItemStatus.Returned))
            .Sum(item => item.Qty * item.UnitPrice);
        if (previousAmount == actualPaidAmount)
        {
            throw new InvalidOperationException("ยอดใหม่ต้องแตกต่างจากยอดเดิม");
        }

        var settledRefunds = order.OrderItems
            .SelectMany(item => item.Cancellations)
            .Where(cancellation => cancellation.Status != CancellationStatus.RefundPending)
            .Sum(cancellation => cancellation.RefundAmount);
        if (actualPaidAmount < settledRefunds)
        {
            throw new InvalidOperationException("ยอดจ่ายจริงต้องไม่น้อยกว่ายอดคืนเงินที่เคลียร์แล้ว");
        }

        var previousStatus = reimbursement.Status;
        _db.PurchaseOrderPaymentCorrections.Add(new PurchaseOrderPaymentCorrection
        {
            PurchaseOrderId = order.Id,
            ReimbursementId = reimbursement.Id,
            PreviousActualPaidAmount = previousAmount,
            CorrectedActualPaidAmount = actualPaidAmount,
            PreviousRequestStatus = previousStatus,
            PreviousApprovedByUserId = reimbursement.ApprovedByUserId,
            PreviousApprovedAt = reimbursement.ApprovedAt,
            CorrectedByUserId = correctedByUserId,
            CorrectedAt = DateTime.UtcNow,
            Reason = reason,
        });

        order.ActualPaidAmount = actualPaidAmount;
        order.RowVersion += 1;

        var payerUserId = order.PaymentPayerUserId ?? order.OrderedByUserId;
        var hasAdvanceLedgerEntry = await _db.StaffLedgerEntries.AnyAsync(
            entry => entry.RelatedPurchaseOrderId == order.Id && entry.EntryType == StaffLedgerEntryType.AdvancePaid,
            ct);
        if (hasAdvanceLedgerEntry)
        {
            _db.StaffLedgerEntries.Add(new StaffLedgerEntry
            {
                UserId = payerUserId,
                EntryType = StaffLedgerEntryType.Adjustment,
                Amount = actualPaidAmount - previousAmount,
                RelatedPurchaseOrderId = order.Id,
                RelatedReimbursementId = reimbursement.Id,
                Note = $"แก้ยอดจ่ายจริงออเดอร์ {order.PlatformOrderNo}: {previousAmount:N2} → {actualPaidAmount:N2} บาท — {reason}",
            });
        }
        else
        {
            // Older records may not have an AdvancePaid line; seed the corrected principal so
            // the staff balance remains accurate without losing the correction audit trail.
            _db.StaffLedgerEntries.Add(new StaffLedgerEntry
            {
                UserId = payerUserId,
                EntryType = StaffLedgerEntryType.AdvancePaid,
                Amount = actualPaidAmount,
                RelatedPurchaseOrderId = order.Id,
                RelatedReimbursementId = reimbursement.Id,
                Note = $"บันทึกยอดสำรองจ่ายที่แก้ไขแล้วสำหรับออเดอร์ {order.PlatformOrderNo} — {reason}",
            });
        }

        reimbursement.TotalAmount = reimbursement.PurchaseOrders.Sum(ReimbursementAmountCalculator.Calculate);
        if (reimbursement.TotalAmount <= 0)
        {
            reimbursement.Status = ReimbursementStatus.Voided;
            reimbursement.ApprovedAt = null;
            reimbursement.ApprovedByUserId = null;
        }
        else if (previousStatus == ReimbursementStatus.Approved)
        {
            reimbursement.Status = ReimbursementStatus.Pending;
            reimbursement.ApprovedAt = null;
            reimbursement.ApprovedByUserId = null;
        }
        reimbursement.RowVersion += 1;

        await _db.SaveChangesAsync(ct);
        return reimbursement;
    }

    public async Task<Reimbursement> PayAsync(int reimbursementId, CancellationToken ct, int? paidByUserId = null)
    {
        var reimbursement = await GetTrackedAsync(reimbursementId, ct);
        if (reimbursement.Status != ReimbursementStatus.Approved)
        {
            throw new InvalidOperationException($"Reimbursement นี้อยู่ในสถานะ {reimbursement.Status} แล้ว ต้อง Approved ก่อนจ่ายได้");
        }

        await _db.Entry(reimbursement).Collection(r => r.PurchaseOrders).Query()
            .Include(o => o.OrderItems).ThenInclude(i => i.Cancellations)
            .LoadAsync(ct);

        if (reimbursement.PurchaseOrders.SelectMany(o => o.OrderItems).SelectMany(i => i.Cancellations)
            .Any(c => c.Status == CancellationStatus.RefundPending))
        {
            throw new InvalidOperationException("ยังจ่ายไม่ได้จนกว่าจะเคลียร์รายการคืนเงินที่ผูกกับออเดอร์นี้");
        }

        var currentTotal = reimbursement.PurchaseOrders.Sum(ReimbursementAmountCalculator.Calculate);
        if (currentTotal != reimbursement.TotalAmount)
        {
            throw new InvalidOperationException("ยอดคำขอเปลี่ยนหลังอนุมัติ กรุณาตรวจสอบและอนุมัติยอดใหม่ก่อนจ่าย");
        }
        if (currentTotal <= 0)
        {
            throw new InvalidOperationException("ยอดสุทธิเป็น 0 บาท ไม่สามารถจ่ายคำขอนี้ได้");
        }

        reimbursement.Status = ReimbursementStatus.Paid;
        reimbursement.PaidAt = DateTime.UtcNow;
        reimbursement.PaidByUserId = paidByUserId;
        reimbursement.RowVersion += 1;
        foreach (var order in reimbursement.PurchaseOrders)
        {
            order.Status = PurchaseOrderStatus.Reimbursed;
            order.RowVersion += 1;
        }

        _db.StaffLedgerEntries.Add(new StaffLedgerEntry
        {
            UserId = reimbursement.RequestedByUserId,
            EntryType = StaffLedgerEntryType.Reimbursed,
            Amount = -reimbursement.TotalAmount,
            RelatedReimbursementId = reimbursement.Id,
            Note = $"บริษัทจ่ายคืนตามคำขอเบิก #{reimbursement.Id}",
        });

        await _db.SaveChangesAsync(ct);
        return reimbursement;
    }

    private async Task<Reimbursement> GetTrackedAsync(int id, CancellationToken ct) =>
        await _db.Reimbursements
            .Include(r => r.PurchaseOrders)
            .FirstOrDefaultAsync(r => r.Id == id, ct)
        ?? throw new KeyNotFoundException($"ไม่พบ reimbursement id={id}");
}
