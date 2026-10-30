'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useRef, useEffect } from 'react';
import Map, { Marker as MapMarker } from 'react-map-gl/mapbox';
import { reportsService } from '@/services/reports.service';
import { providersService, type ProviderListItem } from '@/services/providers.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Button, Input, Select } from '@/components/ui';
import { ReportsNav } from '@/components/reports/ReportsNav';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { formatCurrency } from '@/components/reports/formatters';
import { TruckIcon, StarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ProviderReportsPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } = useReportDateRange();
  const [compareIds, setCompareIds] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<ProviderListItem[]>([]);
  const [providerSearch, setProviderSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: providerSuggestions, isFetching: searchingProviders } = useQuery({
    queryKey: ['provider-compare-search', providerSearch],
    queryFn: () =>
      providersService.list({ search: providerSearch, limit: 8, page: 1 }).then((r) => r.data.data?.providers ?? []),
    enabled: providerSearch.trim().length >= 1,
    staleTime: 10000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addProvider(p: ProviderListItem) {
    if (selectedProviders.find((s) => s.id === p.id)) return;
    const updated = [...selectedProviders, p];
    setSelectedProviders(updated);
    setCompareIds(updated.map((s) => s.id).join(','));
    setProviderSearch('');
    setShowSuggestions(false);
  }

  function removeProvider(id: number) {
    const updated = selectedProviders.filter((p) => p.id !== id);
    setSelectedProviders(updated);
    setCompareIds(updated.map((p) => p.id).join(','));
  }

  const { data, isLoading } = useQuery({
    queryKey: ['reports-providers', queryParams],
    queryFn: () => reportsService.getProviderAnalytics(queryParams).then((r) => r.data.data),
  });

  const comparisonParams = useMemo(
    () => ({ ...queryParams, provider_ids: compareIds }),
    [queryParams, compareIds]
  );

  const { data: comparison } = useQuery({
    queryKey: ['reports-providers-comparison', comparisonParams],
    queryFn: () => reportsService.getProviderComparison(comparisonParams).then((r) => r.data.data),
    enabled: compareIds.length > 0,
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

  return (
    <>
      <PageHeader title="Provider Analytics" description="Performance, earnings, and geographic coverage" />
      <ReportsNav />
      {/* Date + Export row */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-32">
          <Select
            label="Period"
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
            ]}
            value={dateFrom ? '' : period}
            onChange={(e) => { setPeriod(e.target.value); setDateFrom(''); setDateTo(''); }}
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs font-medium text-secondary-700">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm" />
        </div>
        <div className="w-full sm:w-36">
          <label className="mb-1 block text-xs font-medium text-secondary-700">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm" />
        </div>
        <div className="flex items-end">
          <Button variant="primary" size="sm" onClick={async () => {
            const res = await reportsService.createExport({ report_type: 'provider_analytics', export_format: 'csv', filters: queryParams });
            toast.success(`Export #${res.data.data.job.id} started`);
          }}>Export CSV</Button>
        </div>
      </div>

      {/* Compare Providers row */}
      <div className="mb-4 flex flex-wrap items-start gap-4">
        {/* Provider comparison search */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary-700">Compare Providers</label>
          <div ref={searchRef} className="relative">
            <input
              type="text"
              className="input w-64 text-sm"
              placeholder="Search by name, email or ID..."
              value={providerSearch}
              onChange={(e) => { setProviderSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => providerSearch.length >= 1 && setShowSuggestions(true)}
              autoComplete="off"
            />
            {showSuggestions && providerSearch.trim().length >= 1 && (
              <div className="absolute z-50 mt-1 w-72 rounded-lg border border-neutral-100 bg-white shadow-lg">
                {searchingProviders ? (
                  <div className="px-4 py-3 text-sm text-neutral-300">Searching...</div>
                ) : (providerSuggestions ?? []).length === 0 ? (
                  <div className="px-4 py-3 text-sm text-neutral-300">No providers found</div>
                ) : (
                  <ul className="max-h-52 divide-y divide-neutral-50 overflow-y-auto">
                    {(providerSuggestions ?? []).map((p: ProviderListItem) => (
                      <li
                        key={p.id}
                        onMouseDown={() => addProvider(p)}
                        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-neutral-50"
                      >
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                          {(p.name ?? p.email)?.charAt(0)?.toUpperCase() || '#'}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-secondary-900">{p.name ?? '—'}</p>
                          <p className="truncate text-xs text-neutral-400">{p.email} · ID #{p.id}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {/* Selected providers chips */}
          {selectedProviders.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedProviders.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary"
                >
                  {p.name ?? p.email}
                  <button
                    type="button"
                    onClick={() => removeProvider(p.id)}
                    className="hover:text-danger"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {selectedProviders.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setSelectedProviders([]); setCompareIds(''); }}
                  className="text-xs text-neutral-400 hover:text-danger"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
          {selectedProviders.length === 0 && (
            <p className="mt-1 text-xs text-neutral-400">Add 2+ providers to compare performance</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatsCard title="Active Providers" value={data?.summary.active_providers ?? 0} icon={<TruckIcon className="h-5 w-5" />} />
            <StatsCard title="Avg Rating" value={`${data?.summary.average_provider_rating ?? 0}/5`} icon={<StarIcon className="h-5 w-5" />} />
          </div>

          {comparison?.providers && comparison.providers.length > 0 && (
            <div className="card mb-6">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Provider Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-neutral-300">
                      <th className="px-3 py-2">Provider</th>
                      <th className="px-3 py-2">Revenue</th>
                      <th className="px-3 py-2">Rating</th>
                      <th className="px-3 py-2">Volume</th>
                      <th className="px-3 py-2">Completion</th>
                      <th className="px-3 py-2">Avg Time (min)</th>
                      <th className="px-3 py-2">Complaints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.providers.map((p) => (
                      <tr key={p.id} className="border-b border-neutral-50">
                        <td className="px-3 py-2 font-medium">{p.name}</td>
                        <td className="px-3 py-2">{formatCurrency(p.revenue)}</td>
                        <td className="px-3 py-2">{p.avg_rating}</td>
                        <td className="px-3 py-2">{p.service_volume}</td>
                        <td className="px-3 py-2">{p.completion_rate}%</td>
                        <td className="px-3 py-2">{Math.round(p.avg_completion_minutes)}</td>
                        <td className="px-3 py-2">{p.complaint_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Top Performers</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-neutral-300"><th className="px-3 py-2">Name</th><th className="px-3 py-2">Services</th><th className="px-3 py-2">Rating</th><th className="px-3 py-2">Earnings</th></tr></thead>
                <tbody>
                  {(data?.top_performers || []).map((p) => (
                    <tr key={p.id} className="border-b border-neutral-50">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2">{p.completed_services}</td>
                      <td className="px-3 py-2">{p.avg_rating}</td>
                      <td className="px-3 py-2">{formatCurrency(p.earnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Low Performers</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs uppercase text-neutral-300"><th className="px-3 py-2">Name</th><th className="px-3 py-2">Services</th><th className="px-3 py-2">Rating</th></tr></thead>
                <tbody>
                  {(data?.low_performers || []).map((p) => (
                    <tr key={p.id} className="border-b border-neutral-50">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2">{p.completed_services}</td>
                      <td className="px-3 py-2">{p.avg_rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {mapboxToken && (
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Provider Distribution</h3>
              <div className="h-96 rounded-lg overflow-hidden">
                <Map
                  initialViewState={{ latitude: 39.8283, longitude: -98.5795, zoom: 4 }}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/light-v11"
                  mapboxAccessToken={mapboxToken}
                >
                  {(data?.geographic_distribution || []).map((p: { id: number; lat: number; lng: number; name?: string }) => (
                    <MapMarker key={p.id} latitude={p.lat} longitude={p.lng}>
                      <div
                        className="h-3 w-3 rounded-full border border-white bg-success shadow-sm"
                        title={p.name}
                      />
                    </MapMarker>
                  ))}
                </Map>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
