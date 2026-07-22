# Grid Design Specification

## Component: AdminDataGrid
File: apps/web/src/components/admin/admin-data-grid.tsx

### Props Interface
```typescript
interface AdminDataGridProps<T> {
  columns: GridColumn<T>[];        // Column definitions
  data: T[];                        // Data array
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedKey?: string;
  loading?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  error?: string;
  onRetry?: () => void;
  actions?: GridAction<T>[];        // Row actions dropdown items
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
```

### Column Interface
```typescript
interface GridColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'number';
  filterOptions?: { value: string; label: string }[];
  width?: string;
  align?: 'left' | 'center' | 'right';
  hideable?: boolean;
}
```

### Action Interface
```typescript
interface GridAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (item: T) => void;
  enabled?: boolean;
  variant?: 'default' | 'danger';
}
```

### Visual Design
- Header: dark green (#1a5632) with white text, uppercase tracking-wider
- Header separators: lighter green (#2a6b42) borders between columns
- Sort icons: chevron arrows, visible only on active sort column
- Filter icons: funnel icon in header for filterable columns
- Filter row: toggleable row below header with input/select per filterable column
- Row backgrounds: white (even) / gray-50 (odd)
- Selected row: blue-50 background with blue ring
- Hover: blue-50/60 background
- Actions column: three-dot button that opens dropdown menu
- Toolbar: above table with search, filter toggle, clear filters, refresh
- Scroll: horizontal overflow auto, vertical scroll doesn't hide header (sticky)
- Loading: spinner with message
- Empty: centered text
- Error: red text with retry button

### RTL Support
- All header/cell text alignment respects dir prop
- Actions dropdown opens "left-0" for RTL (right-aligned menu)
- Column sequence is reversed via sortedColumns in Numbering page
- CSS logical properties (border-r, border-l) used where needed
