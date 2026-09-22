import axios from 'axios';

export const AUTH_TOKEN_STORAGE_KEY = 'p2s.authToken';

// Empty base URL in dev: Vite's dev-server proxy (see vite.config.ts) forwards
// /api/* to the backend, so relative paths work without CORS. In production the
// SPA is served from the same origin as the API (single-host deploy), so relative
// paths work there too — VITE_API_BASE_URL only needs setting for a split-host setup.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);
