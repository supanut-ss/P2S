// Mirrors the flat response DTOs in Backend/P2S.Api/Dtos exactly (field-for-field) —
// intentionally not a mirror of the EF entities, since the API never returns those directly.

export type PurchaseOrderStatus = 'Ordered' | 'PaidByStaff' | 'Reimbursed' | 'PaidByCompany';
export type OrderItemStatus = 'Pending' | 'Arrived' | 'Cancelled' | 'Returned';
export type PaymentSource = 'StaffAdvance' | 'CompanyDirect';
export type ReimbursementStatus = 'Pending' | 'Approved' | 'Paid' | 'Voided';
export type InventoryItemStatus = 'InStock' | 'Depleted';
export type CancellationStatus = 'RefundPending' | 'Refunded' | 'Adjusted';
export type DeliveryMatchMethod = 'Barcode' | 'ManualTrackingEntry' | 'OrderNumberSearch';

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
  items: OrderItemResponse[];
}

export interface PendingOrderItemResponse {
  orderItemId: number;
  purchaseOrderId: number;
  platformCode: string;
  platformOrderNo: string;
  productName: string;
  qty: number;
  unitPrice: number;
  trackingNo: string | null;
  courier: string | null;
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
