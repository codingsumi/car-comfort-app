'use client';

import { cn } from '@/lib/cn';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import type { TableColumn, SortDirection } from '@/types';

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  sortKey?: string;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey?: (row: T) => string | number;
  rowClassName?: (row: T) => string | undefined;
}

export function Table<T>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  onRowClick,
  isLoading,
  emptyMessage = 'No data found',
  rowKey,
  rowClassName,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="table-container">
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary" />
            <p className="text-sm text-neutral-300">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="table-container">
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <svg className="h-12 w-12 text-neutral-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm text-neutral-300">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-300',
                  col.sortable && 'cursor-pointer select-none hover:text-secondary-500'
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDirection === 'asc'
                      ? <ChevronUpIcon className="h-3.5 w-3.5" />
                      : <ChevronDownIcon className="h-3.5 w-3.5" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((row, i) => (
            <tr
              key={rowKey ? rowKey(row) : i}
              className={cn(
                'transition-colors hover:bg-neutral-50/50',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row)
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-secondary-500">
                  {col.render
                    ? col.render((row as Record<string, unknown>)[col.key], row)
                    : String((row as Record<string, unknown>)[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
