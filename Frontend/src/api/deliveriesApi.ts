import { apiClient } from './client';
import type { GoodsReceiptOrderResponse } from '../types/models';

export async function lookupGoodsReceiptOrder(orderNo?: string): Promise<GoodsReceiptOrderResponse[]> {
  const { data } = await apiClient.get<GoodsReceiptOrderResponse[]>('/api/deliveries/orders/lookup', {
    params: orderNo ? { orderNo } : undefined,
  });
  return data;
}

export async function receiveGoodsOrder(
  purchaseOrderId: number,
  lines: Array<{ orderItemId: number; quantity: number }>,
): Promise<{ receiptEventId: number; lineCount: number; unitCount: number }> {
  const { data } = await apiClient.post('/api/deliveries/orders/receive', { purchaseOrderId, lines });
  return data;
}

export async function reverseGoodsReceipt(eventId: number, reason: string): Promise<void> {
  await apiClient.post(`/api/deliveries/receipts/${eventId}/reverse`, { reason });
}

export async function cancelOrderItem(orderItemId: number, note?: string, refundAmount?: number): Promise<void> {
  await apiClient.post(`/api/deliveries/${orderItemId}/cancel`, { note, refundAmount });
}
