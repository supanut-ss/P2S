import { apiClient } from './client';
import type { CancellationResponse } from '../types/models';

export async function listCancellations(status?: string): Promise<CancellationResponse[]> {
  const { data } = await apiClient.get<CancellationResponse[]>('/api/cancellations', { params: { status } });
  return data;
}

export async function resolveCancellation(id: number, outcome: 'Refunded' | 'Adjusted'): Promise<void> {
  await apiClient.post(`/api/cancellations/${id}/resolve`, { outcome });
}
