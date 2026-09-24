namespace P2S.Api.Dtos;

public record CreateReimbursementRequest(List<int> PurchaseOrderIds);

public record CorrectOrderPaymentAmountRequest(decimal ActualPaidAmount, string Reason);

public record ReimbursementResponse(
    int Id,
    int RequestedByUserId,
    string RequestedByUsername,
    string Status,
    decimal TotalAmount,
    DateTime RequestedAt,
    DateTime? ApprovedAt,
    DateTime? PaidAt,
    string? ApprovedByUsername,
    string? PaidByUsername,
    List<int> PurchaseOrderIds,
    List<ReimbursementOrderDetailResponse> PurchaseOrders
);

public record ReimbursementOrderDetailResponse(
    int Id,
    string PlatformCode,
    string PlatformOrderNo,
    decimal OrderItemAmount,
    decimal? ActualPaidAmount,
    decimal ReimbursableAmount,
    string? PaymentSource,
    string? PaymentPayerUsername,
    string? PaymentRecordedByUsername,
    bool HasPaymentEvidence,
    List<ReimbursementOrderItemDetailResponse> Items,
    List<PaymentAmountCorrectionResponse> AmountCorrections
);

public record PaymentAmountCorrectionResponse(
    int Id,
    int PurchaseOrderId,
    decimal PreviousActualPaidAmount,
    decimal CorrectedActualPaidAmount,
    string PreviousRequestStatus,
    string? PreviousApprovedByUsername,
    DateTime? PreviousApprovedAt,
    string CorrectedByUsername,
    DateTime CorrectedAt,
    string Reason
);

public record ReimbursementOrderItemDetailResponse(
    int Id,
    string ProductName,
    int Qty,
    decimal UnitPrice,
    int ReturnedQty,
    string Status
);

public record StaffBalanceResponse(
    int UserId,
    string Username,
    string FullName,
    decimal Balance,
    decimal TotalAdvanced,
    decimal TotalReimbursed,
    decimal TotalRefundDue,
    decimal TotalAdjustments
);
