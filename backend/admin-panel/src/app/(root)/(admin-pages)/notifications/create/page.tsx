'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { NotificationSubNav } from '@/components/notifications/NotificationSubNav';
import { NotificationPreview } from '@/components/notifications/NotificationPreview';
import { Button, Input, Select } from '@/components/ui';
import { UserAudiencePicker } from '@/components/notifications/UserAudiencePicker';
import { notificationManagementService } from '@/services/notificationManagement.service';
import type { AudienceSegment, NotificationChannel, AudienceFilters } from '@/types/notificationManagement';

const SEGMENTS: { value: AudienceSegment; label: string }[] = [
  { value: 'all_customers', label: 'All customers' },
  { value: 'all_providers', label: 'All providers' },
  { value: 'specific_users', label: 'Specific users' },
  { value: 'custom', label: 'Custom segment' },
];

export default function CreateNotificationPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState<AudienceSegment>('all_customers');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>(['push', 'in_app']);
  const [imageUrl, setImageUrl] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);

  // Custom segment advanced filters
  const [customRole, setCustomRole] = useState<'customer' | 'driver'>('customer');
  const [customCity, setCustomCity] = useState('');
  const [customState, setCustomState] = useState('');
  const [customServiceType, setCustomServiceType] = useState('');
  const [customBookingDays, setCustomBookingDays] = useState('');
  const [customUserStatus, setCustomUserStatus] = useState<'' | 'active' | 'inactive'>('');

  const { data: templates } = useQuery({
    queryKey: ['notification-templates-active'],
    queryFn: () => notificationManagementService.listTemplates({ is_active: true }),
  });

  const audienceFilters: AudienceFilters = {
    segment,
    ...(segment === 'specific_users' ? { user_ids: selectedUserIds } : {}),
    ...(segment === 'custom' ? {
      role: customRole,
      ...(customCity ? { city: customCity } : {}),
      ...(customState ? { state: customState } : {}),
      ...(customServiceType ? { service_type: customServiceType } : {}),
      ...(customBookingDays ? { has_booking_days: parseInt(customBookingDays) } : {}),
      ...(customUserStatus ? { user_status: customUserStatus as 'active' | 'inactive' } : {}),
    } : {}),
  };

  useEffect(() => {
    const t = setTimeout(() => {
      notificationManagementService.estimateAudience(audienceFilters).then((r) => setAudienceCount(r.count));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced estimate on segment/selectedUserIds
  }, [segment, selectedUserIds]);

  const sendMutation = useMutation({
    mutationFn: () =>
      notificationManagementService.send({
        title,
        message,
        channels,
        audience_filters: audienceFilters,
        image_url: imageUrl || undefined,
        deep_link_url: deepLink || undefined,
        cta_text: ctaText || undefined,
        cta_url: ctaUrl || undefined,
        scheduled_at: scheduleMode === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        timezone,
        campaign_name: title.slice(0, 80) || 'Admin notification',
      }),
    onSuccess: () => {
      toast.success(scheduleMode === 'later' ? 'Notification scheduled' : 'Notification queued for delivery');
      router.push('/notifications/campaigns');
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to send notification. Ensure the notification worker is running.';
      toast.error(message);
    },
  });

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates?.find((t) => String(t.id) === templateId);
    if (!tpl) return;
    setTitle(tpl.title_template);
    setMessage(tpl.body_template);
  };

  return (
    <>
      <PageHeader title="Create notification" description="Compose and send push, email, or in-app notifications" />
      <div className="mb-6">
        <NotificationSubNav />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          {templates && templates.length > 0 && (
            <Select
              label="Load template"
              onChange={(e) => applyTemplate(e.target.value)}
              defaultValue=""
              options={[
                { value: '', label: '— Select template —' },
                ...templates.map((t) => ({ value: String(t.id), label: t.template_name })),
              ]}
            />
          )}

          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-secondary-700">Message</span>
            <textarea
              className="input w-full min-h-[100px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              required
            />
          </label>
          {/* Image URL, Deep link URL, CTA text, CTA URL — hidden */}

          <div>
            <p className="mb-2 text-sm font-medium text-secondary-700">Channels</p>
            <div className="flex flex-wrap gap-2">
              {(['push', 'email', 'in_app'] as NotificationChannel[]).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                    channels.includes(ch) ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {ch.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <Select
            label="Audience"
            value={segment}
            onChange={(e) => setSegment(e.target.value as AudienceSegment)}
            options={SEGMENTS.map((s) => ({ value: s.value, label: s.label }))}
          />

          {segment === 'specific_users' && (
            <UserAudiencePicker
              selectedIds={selectedUserIds}
              onChange={setSelectedUserIds}
            />
          )}

          {segment === 'custom' && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Custom Segment Filters</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-700">User Type</label>
                  <select
                    className="input w-full text-sm"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value as 'customer' | 'driver')}
                  >
                    <option value="customer">Customers</option>
                    <option value="driver">Service Providers</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-700">User Status</label>
                  <select
                    className="input w-full text-sm"
                    value={customUserStatus}
                    onChange={(e) => setCustomUserStatus(e.target.value as '' | 'active' | 'inactive')}
                  >
                    <option value="">Any status</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive / Suspended</option>
                  </select>
                </div>
                <Input
                  label="City (optional)"
                  placeholder="e.g. Los Angeles"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                />
                <Input
                  label="State (optional)"
                  placeholder="e.g. CA"
                  value={customState}
                  onChange={(e) => setCustomState(e.target.value)}
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-secondary-700">Service Type (optional)</label>
                  <select
                    className="input w-full text-sm"
                    value={customServiceType}
                    onChange={(e) => setCustomServiceType(e.target.value)}
                  >
                    <option value="">Any service</option>
                    <option value="car_wash">Car Wash</option>
                    <option value="ev_charging">EV Charging</option>
                    <option value="combo">Combo</option>
                    <option value="add_on">Add-On</option>
                  </select>
                </div>
                <Input
                  label="Booked within (days)"
                  type="number"
                  min="1"
                  placeholder="e.g. 30"
                  value={customBookingDays}
                  onChange={(e) => setCustomBookingDays(e.target.value)}
                  hint="Only users who booked within N days"
                />
              </div>
            </div>
          )}

          {audienceCount !== null && (
            <p className="text-sm text-neutral-500">Estimated audience: {audienceCount.toLocaleString()} users</p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-secondary-700">Delivery</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScheduleMode('now')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${scheduleMode === 'now' ? 'bg-primary text-white' : 'bg-neutral-100'}`}
              >
                Send now
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('later')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${scheduleMode === 'later' ? 'bg-primary text-white' : 'bg-neutral-100'}`}
              >
                Schedule
              </button>
            </div>
          </div>

          {scheduleMode === 'later' && (
            <>
              <Input
                label="Scheduled at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <Input label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </>
          )}

          <Button
            onClick={() => sendMutation.mutate()}
            loading={sendMutation.isPending}
            disabled={
              !title ||
              !message ||
              channels.length === 0 ||
              (segment === 'specific_users' && selectedUserIds.length === 0)
            }
          >
            {scheduleMode === 'later' ? 'Schedule notification' : 'Send notification'}
          </Button>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold text-secondary-900">Preview</p>
          <NotificationPreview title={title} message={message} imageUrl={imageUrl} ctaText={ctaText} />
          <p className="mt-4 text-xs text-neutral-400">
            Variables: {'{{customer_name}}'}, {'{{provider_name}}'}, {'{{booking_id}}'}, {'{{service_type}}'}, {'{{amount}}'}
          </p>
        </div>
      </div>
    </>
  );
}
