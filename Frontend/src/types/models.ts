// Mirrors the flat response DTOs in Backend/P2S.Api/Dtos exactly (field-for-field) —
// intentionally not a mirror of the EF entities, since the API never returns those directly.

export type PurchaseOrderStatus = 'Ordered' | 'PaidByStaff' | 'Reimbursed' | 'PaidByCompany';
export type OrderItemStatus = 'Pending' | 'Arrived' | 'Cancelled' | 'Returned';
export type PaymentSource = 'StaffAdvance' | 'CompanyDirect';
export type ReimbursementStatus = 'Pending' | 'Approved' | 'Paid' | 'Voided';
export type InventoryItemStatus = 'InStock' | 'Depleted';
export type CancellationStatus = 'RefundPending' | 'Refunded' | 'Adjusted';
export interface ProductResponse {
  id: number;
  name: string;
  skuCode: string;
  category: string;
  unit: string;
  isActive: boolean;
}

export interface PlatformResponse {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface WithdrawalReasonResponse {
  id: number;
  name: string;
  isActive: boolean;
}

export interface UserResponse {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  cardLast4: string | null;
}

export interface OrderItemResponse {
  id: number;
  productId: number;
  productName: string;
  model: string | null;
  description: string | null;
  qty: number;
  unitPrice: number;
  status: OrderItemStatus;
  returnedQty: number;
  trackingNo: string | null;
  courier: string | null;
  arrivedAt: string | null;
  cancelledAt: string | null;
}

export interface PurchaseOrderResponse {
  id: number;
  platformCode: string;
  platformOrderNo: string;
  packageName: string | null;
  shopName: string | null;
  totalAmount: number;
  status: PurchaseOrderStatus;
  orderedAt: string;
  orderedByUserId: number;
  orderedByUsername: string;
  actualPaidAmount: number | null;
  reimbursableAmount: number | null;
  paymentSource: PaymentSource | null;
  paymentPayerUserId: number | null;
  paymentPayerUsername: string | null;
  paymentRecordedByUsername: string | null;
  paidAt: string | null;
  hasPaymentEvidence: boolean;
  plannedPaymentSource: PaymentSource | null;
  plannedPaymentPayerUserId: number | null;
  plannedPaymentPayerUsername: string | null;
  items: OrderItemResponse[];
}

export interface PendingOrderItemResponse {
  orderItemId: number;
  purchaseOrderId: number;
  platformCode: string;
  platformOrderNo: string;
  productName: string;
  qty: number;
  receivedQty: number;
  remainingQty: number;
  unitPrice: number;
  status: string;
}

export interface GoodsReceiptOrderResponse {
  purchaseOrderId: number;
  platformCode: string;
  platformOrderNo: string;
  packageName: string | null;
  shopName: string | null;
  orderedAt: string;
  items: GoodsReceiptOrderLineResponse[];
  receiptHistory: GoodsReceiptEventResponse[];
}

export interface GoodsReceiptOrderLineResponse {
  orderItemId: number;
  productName: string;
  skuCode: string;
  model: string | null;
  trackingNo: string | null;
  arrivedAt: string | null;
  description: string | null;
  qty: number;
  receivedQty: number;
  remainingQty: number;
  unitPrice: number;
  status: string;
}

export interface GoodsReceiptEventResponse {
  id: number;
  eventType: 'Receipt' | 'Reversal';
  occurredAt: string;
  actorUsername: string;
  lineCount: number;
  unitCount: number;
  reason: string | null;
  isReversed: boolean;
  reversesEventId: number | null;
  lines: GoodsReceiptHistoryLineResponse[];
}

export interface GoodsReceiptHistoryLineResponse {
  productName: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
}

export interface InventoryItemResponse {
  id: number;
  productId: number;
  productName: string;
  skuCode: string;
  qtyReceived: number;
  qtyOnHand: number;
  orderItemId: number;
  platformCode: string;
  platformOrderNo: string;
  orderedByUserId: number;
  orderedByUsername: string;
  costPerUnit: number;
  status: InventoryItemStatus;
  receivedAt: string;
}

export interface ReimbursementResponse {
  id: number;
  requestedByUserId: number;
  requestedByUsername: string;
  status: ReimbursementStatus;
  totalAmount: number;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  approvedByUsername: string | null;
  paidByUsername: string | null;
  purchaseOrderIds: number[];
  purchaseOrders: ReimbursementOrderDetailResponse[];
}

export interface PaymentPayerResponse {
  id: number;
  username: string;
  fullName: string;
  role: string;
}

export interface ReimbursementOrderDetailResponse {
  id: number;
  platformCode: string;
  platformOrderNo: string;
  orderItemAmount: number;
  actualPaidAmount: number | null;
  reimbursableAmount: number;
  paymentSource: PaymentSource | null;
  paymentPayerUsername: string | null;
  paymentRecordedByUsername: string | null;
  hasPaymentEvidence: boolean;
  items: ReimbursementOrderItemDetailResponse[];
  amountCorrections: PaymentAmountCorrectionResponse[];
}

export interface PaymentAmountCorrectionResponse {
  id: number;
  purchaseOrderId: number;
  previousActualPaidAmount: number;
  correctedActualPaidAmount: number;
  previousRequestStatus: ReimbursementStatus;
  previousApprovedByUsername: string | null;
  previousApprovedAt: string | null;
  correctedByUsername: string;
  correctedAt: string;
  reason: string;
}

export interface ReimbursementOrderItemDetailResponse {
  id: number;
  productName: string;
  qty: number;
  unitPrice: number;
  returnedQty: number;
  status: OrderItemStatus;
}

export interface StaffBalanceResponse {
  userId: number;
  username: string;
  fullName: string;
  balance: number;
  totalAdvanced: number;
  totalReimbursed: number;
  totalRefundDue: number;
  totalAdjustments: number;
}

export interface CancellationResponse {
  id: number;
  orderItemId: number;
  productName: string;
  purchaseOrderId: number;
  platformCode: string;
  platformOrderNo: string;
  requestedByUsername: string;
  reportedByUsername: string | null;
  resolvedByUsername: string | null;
  quantity: number;
  refundAmount: number;
  reimbursementId: number | null;
  status: CancellationStatus;
  flaggedAt: string;
  resolvedAt: string | null;
  note: string | null;
}

export interface DailyFinanceSnapshotResponse {
  snapshotDate: string;
  totalOrderedAmount: number;
  totalReimbursementPending: number;
  totalInventoryValueToday: number;
  openCancellationsCount: number;
}
