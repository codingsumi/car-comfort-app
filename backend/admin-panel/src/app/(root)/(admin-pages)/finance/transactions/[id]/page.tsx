'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { financeService } from '@/services/finance.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { useState } from 'react';
import { Badge, Tabs, Button } from '@/components/ui';
import { formatDate } from '@/utils/formatDate';
import type { Transaction, TransactionStatus } from '@/types/finance';
import type { RefundRequest } from '@/types';
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/formatCurrency';

const statusVariant: Record<TransactionStatus, 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
  succeeded: 'success',
  processing: 'primary',
  pending: 'warning',
  failed: 'danger',
  refunded: 'neutral',
  partially_refunded: 'warning',
};

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between border-b border-neutral-50 py-3 last:border-0">
      <span className="text-sm text-neutral-300">{label}</span>
      <span className={`text-sm font-medium text-secondary-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

export default function TransactionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('payment');

  const { data, isLoading } = useQuery({
    queryKey: ['finance-transaction', id],
    queryFn: () => financeService.getTransaction(Number(id)).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const transaction: Transaction | undefined = data?.transaction;
  const refundHistory: RefundRequest[] = (data?.refund_history as RefundRequest[]) || [];

  if (!transaction) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium text-secondary-900">Transaction not found</p>
        <Button variant="outline" onClick={() => router.push('/finance/transactions')}>Back to Transactions</Button>
      </div>
    );
  }

  const tabs = [
    { key: 'payment', label: 'Payment Info' },
    { key: 'booking', label: 'Related Booking' },
    { key: 'refunds', label: 'Refund History', count: refundHistory.length },
  ];

  return (
    <>
      <PageHeader
        title={transaction.transaction_code}
        description={`Transaction details — ${formatDate(transaction.created_at, 'MMM d, yyyy h:mm a')}`}
        actions={
          <Button variant="outline" size="sm" icon={<ArrowLeftIcon className="h-4 w-4" />} onClick={() => router.push('/finance/transactions')}>
            Back
          </Button>
        }
      />

      <div className="mb-6 flex items-center gap-3">
        <Badge variant={statusVariant[transaction.status] || 'neutral'} dot>
          {transaction.status.replace(/_/g, ' ')}
        </Badge>
        <Badge variant="neutral">
          {transaction.transaction_type.replace(/_/g, ' ')}
        </Badge>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
            {activeTab === 'payment' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-300">Payment Details</h3>
                  <InfoRow label="Stripe Payment Intent" value={transaction.stripe_payment_intent_id || '—'} mono />
                  <InfoRow label="Stripe Charge ID" value={transaction.stripe_charge_id || '—'} mono />
                  <InfoRow label="Stripe Transfer ID" value={transaction.stripe_transfer_id || '—'} mono />
                  <InfoRow label="Stripe Refund ID" value={transaction.stripe_refund_id || '—'} mono />
                  <InfoRow label="Payment Method" value={<span className="capitalize">{transaction.payment_method || '—'}</span>} />
                  <InfoRow label="Timestamp" value={formatDate(transaction.created_at, 'MMM d, yyyy h:mm:ss a')} />
                </div>

                <div className="card">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-300">Amounts</h3>
                  <InfoRow label="Captured Amount" value={<span className="text-lg font-bold text-secondary-900">{formatCurrency(transaction.amount)}</span>} />
                  <InfoRow label="Platform Commission" value={formatCurrency(transaction.commission_amount)} />
                  <InfoRow label="Provider Earning" value={formatCurrency(transaction.provider_earning)} />
                  <InfoRow label="Tax" value={formatCurrency(transaction.tax_amount)} />
                  <InfoRow label="Refunded Amount" value={formatCurrency(transaction.refund_amount)} />
                  <InfoRow label="Net Payout Amount" value={<span className="font-semibold text-success">{formatCurrency(transaction.net_amount)}</span>} />
                </div>
              </div>
            )}

            {activeTab === 'booking' && (
              <div className="card">
                {transaction.booking ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">Booking Information</h3>
                    <InfoRow label="Booking Code" value={<span className="font-mono">{transaction.booking.booking_code}</span>} />
                    <InfoRow label="Service Type" value={<Badge variant="neutral">{transaction.booking.service_type?.replace(/_/g, ' ')}</Badge>} />
                    <InfoRow label="Status" value={<Badge variant="primary">{transaction.booking.status}</Badge>} />
                    <InfoRow label="Customer" value={transaction.customer?.name || transaction.customer?.email || '—'} />
                    <InfoRow label="Provider" value={transaction.provider?.name || transaction.provider?.email || '—'} />

                    <div className="flex gap-3 pt-4 border-t border-neutral-100">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<ArrowTopRightOnSquareIcon className="h-4 w-4" />}
                        onClick={() => router.push(`/bookings/${transaction.booking_id}`)}
                      >
                        View Booking
                      </Button>
                      {transaction.customer && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/customers/${transaction.customer_id}`)}
                        >
                          View Customer
                        </Button>
                      )}
                      {transaction.provider && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/providers/${transaction.provider_id}`)}
                        >
                          View Provider
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-neutral-300">No booking associated with this transaction</p>
                )}
              </div>
            )}

            {activeTab === 'refunds' && (
              <div className="card">
                {refundHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wider text-neutral-300">
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Stripe Refund ID</th>
                          <th className="px-4 py-3">Processed By</th>
                          <th className="px-4 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {refundHistory.map((refund) => (
                          <tr key={refund.id}>
                            <td className="px-4 py-3 text-sm font-semibold text-secondary-900">
                              {formatCurrency(refund.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-700 max-w-[200px] truncate">
                              {refund.reason || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={refund.status === 'refunded' ? 'success' : refund.status === 'rejected' ? 'danger' : 'warning'}
                                dot
                              >
                                {refund.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                              {refund.stripe_refund_id || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-700">
                              {refund.user?.name || '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-300">
                              {formatDate(refund.processed_at || refund.created_at, 'MMM d, yyyy h:mm a')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-neutral-300">No refunds for this transaction</p>
                )}
              </div>
            )}
      </div>
    </>
  );
}
