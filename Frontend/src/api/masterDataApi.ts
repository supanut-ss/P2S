import { apiClient } from './client';
import type { PlatformResponse, ProductResponse, UserResponse, WithdrawalReasonResponse } from '../types/models';

export async function getProducts(): Promise<ProductResponse[]> {
  const { data } = await apiClient.get<ProductResponse[]>('/api/products');
  return data;
}

export async function createProduct(payload: { name: string; skuCode: string; category: string; unit: string }): Promise<ProductResponse> {
  const { data } = await apiClient.post<ProductResponse>('/api/products', payload);
  return data;
}

export async function updateProduct(id: number, payload: { name: string; skuCode: string; category: string; unit: string; isActive: boolean }): Promise<ProductResponse> {
  const { data } = await apiClient.put<ProductResponse>(`/api/products/${id}`, payload);
  return data;
}

export async function getPlatforms(): Promise<PlatformResponse[]> {
  const { data } = await apiClient.get<PlatformResponse[]>('/api/platforms');
  return data;
}

export async function createPlatform(payload: { code: string; name: string }): Promise<PlatformResponse> {
  const { data } = await apiClient.post<PlatformResponse>('/api/platforms', payload);
  return data;
}

export async function updatePlatform(id: number, payload: { name: string; isActive: boolean }): Promise<PlatformResponse> {
  const { data } = await apiClient.put<PlatformResponse>(`/api/platforms/${id}`, payload);
  return data;
}

export async function getWithdrawalReasons(): Promise<WithdrawalReasonResponse[]> {
  const { data } = await apiClient.get<WithdrawalReasonResponse[]>('/api/withdrawal-reasons');
  return data;
}

export async function createWithdrawalReason(payload: { name: string }): Promise<WithdrawalReasonResponse> {
  const { data } = await apiClient.post<WithdrawalReasonResponse>('/api/withdrawal-reasons', payload);
  return data;
}

export async function updateWithdrawalReason(id: number, payload: { name: string; isActive: boolean }): Promise<WithdrawalReasonResponse> {
  const { data } = await apiClient.put<WithdrawalReasonResponse>(`/api/withdrawal-reasons/${id}`, payload);
  return data;
}

export async function getUsers(): Promise<UserResponse[]> {
  const { data } = await apiClient.get<UserResponse[]>('/api/users');
  return data;
}

export async function createUser(payload: { username: string; password: string; fullName: string; role: string; cardLast4?: string }): Promise<UserResponse> {
  const { data } = await apiClient.post<UserResponse>('/api/users', payload);
  return data;
}

export async function updateUser(id: number, payload: { fullName: string; isActive: boolean; cardLast4?: string }): Promise<UserResponse> {
  const { data } = await apiClient.put<UserResponse>(`/api/users/${id}`, payload);
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  await apiClient.delete(`/api/products/${id}`);
}

export async function deletePlatform(id: number): Promise<void> {
  await apiClient.delete(`/api/platforms/${id}`);
}

export async function deleteWithdrawalReason(id: number): Promise<void> {
  await apiClient.delete(`/api/withdrawal-reasons/${id}`);
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/api/users/${id}`);
}

export async function adminResetPassword(userId: number, newPassword: string): Promise<void> {
  await apiClient.post('/api/auth/admin-reset-password', { userId, newPassword });
}
