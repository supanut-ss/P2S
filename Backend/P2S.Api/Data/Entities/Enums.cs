namespace P2S.Api.Data.Entities;

public enum PurchaseOrderStatus
{
    Ordered,
    PaidByStaff,
    Reimbursed,
    PaidByCompany
}

public enum OrderItemStatus
{
    Pending,
    Arrived,
    Cancelled,
    Returned
}

public enum PaymentSource
{
    StaffAdvance,
    CompanyDirect
}

public enum ReimbursementStatus
{
    Pending,
    Approved,
    Paid,
    Voided
}

public enum InventoryItemStatus
{
    InStock,
    Depleted
}

public enum CancellationStatus
{
    RefundPending,
    Refunded,
    Adjusted
}

public enum StaffLedgerEntryType
{
    AdvancePaid,
    Reimbursed,
    RefundDue,
    RefundSettled,
    Adjustment
}

public enum DeliveryMatchMethod
{
    Barcode,
    ManualTrackingEntry,
    OrderNumberSearch
}

public enum GoodsReceiptEventType
{
    Receipt,
    Reversal
}

public enum GoodsReceiptEntryMethod
{
    OrderNumber
}
