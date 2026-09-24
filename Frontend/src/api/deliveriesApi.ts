import { apiClient } from './client';
import type { DeliveryMatchMethod, PendingOrderItemResponse } from '../types/models';

export async function getPending(search?: string): Promise<PendingOrderItemResponse[]> {
  const { data } = await apiClient.get<PendingOrderItemResponse[]>('/api/deliveries/pending', { params: { search } });
  return data;
}

export async function confirmArrived(orderItemId: number, scannedCode: string, matchMethod: DeliveryMatchMethod): Promise<{ inventoryItemId: number }> {
  const { data } = await apiClient.post(`/api/deliveries/${orderItemId}/confirm-arrived`, { scannedCode, matchMethod });
  return data;
}

export async function cancelOrderItem(orderItemId: number, note?: string, refundAmount?: number): Promise<void> {
  await apiClient.post(`/api/deliveries/${orderItemId}/cancel`, { note, refundAmount });
}
