'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { customersService } from '@/services/customers.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { ResetPasswordModal } from '@/components/shared/ResetPasswordModal';
import { EditCustomerProfileModal } from '@/components/customers/EditCustomerProfileModal';
import { Button, Badge, Tabs, StatsCard, Modal, ConfirmModal } from '@/components/ui';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  TruckIcon,
  UserGroupIcon,
  StarIcon,
  NoSymbolIcon,
  TrashIcon,
  KeyIcon,
  CheckCircleIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { formatDate, formatJoinedDate } from '@/utils/formatDate';
import toast from 'react-hot-toast';

const bookingStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  completed: 'success',
  in_progress: 'primary',
  confirmed: 'primary',
  assigned: 'primary',
  pending_payment: 'warning',
  cancelled: 'danger',
};

const accountStatusVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  suspended: 'warning',
  deactivated: 'danger',
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: loginHistoryData, isLoading: loginHistoryLoading } = useQuery({
    queryKey: ['customer-login-history', id],
    queryFn: () => customersService.getLoginHistory(Number(id)),
    enabled: activeTab === 'login_history' && !!id,
  });
  const loginHistory = loginHistoryData?.data?.data?.login_history ?? [];
  const [bookingFilter, setBookingFilter] = useState('');
  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [deactivateModal, setDeactivateModal] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customer-detail', id],
    queryFn: () => customersService.getById(Number(id)).then((r) => r.data.data),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (params: { status: string; reason?: string }) =>
      customersService.updateStatus(Number(id), params),
    onSuccess: (_, variables) => {
      const label =
        variables.status === 'active'
          ? 'activated'
          : variables.status === 'suspended'
            ? 'suspended'
            : variables.status === 'deactivated'
              ? 'deactivated'
              : variables.status;
      toast.success(`Customer ${label} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-customer-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setSuspendModal(false);
      setDeactivateModal(false);
      setSuspendReason('');
    },
    onError: () => toast.error('Failed to update customer status'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (payload: { password?: string; notify_email?: boolean }) =>
      customersService.resetPassword(Number(id), payload).then((res) => res.data.data),
    onSuccess: () => {
      toast.success('Password updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-customer-detail', id] });
    },
    onError: () => toast.error('Failed to reset password'),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="text-sm text-neutral-300">Customer not found</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4" size="sm">
          Go Back
        </Button>
      </div>
    );
  }

  const { user, stats, bookings, vehicles, transactions, reviews } = data;
  const isActive = user.status === 'active';
  const isSuspended = user.status === 'suspended';
  const isDeactivated = user.status === 'deactivated';
  const canReactivate = isSuspended || isDeactivated;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'bookings', label: 'Bookings', count: stats?.total_bookings },
    { key: 'vehicles', label: 'Vehicles', count: stats?.total_vehicles },
    { key: 'transactions', label: 'Transactions', count: stats?.total_transactions },
    { key: 'reviews', label: 'Reviews', count: stats?.total_reviews },
    { key: 'login_history', label: 'Login Details' },
  ];

  const statuses = ['confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'pending_payment'];

  return (
    <>
      <PageHeader
        title="Customer Details"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.back()} icon={<ArrowLeftIcon className="h-4 w-4" />}>
              Back
            </Button>
            {canReactivate && (
              <Button
                variant="success"
                onClick={() => statusMutation.mutate({ status: 'active' })}
                loading={statusMutation.isPending}
                icon={<CheckCircleIcon className="h-4 w-4" />}
              >
                {isDeactivated ? 'Activate' : 'Reactivate'}
              </Button>
            )}
            {isActive && (
              <Button
                variant="warning"
                onClick={() => setSuspendModal(true)}
                icon={<NoSymbolIcon className="h-4 w-4" />}
              >
                Suspend
              </Button>
            )}
            {(isActive || isSuspended) && (
              <Button
                variant="danger"
                onClick={() => setDeactivateModal(true)}
                icon={<TrashIcon className="h-4 w-4" />}
              >
                Deactivate
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setEditProfileModal(true)}
              icon={<PencilIcon className="h-4 w-4" />}
            >
              Edit Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => setResetPasswordModal(true)}
              icon={<KeyIcon className="h-4 w-4" />}
            >
              Set Password
            </Button>
          </div>
        }
      />

      {/* Profile header */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary">
              <span className="text-xl font-bold">
                {(user.name?.[0] || user.email[0]).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-secondary-900">
                {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
              </h2>
              <p className="text-sm text-neutral-300">{user.email}</p>
              {user.phone && (
                <p className="text-sm text-neutral-300">
                  {user.country_code || ''} {user.phone}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="neutral">Customer</Badge>
                <Badge variant={accountStatusVariant[user.status] || 'neutral'} dot>
                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </Badge>
                <Badge variant={user.is_verified ? 'success' : 'warning'} dot>
                  {user.is_verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-neutral-300">
            <p>Joined {formatJoinedDate(user)}</p>
          </div>
        </div>

        {user.status === 'suspended' && user.suspended_reason && (
          <div className="mt-4 rounded-lg border border-warning-100 bg-warning-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-warning">Suspension Reason</p>
            <p className="mt-1 text-sm text-secondary-700">{user.suspended_reason}</p>
            {user.suspended_at && (
              <p className="mt-1 text-xs text-neutral-300">
                Suspended on {formatDate(user.suspended_at, 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
        )}

        {isDeactivated && (
          <div className="mt-4 rounded-lg border border-danger-100 bg-danger-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-danger">Account deactivated</p>
            <p className="mt-1 text-sm text-secondary-700">
              This customer cannot sign in. Use Activate to restore access.
            </p>
            {user.deactivated_at && (
              <p className="mt-1 text-xs text-neutral-300">
                Deactivated on {formatDate(user.deactivated_at, 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>
        )}
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard title="Total Bookings" value={stats.total_bookings} icon={<CalendarDaysIcon className="h-5 w-5" />} />
              <StatsCard title="Total Spent" value={`$${stats.total_spent}`} icon={<CreditCardIcon className="h-5 w-5" />} />
              <StatsCard title="Vehicles" value={stats.total_vehicles} icon={<TruckIcon className="h-5 w-5" />} />
              <StatsCard title="Completion Rate" value={`${stats.completion_rate}%`} icon={<UserGroupIcon className="h-5 w-5" />} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card">
                <h3 className="mb-4 text-base font-semibold text-secondary-900">Profile Details</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Phone', value: user.phone ? `${user.country_code || ''} ${user.phone}` : '—' },
                    { label: 'Auth Type', value: user.auth_type },
                    { label: 'Referral Code', value: user.referral_code || '—' },
                    { label: 'Stripe ID', value: user.stripe_customer_id || '—' },
                    { label: 'Avg Rating Given', value: stats.avg_rating ? `${stats.avg_rating} / 5` : '—' },
                    { label: 'Account Status', value: user.status },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="text-sm text-neutral-300">{item.label}</span>
                      <span className="text-sm font-medium text-secondary-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="mb-4 text-base font-semibold text-secondary-900">Booking Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(stats.status_breakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={bookingStatusVariant[status] || 'neutral'} dot>
                        {status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-sm font-semibold text-secondary-900">{count}</span>
                    </div>
                  ))}
                  {Object.keys(stats.status_breakdown).length === 0 && (
                    <p className="text-sm text-neutral-300">No bookings yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBookingFilter('')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !bookingFilter ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                }`}
              >
                All ({(bookings as Array<Record<string, unknown>>).length})
              </button>
              {statuses.map((s) => {
                const count = (bookings as Array<Record<string, unknown>>).filter((b) => b.status === s).length;
                if (!count) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setBookingFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      bookingFilter === s ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                    }`}
                  >
                    {s.replace(/_/g, ' ')} ({count})
                  </button>
                );
              })}
            </div>
            <div className="table-container">
              {(() => {
                const filtered = bookingFilter
                  ? (bookings as Array<Record<string, unknown>>).filter((b) => b.status === bookingFilter)
                  : (bookings as Array<Record<string, unknown>>);
                if (!filtered.length)
                  return <p className="py-8 text-center text-sm text-neutral-300">No bookings found</p>;
                return (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Provider</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filtered.map((b) => (
                        <tr key={b.id as number} className="hover:bg-neutral-50/50">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                            {b.booking_code as string}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                            {(b.service_type as string)?.replace(/_/g, ' ')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge variant={bookingStatusVariant[b.status as string] || 'neutral'} dot>
                              {(b.status as string).replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                            {(b.assigned_driver as Record<string, unknown>)?.name as string || (b.assigned_driver as Record<string, unknown>)?.email as string || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                            {b.total_price ? `$${parseFloat(b.total_price as string).toFixed(2)}` : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">
                            {formatDate(b.created_at as string)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/bookings/${b.id}`)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}

        {/* Vehicles Tab */}
        {activeTab === 'vehicles' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(vehicles as Array<Record<string, unknown>>).length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-neutral-300">No vehicles registered</p>
            ) : (
              (vehicles as Array<Record<string, unknown>>).map((v) => (
                <div key={v.id as number} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-secondary-900">
                        {v.make as string} {v.model as string}
                      </h4>
                      <p className="text-sm text-neutral-300">
                        {v.year as number} &middot; {v.color as string}
                      </p>
                    </div>
                    {Boolean(v.is_default) && <Badge variant="primary">Default</Badge>}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-300">License Plate</span>
                      <span className="font-mono font-medium text-secondary-900">
                        {v.license_plate as string}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-300">Color</span>
                      <span className="font-medium text-secondary-900">{v.color as string}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-300">Fuel Type</span>
                      <span className="font-medium text-secondary-900">
                        {(v.fuel_type as string) === 'ELECTRIC' ? 'Electric' : 'Other'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="table-container">
            {(transactions as Array<Record<string, unknown>>).length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No transactions found</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Booking</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(transactions as Array<Record<string, unknown>>).map((tx) => (
                    <tr key={tx.id as number} className="hover:bg-neutral-50/50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-secondary-900">
                        {tx.transaction_code as string}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                        {(tx.booking as Record<string, unknown>)?.booking_code as string || `#${tx.booking_id}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                        ${parseFloat(tx.amount as string).toFixed(2)} {(tx.currency as string)?.toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge
                          variant={
                            tx.status === 'succeeded' ? 'success' :
                            tx.status === 'failed' ? 'danger' : 'warning'
                          }
                          dot
                        >
                          {tx.status as string}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">
                        {formatDate(tx.created_at as string, 'MMM d, yyyy h:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {(reviews as Array<Record<string, unknown>>).length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No reviews written</p>
            ) : (
              (reviews as Array<Record<string, unknown>>).map((r) => (
                <div key={r.id as number} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`h-4 w-4 ${
                                i < (r.rating as number) ? 'fill-warning text-warning' : 'text-neutral-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-secondary-900">{r.rating as number}/5</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-300">
                        To: {(r.reviewee as Record<string, unknown>)?.name as string || (r.reviewee as Record<string, unknown>)?.email as string || '—'}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-200">{formatDate(r.created_at as string)}</span>
                  </div>
                  {r.message ? <p className="mt-2 text-sm text-secondary-500">{String(r.message)}</p> : null}
                </div>
              ))
            )}
          </div>
        )}

        {/* Login Details Tab */}
        {activeTab === 'login_history' && (
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-secondary-900">Login Details</h3>
            {loginHistoryLoading ? (
              <p className="py-8 text-center text-sm text-neutral-300">Loading...</p>
            ) : loginHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No device login history found</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-neutral-100">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Platform</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">App Version</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Last Login IP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Last Login</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {loginHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 capitalize">
                            {entry.platform ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{entry.device_model ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{entry.app_version ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{entry.last_login_ip ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-neutral-400">
                          {entry.last_login_at ? formatDate(entry.last_login_at, 'MMM d, yyyy h:mm a') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.is_active ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${entry.is_active ? 'bg-green-500' : 'bg-neutral-400'}`} />
                            {entry.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suspend Modal */}
      <Modal
        open={suspendModal}
        onClose={() => { setSuspendModal(false); setSuspendReason(''); }}
        title="Suspend Customer"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-500">
            Suspending this customer will immediately block their access to the app.
            All active sessions will be terminated.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-900">
              Suspension Reason (optional)
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              placeholder="e.g., Reported for abusive behavior..."
              className="input w-full resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setSuspendModal(false); setSuspendReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={() => statusMutation.mutate({ status: 'suspended', reason: suspendReason })}
              loading={statusMutation.isPending}
            >
              Suspend Customer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmModal
        open={deactivateModal}
        onClose={() => setDeactivateModal(false)}
        onConfirm={() => statusMutation.mutate({ status: 'deactivated' })}
        title="Deactivate Customer"
        message="This will soft-delete the customer account. Their data will be retained but they will not be able to access the platform. Are you sure?"
        confirmLabel="Deactivate"
        variant="danger"
        loading={statusMutation.isPending}
      />

      <ResetPasswordModal
        open={resetPasswordModal}
        onClose={() => setResetPasswordModal(false)}
        accountLabel="customer"
        userEmail={user.email}
        authType={user.auth_type}
        isSubmitting={resetPasswordMutation.isPending}
        onSubmit={(payload) => resetPasswordMutation.mutateAsync(payload)}
      />

      {editProfileModal && (
        <EditCustomerProfileModal
          customerId={Number(id)}
          open={editProfileModal}
          onClose={() => setEditProfileModal(false)}
          initialValues={{
            first_name: user.first_name ?? user.name?.split(' ')[0] ?? '',
            last_name: user.last_name ?? user.name?.split(' ').slice(1).join(' ') ?? '',
            email: user.email ?? '',
            phone: user.phone ?? '',
            country_code: user.country_code ?? '',
          }}
        />
      )}
    </>
  );
}
