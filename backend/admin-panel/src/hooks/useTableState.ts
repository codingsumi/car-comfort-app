import { useState, useCallback, useMemo } from 'react';
import type { SortDirection } from '@/types';

interface TableStateOptions {
  defaultPageSize?: number;
  defaultSortKey?: string;
  defaultSortDirection?: SortDirection;
}

export function useTableState(options: TableStateOptions = {}) {
  const {
    defaultPageSize = 10,
    defaultSortKey = 'createdAt',
    defaultSortDirection = 'desc',
  } = options;

  const [page, setPage] = useState(1);
  const [pageSize] = useState(defaultPageSize);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDirection('desc');
      }
      setPage(1);
    },
    [sortKey]
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const queryParams = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      sort: sortKey,
      order: sortDirection,
      ...Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '')
      ),
    }),
    [page, pageSize, search, sortKey, sortDirection, filters]
  );

  return {
    page,
    pageSize,
    search,
    sortKey,
    sortDirection,
    filters,
    queryParams,
    setPage,
    handleSort,
    handleSearch,
    handleFilter,
  };
}
