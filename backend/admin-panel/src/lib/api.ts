import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { adminPath, getApiBaseUrl, BASE_PATH } from '@/lib/paths';

const sessionApiUrl = () => `${typeof window !== 'undefined' ? BASE_PATH : ''}/api/auth/session`;

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Token is read from the in-memory Zustand store (populated by checkAuth/login).
    // It is NOT read from localStorage — the HttpOnly cookie provides the server-side
    // session; the Bearer header is kept for API-level auth on the backend.
    if (typeof window !== 'undefined') {
      try {
        // Lazy import to avoid circular dependency
        const { useAuthStore } = require('@/store/auth');
        const token = useAuthStore.getState().token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // store not yet initialised — proceed without header
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error_type?: string }>) => {
    const message = error.response?.data?.message || 'Something went wrong';

    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/login') || url.includes('/forgot-password') || url.includes('/reset-password') || url.includes('/api/auth/session');
      if (!isAuthEndpoint && typeof window !== 'undefined') {
        // Don't redirect if already on a public/auth page — avoids infinite loop
        const currentPath = window.location.pathname.replace(/^\/admin/, '') || '/';
        const publicPrefixes = ['/login', '/forgot-password', '/reset-password'];
        const alreadyOnPublic = publicPrefixes.some((p) => currentPath === p || currentPath.startsWith(`${p}/`));
        if (!alreadyOnPublic) {
          // Clear HttpOnly cookie via session API route, then redirect
          fetch(sessionApiUrl(), { method: 'DELETE' }).finally(() => {
            window.location.href = adminPath('/login');
          });
        }
      }
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action');
    } else if (error.response?.status !== 422) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
