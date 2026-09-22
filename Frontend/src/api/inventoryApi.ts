import { apiClient } from './client';
import type { InventoryItemResponse } from '../types/models';

export async function listInventory(filters: { status?: string; productId?: number } = {}): Promise<InventoryItemResponse[]> {
  const { data } = await apiClient.get<InventoryItemResponse[]>('/api/inventory', { params: filters });
  return data;
}

export async function withdraw(id: number, qty: number, withdrawalReasonId: number, note?: string): Promise<void> {
  await apiClient.post(`/api/inventory/${id}/withdraw`, { qty, withdrawalReasonId, note });
}
