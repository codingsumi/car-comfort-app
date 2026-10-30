'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { usersService } from '@/services/users.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button, Badge, Tabs, StatsCard } from '@/components/ui';
import { ArrowLeftIcon, UserGroupIcon, CalendarDaysIcon, CreditCardIcon, TruckIcon, StarIcon } from '@heroicons/react/24/outline';
import { formatDate, formatJoinedDate } from '@/utils/formatDate';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Booking, BookingTransaction, Vehicle, Review } from '@/types';

const bookingStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  completed: 'success', in_progress: 'primary', confirmed: 'primary', assigned: 'primary',
  pending_payment: 'warning', cancelled: 'danger', scheduled: 'neutral',
};

const txStatusVariant: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  succeeded: 'success', processing: 'warning', failed: 'danger', cancelled: 'neutral',
  requires_payment_method: 'warning', requires_action: 'warning',
};

function BookingsTable({ bookings, statusFilter }: { bookings: Booking[]; statusFilter: string }) {
  const filtered = statusFilter ? bookings.filter((b) => b.status === statusFilter) : bookings;
  if (!filtered.length) return <p className="py-8 text-center text-sm text-neutral-300">No bookings found</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Code</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Service</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Service Provider</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Vehicle</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Total</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {filtered.map((b) => (
            <tr key={b.id} className="hover:bg-neutral-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">{b.booking_code}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">{b.service_type?.replace(/_/g, ' ')}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <Badge variant={bookingStatusVariant[b.status] || 'neutral'} dot>
                  {b.status.replace(/_/g, ' ')}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                {b.assigned_driver?.name || b.assigned_driver?.email || '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                {b.vehicle ? `${b.vehicle.make} ${b.vehicle.model}` : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                {b.total_price ? formatCurrency(b.total_price) : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">
                {formatDate(b.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [bookingFilter, setBookingFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: () => usersService.getById(Number(id)).then((r) => r.data.data),
    enabled: !!id,
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
        <Button variant="outline" onClick={() => router.back()} className="mt-4" size="sm">Go Back</Button>
      </div>
    );
  }

  const { user, stats, bookings, transactions, vehicles, reviews } = data;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'bookings', label: 'Bookings', count: stats?.total_bookings },
    { key: 'transactions', label: 'Transactions', count: stats?.total_transactions },
    { key: 'vehicles', label: 'Vehicles', count: stats?.total_vehicles },
    { key: 'reviews', label: 'Reviews', count: stats?.total_reviews },
  ];

  const statuses = ['confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'pending_payment'];

  return (
    <>
      <PageHeader
        title="Customer Details"
        actions={
          <Button variant="outline" onClick={() => router.back()} icon={<ArrowLeftIcon className="h-4 w-4" />}>
            Back
          </Button>
        }
      />

      {/* Profile header */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary">
              <span className="text-xl font-bold">{(user.name?.[0] || user.email[0]).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-secondary-900">
                {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}
              </h2>
              <p className="text-sm text-neutral-300">{user.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="neutral">Customer</Badge>
                <Badge variant={user.is_verified ? 'success' : 'warning'} dot>
                  {user.is_verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-sm text-neutral-300">
            Joined {formatJoinedDate(user)}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard title="Total Bookings" value={stats.total_bookings} icon={<CalendarDaysIcon className="h-5 w-5" />} />
              <StatsCard title="Total Paid" value={`$${stats.total_paid}`} icon={<CreditCardIcon className="h-5 w-5" />} />
              <StatsCard title="Vehicles" value={stats.total_vehicles || 0} icon={<TruckIcon className="h-5 w-5" />} />
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

        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBookingFilter('')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!bookingFilter ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}`}
              >
                All ({bookings.length})
              </button>
              {statuses.map((s) => {
                const count = bookings.filter((b) => b.status === s).length;
                if (!count) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setBookingFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${bookingFilter === s ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}`}
                  >
                    {s.replace(/_/g, ' ')} ({count})
                  </button>
                );
              })}
            </div>
            <div className="table-container">
              <BookingsTable bookings={bookings} statusFilter={bookingFilter} />
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="table-container">
            {transactions.length === 0 ? (
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
                  {transactions.map((tx: BookingTransaction) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-secondary-900">{tx.transaction_code}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">{tx.booking?.booking_code || `#${tx.booking_id}`}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-secondary-900">
                        {formatCurrency(tx.amount)} {tx.currency.toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={txStatusVariant[tx.status] || 'neutral'} dot>{tx.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-300">{formatDate(tx.created_at, 'MMM d, yyyy h:mm a')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-neutral-300">No vehicles registered</p>
            ) : (
              vehicles.map((v: Vehicle) => (
                <div key={v.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-semibold text-secondary-900">{v.make} {v.model}</h4>
                      <p className="text-sm text-neutral-300">{v.year} &middot; {v.color}</p>
                    </div>
                    {v.is_default && <Badge variant="primary">Default</Badge>}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-300">Type</span>
                      <span className="font-medium text-secondary-900">{v.vehicle_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-300">License Plate</span>
                      <span className="font-mono font-medium text-secondary-900">{v.license_plate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-300">Fuel Type</span>
                      <span className="font-medium text-secondary-900">{v.fuel_type === 'ELECTRIC' ? 'Electric' : 'Other'}</span>
                    </div>
                    {v.fuel_type === 'ELECTRIC' && v.battery_capacity_kwh != null && (
                      <div className="flex justify-between">
                        <span className="text-neutral-300">Battery Capacity</span>
                        <span className="font-medium text-secondary-900">{v.battery_capacity_kwh} kWh</span>
                      </div>
                    )}
                    {v.nickname && (
                      <div className="flex justify-between">
                        <span className="text-neutral-300">Nickname</span>
                        <span className="font-medium text-secondary-900">{v.nickname}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-300">No reviews written</p>
            ) : (
              reviews.map((r: Review) => (
                <div key={r.id} className="card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`h-4 w-4 ${i < r.rating ? 'fill-warning text-warning' : 'text-neutral-200'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-secondary-900">{r.rating}/5</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-300">
                        To: {r.reviewee?.name || r.reviewee?.email || '—'}
                      </p>
                    </div>
                    <span className="text-xs text-neutral-200">{formatDate(r.created_at)}</span>
                  </div>
                  {r.message && <p className="mt-2 text-sm text-secondary-500">{r.message}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
