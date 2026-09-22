namespace P2S.Api.Data.Entities;

public enum PurchaseOrderStatus
{
    Ordered,
    PaidByStaff,
    Reimbursed
}

public enum OrderItemStatus
{
    Pending,
    Arrived,
    Cancelled
}

public enum ReimbursementStatus
{
    Pending,
    Approved,
    Paid
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
