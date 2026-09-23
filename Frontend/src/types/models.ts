// Mirrors the flat response DTOs in Backend/P2S.Api/Dtos exactly (field-for-field) —
// intentionally not a mirror of the EF entities, since the API never returns those directly.

export type PurchaseOrderStatus = 'Ordered' | 'PaidByStaff' | 'Reimbursed';
export type OrderItemStatus = 'Pending' | 'Arrived' | 'Cancelled';
export type ReimbursementStatus = 'Pending' | 'Approved' | 'Paid';
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
  purchaseOrderIds: number[];
}

export interface CancellationResponse {
  id: number;
  orderItemId: number;
  productName: string;
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
