'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo, useState } from 'react';
import Map, { Marker as MapMarker } from 'react-map-gl/mapbox';
import { reportsService } from '@/services/reports.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsCard, Select, Button } from '@/components/ui';
import { ReportsNav } from '@/components/reports/ReportsNav';
import { DateRangeControls } from '@/components/reports/DateRangeControls';
import { useReportDateRange } from '@/hooks/useReportDateRange';
import { CalendarDaysIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function BookingReportsPage() {
  const { period, dateFrom, dateTo, queryParams, setPeriod, setDateFrom, setDateTo } =
    useReportDateRange();
  const [serviceType, setServiceType] = useState('');
  const [status, setStatus] = useState('');

  const params = useMemo(
    () => ({
      ...queryParams,
      service_type: serviceType || undefined,
      status: status || undefined,
    }),
    [queryParams, serviceType, status]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['reports-bookings', params],
    queryFn: () => reportsService.getBookingAnalytics(params).then((r) => r.data.data),
  });

  const { data: heatmap } = useQuery({
    queryKey: ['reports-bookings-heatmap', params],
    queryFn: () => reportsService.getBookingHeatmap(params).then((r) => r.data.data),
  });

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const res = await reportsService.createExport({
        report_type: 'bookings',
        export_format: format,
        filters: params,
      });
      toast.success(`Export job #${res.data.data.job.id} started`);
    } catch {
      toast.error('Failed to start export');
    }
  };

  return (
    <>
      <PageHeader title="Booking Analytics" description="Booking trends, rates, and geographic density" />
      <ReportsNav />
      <DateRangeControls
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodChange={setPeriod}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-36">
          <Select
            label="Service Type"
            options={[
              { label: 'All', value: '' },
              { label: 'Car Wash', value: 'car_wash' },
              { label: 'EV Charging', value: 'ev_charging' },
              { label: 'Combo', value: 'combo' },
            ]}
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-36">
          <Select
            label="Status"
            options={[
              { label: 'All', value: '' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled', value: 'cancelled' },
              { label: 'In Progress', value: 'in_progress' },
            ]}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button variant="primary" size="sm" onClick={() => handleExport('csv')}>Export CSV</Button>
          <Button variant="primary" size="sm" onClick={() => handleExport('xlsx')}>Export Excel</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatsCard title="Total Bookings" value={data?.summary.total_bookings ?? 0} icon={<CalendarDaysIcon className="h-5 w-5" />} />
            <StatsCard title="Completion Rate" value={`${data?.summary.completion_rate ?? 0}%`} icon={<CalendarDaysIcon className="h-5 w-5" />} />
            <StatsCard title="Cancellation Rate" value={`${data?.summary.cancellation_rate ?? 0}%`} icon={<ArrowPathIcon className="h-5 w-5" />} />
            <StatsCard title="Repeat Rate" value={`${data?.summary.repeat_booking_rate ?? 0}%`} icon={<ClockIcon className="h-5 w-5" />} />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Bookings by Date</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.by_date || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#E4101F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Peak Booking Hours</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.peak_hours || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {mapboxToken && (
            <div className="card">
              <h3 className="mb-4 text-sm font-semibold text-secondary-900">Geographic Booking Density</h3>
              <div className="h-96 overflow-hidden rounded-lg">
                <Map
                  initialViewState={{ latitude: 39.8283, longitude: -98.5795, zoom: 4 }}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/light-v11"
                  mapboxAccessToken={mapboxToken}
                >
                  {(heatmap?.geographic || []).map((p: { lat: number; lng: number }, i: number) => (
                    <MapMarker key={i} latitude={p.lat} longitude={p.lng}>
                      <div className="h-2.5 w-2.5 rounded-full border border-white bg-primary opacity-80 shadow-sm" />
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
