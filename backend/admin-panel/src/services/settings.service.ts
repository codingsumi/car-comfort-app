import api from '@/lib/api';
import type { AllSettings, GroupSettings, AuditLogsResponse, SettingGroup, ServiceArea } from '@/types/settings';

export const settingsService = {
  async getAll(): Promise<AllSettings> {
    const res = await api.get('/admin/settings');
    return res.data.data;
  },

  async getByGroup(group: SettingGroup): Promise<GroupSettings> {
    const res = await api.get(`/admin/settings/${group}`);
    return res.data.data;
  },

  async updateByGroup(group: SettingGroup, data: Record<string, unknown>): Promise<GroupSettings> {
    const res = await api.patch(`/admin/settings/${group}`, data);
    return res.data.data;
  },

  async uploadFile(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/admin/settings/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async getAuditLogs(params?: { page?: number; limit?: number; group?: string }): Promise<AuditLogsResponse> {
    const res = await api.get('/admin/settings/audit-logs', { params });
    return res.data.data;
  },

  async deleteAllAuditLogs(params?: { group?: string }): Promise<{ deleted: number }> {
    const res = await api.delete('/admin/settings/audit-logs', { params });
    return res.data.data;
  },

  async testStripe(): Promise<{ connected: boolean; livemode: boolean }> {
    const res = await api.post('/admin/settings/payments/test-stripe');
    return res.data.data;
  },

  async testEmail(to?: string): Promise<{ verified: boolean; sent: boolean; messageId?: string }> {
    const res = await api.post('/admin/settings/email/test', to ? { to } : {});
    return res.data.data;
  },

  async getServiceAreas(): Promise<ServiceArea[]> {
    const res = await api.get('/admin/settings/service-areas');
    return res.data.data;
  },

  async createServiceArea(data: Partial<ServiceArea>): Promise<ServiceArea> {
    const res = await api.post('/admin/settings/service-areas', data);
    return res.data.data;
  },

  async updateServiceArea(id: number, data: Partial<ServiceArea>): Promise<ServiceArea> {
    const res = await api.patch(`/admin/settings/service-areas/${id}`, data);
    return res.data.data;
  },

  async deleteServiceArea(id: number): Promise<void> {
    await api.delete(`/admin/settings/service-areas/${id}`);
  },
};
