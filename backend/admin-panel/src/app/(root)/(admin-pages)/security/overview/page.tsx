'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Badge, Button, Input } from '@/components/ui';
import { SecurityNav } from '@/components/security/SecurityNav';
import { securityService } from '@/services/security.service';
import { formatDate } from '@/utils/formatDate';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ComputerDesktopIcon,
  BellAlertIcon,
  ClockIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

type Recommendation = { type: string; message: string };
type AdminRow = { id: number; name: string; email: string; last_login: string | null; last_ip: string | null; created_at: string };
type IpRow = { ip: string; count: number };

interface OverviewData {
  admins: AdminRow[];
  failed_logins_7d: number;
  top_ips: IpRow[];
  critical_events: unknown[];
  recommendations: Recommendation[];
}

function recIcon(type: string) {
  if (type === 'critical') return <ExclamationTriangleIcon className="h-5 w-5 text-danger" />;
  if (type === 'warning') return <ExclamationTriangleIcon className="h-5 w-5 text-warning" />;
  return <InformationCircleIcon className="h-5 w-5 text-primary" />;
}

function recBg(type: string) {
  if (type === 'critical') return 'border-danger-100 bg-danger-50';
  if (type === 'warning') return 'border-warning-100 bg-warning-50';
  return 'border-primary-100 bg-primary-50';
}

