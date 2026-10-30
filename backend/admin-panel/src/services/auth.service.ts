import api from '@/lib/api';
import type { ApiResponse, User } from '@/types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: User }>>('/admin/login', { email, password }),

  logout: () =>
    api.post<ApiResponse>('/admin/logout'),

  getProfile: () =>
    api.get<ApiResponse<User>>('/admin/profile'),

  changePassword: (old_password: string, new_password: string) =>
    api.post<ApiResponse<{ token: string }>>('/admin/change-password', {
      old_password,
      new_password,
    }),

  forgotPassword: (email: string) =>
    api.post<ApiResponse>('/admin/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<ApiResponse>('/admin/reset-password', { token, password }),
};
