import { apiClient } from './client';
import type { DailyFinanceSnapshotResponse, StaffBalanceResponse } from '../types/models';

export async function getLatestSnapshot(): Promise<DailyFinanceSnapshotResponse | null> {
  try {
    const { data } = await apiClient.get<DailyFinanceSnapshotResponse>('/api/finance/snapshot/latest');
    return data;
  } catch (err: unknown) {
    if (isAxiosNotFound(err)) return null;
    throw err;
  }
}

export async function runSnapshotNow(): Promise<DailyFinanceSnapshotResponse> {
  const { data } = await apiClient.post<DailyFinanceSnapshotResponse>('/api/finance/snapshot/run');
  return data;
}

export async function getStaffBalances(): Promise<StaffBalanceResponse[]> {
  const { data } = await apiClient.get<StaffBalanceResponse[]>('/api/finance/staff-balances');
  return data;
}

function isAxiosNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'response' in err &&
    (err as { response?: { status?: number } }).response?.status === 404;
}
