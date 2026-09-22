import { apiClient } from './client';
import type { LoginRequest, LoginResponse } from '../types/auth';

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/api/auth/login', request);
  return data;
}
