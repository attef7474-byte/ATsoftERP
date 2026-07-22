import type { ReactNode } from 'react';

export interface GridAction<T> {
  label: string;
  icon?: ReactNode;
  onClick: (item: T) => void;
  enabled?: boolean | ((item: T) => boolean);
  variant?: 'default' | 'danger';
}

export interface GridColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'number';
  filterOptions?: { value: string; label: string }[];
  width?: string;
  align?: 'left' | 'center' | 'right';
  hideable?: boolean;
}

export interface AdminDataGridProps<T> {
  columns: GridColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedKey?: string;
  loading?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  error?: string;
  onRetry?: () => void;
  actions?: GridAction<T>[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  filters?: Record<string, string>;
  onFilter?: (column: string, value: string) => void;
  onClearFilters?: () => void;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  dir?: 'ltr' | 'rtl';
  globalSearch?: string;
  onGlobalSearch?: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  refreshLoading?: boolean;
}
