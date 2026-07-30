'use client';
import React, { useCallback } from 'react';
import { AdminDataGrid, type AdminDataGridProps } from '../admin/admin-data-grid';

export interface EntityDataTableRef {
  refresh: () => void;
}

const interactiveSelectors = 'button, a, input, select, textarea, [role="button"], [data-no-row-open], .admin-grid-row-action-btn, [data-actions-menu]';

export function EntityDataTable<T>(props: AdminDataGridProps<T>) {
  const { onRowClick, ...rest } = props;

  const handleRowClick = useCallback((item: T) => {
    // Row click guard: we still pass through to onRowClick
    // The actual event guard is handled in the BodyRow component
    // via event delegation. Here we just forward the item.
    onRowClick?.(item);
  }, [onRowClick]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <AdminDataGrid
        {...rest}
        onRowClick={handleRowClick}
      />
    </div>
  );
}
