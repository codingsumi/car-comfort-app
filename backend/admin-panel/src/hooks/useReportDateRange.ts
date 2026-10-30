'use client';

import { useMemo, useState } from 'react';
import type { ReportQueryParams } from '@/types/analytics';

export function useReportDateRange(defaultPeriod = 'monthly') {
  const [period, setPeriod] = useState(defaultPeriod);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const queryParams = useMemo<ReportQueryParams>(
    () => ({
      period: !dateFrom ? period : undefined,
      from_date: dateFrom || undefined,
      to_date: dateTo || undefined,
    }),
    [period, dateFrom, dateTo]
  );

  return {
    period,
    dateFrom,
    dateTo,
    queryParams,
    setPeriod,
    setDateFrom,
    setDateTo,
  };
}
