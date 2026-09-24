import { apiClient } from './client';
import type { PurchaseOrderResponse } from '../types/models';

export interface CreateOrderItemInput {
  productId: number;
  qty: number;
  unitPrice: number;
}

export async function createOrder(payload: { platformId: number; platformOrderNo: string; items: CreateOrderItemInput[] }): Promise<PurchaseOrderResponse> {
  const { data } = await apiClient.post<PurchaseOrderResponse>('/api/orders', payload);
  return data;
}

export async function listOrders(filters: { platformId?: number; userId?: number; status?: string; search?: string; excludeRequested?: boolean }): Promise<PurchaseOrderResponse[]> {
  const { data } = await apiClient.get<PurchaseOrderResponse[]>('/api/orders', { params: filters });
  return data;
}

export async function getOrder(id: number): Promise<PurchaseOrderResponse> {
  const { data } = await apiClient.get<PurchaseOrderResponse>(`/api/orders/${id}`);
  return data;
}

export async function markPaid(id: number, payload: { paymentSource: 'StaffAdvance' | 'CompanyDirect'; actualPaidAmount: number; paymentPayerUserId: number; evidence?: File }): Promise<PurchaseOrderResponse> {
  const formData = new FormData();
  formData.append('PaymentSource', payload.paymentSource);
  formData.append('ActualPaidAmount', String(payload.actualPaidAmount));
  formData.append('PaymentPayerUserId', String(payload.paymentPayerUserId));
  if (payload.evidence) formData.append('Evidence', payload.evidence);
  const { data } = await apiClient.post<PurchaseOrderResponse>(`/api/orders/${id}/mark-paid`, formData);
  return data;
}

export async function getPaymentEvidence(id: number): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/api/orders/${id}/payment-evidence`, { responseType: 'blob' });
  return data;
}

export async function setTracking(orderItemId: number, trackingNo: string, courier?: string): Promise<void> {
  await apiClient.post(`/api/orders/items/${orderItemId}/tracking`, { trackingNo, courier });
}
