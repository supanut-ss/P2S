using P2S.Api.Data.Entities;

namespace P2S.Api.Services;

public static class ReimbursementAmountCalculator
{
    public static decimal Calculate(PurchaseOrder order)
    {
        var originalAmount = order.ActualPaidAmount ?? order.OrderItems
            .Where(item => item.Status is not (OrderItemStatus.Cancelled or OrderItemStatus.Returned))
            .Sum(item => item.Qty * item.UnitPrice);
        var settledRefunds = order.OrderItems
            .SelectMany(item => item.Cancellations)
            .Where(cancellation => cancellation.Status != CancellationStatus.RefundPending)
            .Sum(cancellation => cancellation.RefundAmount);

        return Math.Max(0m, originalAmount - settledRefunds);
    }
}