export default function SecurityOverviewPage() {
  const queryClient = useQueryClient();

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['security-admin-overview'],
    queryFn: () => securityService.getAdminSecurityOverview().then((r) => (r.data as { data: OverviewData }).data),
    refetchInterval: 60000,
  });

  const { data: retention } = useQuery({
    queryKey: ['security-data-retention'],
    queryFn: () => securityService.getDataRetentionSettings().then((r) => r.data.data),
  });

  const { data: alertSettings } = useQuery({
    queryKey: ['security-alert-notifications'],
    queryFn: () => securityService.getAlertNotificationSettings().then((r) => r.data.data),
  });

  const [retentionForm, setRetentionForm] = useState({
    audit_logs_days: 365,
    support_tickets_days: 730,
    notifications_days: 90,
    user_data_days: 2555,
  });

  const [alertForm, setAlertForm] = useState({
    email: '',
    enabled: false,
    min_severity: 'high',
  });

  useEffect(() => {
    if (retention) setRetentionForm(retention);
  }, [retention]);

  useEffect(() => {
    if (alertSettings) setAlertForm(alertSettings);
  }, [alertSettings]);

  const retentionMutation = useMutation({
    mutationFn: () => securityService.updateDataRetentionSettings(retentionForm),
    onSuccess: () => {
      toast.success('Data retention settings saved');
      queryClient.invalidateQueries({ queryKey: ['security-data-retention'] });
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const alertMutation = useMutation({
    mutationFn: () => securityService.updateAlertNotificationSettings(alertForm),
    onSuccess: () => {
      toast.success('Alert notification settings saved');
      queryClient.invalidateQueries({ queryKey: ['security-alert-notifications'] });
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const admins = overview?.admins ?? [];
  const recs = overview?.recommendations ?? [];

  return (
    <>
      <PageHeader
        title="Security Overview"
        description="Admin accounts, security recommendations, data retention, and alert notifications"
      />
      <SecurityNav />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard title="Admin Accounts" value={admins.length} icon={<UserGroupIcon className="h-5 w-5" />} />
        <StatsCard
          title="Failed Logins (7d)"
          value={overview?.failed_logins_7d ?? 0}
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          changeType={(overview?.failed_logins_7d ?? 0) > 5 ? 'negative' : 'neutral'}
        />
        <StatsCard title="Unique IPs (7d)" value={overview?.top_ips.length ?? 0} icon={<ComputerDesktopIcon className="h-5 w-5" />} />
        <StatsCard
          title="Alert Emails"
          value={alertForm.enabled ? 'Enabled' : 'Disabled'}
          icon={<BellAlertIcon className="h-5 w-5" />}
          changeType={alertForm.enabled ? 'positive' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Security Recommendations */}
        {recs.length > 0 && (
          <div className="card lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-secondary-900">Security Recommendations</h3>
            <div className="space-y-3">
              {recs.map((r, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${recBg(r.type)}`}>
                  {recIcon(r.type)}
                  <p className="text-sm text-secondary-700">{r.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Accounts */}
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-secondary-900">Admin Accounts</h3>
          {overviewLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-neutral-50" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-neutral-400">
                    <th className="pb-3 pr-4">Admin</th>
                    <th className="pb-3 pr-4">Last Login</th>
                    <th className="pb-3">Last IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-secondary-900">{a.name}</p>
                        <p className="text-xs text-neutral-400">{a.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs text-neutral-400">
                        {a.last_login ? formatDate(a.last_login, 'MMM d, h:mm a') : <span className="text-warning">Never</span>}
                      </td>
                      <td className="py-3 font-mono text-xs text-neutral-400">{a.last_ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top IP Addresses */}
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-secondary-900">Top IP Addresses (last 7 days)</h3>
          {(overview?.top_ips ?? []).length === 0 ? (
            <p className="text-sm text-neutral-300">No IP data available yet</p>
          ) : (
            <div className="space-y-2">
              {(overview?.top_ips ?? []).slice(0, 8).map((ip, i) => (
                <div key={ip.ip} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-neutral-300">#{i + 1}</span>
                    <span className="font-mono text-sm text-secondary-700">{ip.ip || 'unknown'}</span>
                  </div>
                  <Badge variant="neutral">{ip.count} requests</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Retention Settings */}
        <div className="card">
          <h3 className="mb-1 text-sm font-semibold text-secondary-900">Data Retention Policy</h3>
          <p className="mb-4 text-xs text-neutral-400">How long to keep different types of data (days)</p>
          <div className="space-y-3">
            <Input
              label="Audit Logs (days)"
              type="number"
              min="30"
              value={retentionForm.audit_logs_days}
              onChange={(e) => setRetentionForm((f) => ({ ...f, audit_logs_days: parseInt(e.target.value) || 365 }))}
              hint="Recommended: 365 days (1 year)"
            />
            <Input
              label="Support Tickets (days)"
              type="number"
              min="90"
              value={retentionForm.support_tickets_days}
              onChange={(e) => setRetentionForm((f) => ({ ...f, support_tickets_days: parseInt(e.target.value) || 730 }))}
              hint="Recommended: 730 days (2 years)"
            />
            <Input
              label="Notification Logs (days)"
              type="number"
              min="30"
              value={retentionForm.notifications_days}
              onChange={(e) => setRetentionForm((f) => ({ ...f, notifications_days: parseInt(e.target.value) || 90 }))}
              hint="Recommended: 90 days"
            />
            <Input
              label="User Data (days)"
              type="number"
              min="365"
              value={retentionForm.user_data_days}
              onChange={(e) => setRetentionForm((f) => ({ ...f, user_data_days: parseInt(e.target.value) || 2555 }))}
              hint="Recommended: 2555 days (7 years) — GDPR/legal compliance"
            />
            <Button variant="primary" size="sm" onClick={() => retentionMutation.mutate()} loading={retentionMutation.isPending}>
              Save Retention Policy
            </Button>
          </div>
        </div>

        {/* Alert Email Notifications */}
        <div className="card">
          <h3 className="mb-1 text-sm font-semibold text-secondary-900">Security Alert Notifications</h3>
          <p className="mb-4 text-xs text-neutral-400">Receive email alerts when security events are detected</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-neutral-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setAlertForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${alertForm.enabled ? 'bg-primary' : 'bg-neutral-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${alertForm.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <div>
                <p className="text-sm font-medium text-secondary-900">Enable Email Alerts</p>
                <p className="text-xs text-neutral-400">Send email when security alerts are triggered</p>
              </div>
            </div>
            <Input
              label="Alert Email Address"
              type="email"
              placeholder="security@carcomfort-llc.com"
              value={alertForm.email}
              onChange={(e) => setAlertForm((f) => ({ ...f, email: e.target.value }))}
              disabled={!alertForm.enabled}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary-700">Minimum Severity</label>
              <select
                className="input"
                value={alertForm.min_severity}
                onChange={(e) => setAlertForm((f) => ({ ...f, min_severity: e.target.value }))}
                disabled={!alertForm.enabled}
              >
                <option value="low">Low & above</option>
                <option value="medium">Medium & above</option>
                <option value="high">High & above</option>
                <option value="critical">Critical only</option>
              </select>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => alertMutation.mutate()}
              loading={alertMutation.isPending}
              disabled={alertForm.enabled && !alertForm.email}
            >
              Save Notification Settings
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
