// Mirrors Backend/P2S.Api/Data/Entities and Dtos — keep in sync by hand until an
// OpenAPI-generated client replaces this (tracked as a later improvement, not blocking).

export type PurchaseOrderStatus = 'Ordered' | 'PaidByStaff' | 'Reimbursed';
export type OrderItemStatus = 'Pending' | 'Arrived' | 'Cancelled';
export type ReimbursementStatus = 'Pending' | 'Approved' | 'Paid';
export type InventoryItemStatus = 'InStock' | 'Depleted';
export type CancellationStatus = 'RefundPending' | 'Refunded' | 'Adjusted';
export type StaffLedgerEntryType = 'AdvancePaid' | 'Reimbursed' | 'RefundDue' | 'RefundSettled' | 'Adjustment';
export type DeliveryMatchMethod = 'Barcode' | 'ManualTrackingEntry' | 'OrderNumberSearch';

export interface Role {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  roleId: number;
  role: Role;
  isActive: boolean;
  cardLast4: string | null;
}

export interface Platform {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface WithdrawalReason {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Product {
  id: number;
  name: string;
  skuCode: string;
  unit: string;
  isActive: boolean;
}

export interface PurchaseOrder {
  id: number;
  platformId: number;
  platform: Platform;
  orderedByUserId: number;
  platformOrderNo: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  orderedAt: string;
}

export interface OrderItem {
  id: number;
  purchaseOrderId: number;
  productId: number;
  product: Product;
  qty: number;
  unitPrice: number;
  status: OrderItemStatus;
  trackingNo: string | null;
  courier: string | null;
  arrivedAt: string | null;
  cancelledAt: string | null;
}

export interface InventoryItem {
  id: number;
  productId: number;
  product: Product;
  orderItemId: number;
  qtyReceived: number;
  qtyOnHand: number;
  costPerUnit: number;
  status: InventoryItemStatus;
  receivedAt: string;
  rowVersion: number;
}

export interface InventoryWithdrawal {
  id: number;
  inventoryItemId: number;
  qty: number;
  withdrawalReasonId: number;
  withdrawnByUserId: number;
  withdrawnAt: string;
  note: string | null;
}

export interface Reimbursement {
  id: number;
  requestedByUserId: number;
  status: ReimbursementStatus;
  totalAmount: number;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface Cancellation {
  id: number;
  orderItemId: number;
  reimbursementId: number | null;
  status: CancellationStatus;
  flaggedAt: string;
  resolvedAt: string | null;
  note: string | null;
}

export interface StaffLedgerEntry {
  id: number;
  userId: number;
  entryType: StaffLedgerEntryType;
  amount: number;
  createdAt: string;
  note: string | null;
}
