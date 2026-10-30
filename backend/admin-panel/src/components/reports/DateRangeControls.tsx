'use client';

import { Select } from '@/components/ui';

interface DateRangeControlsProps {
  period: string;
  dateFrom: string;
  dateTo: string;
  onPeriodChange: (period: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export function DateRangeControls({
  period,
  dateFrom,
  dateTo,
  onPeriodChange,
  onDateFromChange,
  onDateToChange,
}: DateRangeControlsProps) {
  return (
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
          onChange={(e) => {
            onPeriodChange(e.target.value);
            onDateFromChange('');
            onDateToChange('');
          }}
        />
      </div>
      <div className="w-full sm:w-36">
        <label className="mb-1 block text-xs font-medium text-secondary-700">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="input text-sm"
        />
      </div>
      <div className="w-full sm:w-36">
        <label className="mb-1 block text-xs font-medium text-secondary-700">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="input text-sm"
        />
      </div>
    </div>
  );
}
