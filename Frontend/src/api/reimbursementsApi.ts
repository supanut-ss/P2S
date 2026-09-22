import { apiClient } from './client';
import type { ReimbursementResponse } from '../types/models';

export async function listReimbursements(status?: string): Promise<ReimbursementResponse[]> {
  const { data } = await apiClient.get<ReimbursementResponse[]>('/api/reimbursements', { params: { status } });
  return data;
}

export async function createReimbursement(purchaseOrderIds: number[]): Promise<ReimbursementResponse> {
  const { data } = await apiClient.post<ReimbursementResponse>('/api/reimbursements', { purchaseOrderIds });
  return data;
}

export async function approveReimbursement(id: number): Promise<ReimbursementResponse> {
  const { data } = await apiClient.post<ReimbursementResponse>(`/api/reimbursements/${id}/approve`);
  return data;
}

export async function payReimbursement(id: number): Promise<ReimbursementResponse> {
  const { data } = await apiClient.post<ReimbursementResponse>(`/api/reimbursements/${id}/pay`);
  return data;
}
