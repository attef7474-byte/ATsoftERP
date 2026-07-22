'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { ActionsFilterCell, FilterCell } from './filters';
import { ActionsHeader } from './actions-menu';
import { BodyRow } from './body-row';
import { DataGridEmptyState, DataGridErrorState, DataGridLoadingState } from './empty-state';
import { HeaderCell } from './header-cell';
import { DataGridToolbar } from './toolbar';
import type { AdminDataGridProps, GridColumn } from './types';

export function AdminDataGrid<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedKey,
  loading,
  emptyMessage,
  loadingMessage,
  error,
  onRetry,
  actions,
  sortColumn,
  sortDirection,
  onSort,
  filters,
  onFilter,
  onClearFilters,
  showFilters,
  onToggleFilters,
  dir = 'ltr',
  globalSearch,
  onGlobalSearch,
  searchPlaceholder,
  onRefresh,
  refreshLoading,
}: AdminDataGridProps<T>) {
  const { t } = useTranslation();
  const [openMenuRow, setOpenMenuRow] = useState<string | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = useCallback(() => setOpenMenuRow(null), []);
  const toggleMenu = useCallback((rowKey: string, isOpen: boolean) => {
    setOpenMenuRow(isOpen ? null : rowKey);
  }, []);

  useEffect(() => {
    if (!openMenuRow) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (activeButtonRef.current && !activeButtonRef.current.contains(event.target as Node)) {
        const portalMenus = document.querySelectorAll('[data-actions-menu]');
        let clickedInsidePortal = false;
        portalMenus.forEach((element) => {
          if (element.contains(event.target as Node)) clickedInsidePortal = true;
        });
        if (!clickedInsidePortal) closeMenu();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuRow, closeMenu]);

  const isRtl = dir === 'rtl';

  const handleHeaderClick = useCallback((column: GridColumn<T>) => {
    if (!column.sortable || !onSort) return;
    let newDirection: 'asc' | 'desc' = 'asc';
    if (sortColumn === column.key) {
      if (sortDirection === 'asc') newDirection = 'desc';
      else if (sortDirection === 'desc') {
        onSort(column.key, 'asc');
        return;
      }
    }
    onSort(column.key, newDirection);
  }, [sortColumn, sortDirection, onSort]);

  const hasActiveFilters = !!filters && Object.values(filters).some((value) => value !== '');
  const hasFilterableColumns = columns.some((column) => column.filterable);
  const hasActions = !!actions?.length;

  if (error) {
    return <DataGridErrorState error={error} onRetry={onRetry} />;
  }

  if (loading) {
    return <DataGridLoadingState message={loadingMessage} />;
  }

  if (!data || data.length === 0) {
    return <DataGridEmptyState message={emptyMessage} />;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm" dir={dir}>
      <DataGridToolbar
        globalSearch={globalSearch}
        onGlobalSearch={onGlobalSearch}
        searchPlaceholder={searchPlaceholder}
        hasFilterableColumns={hasFilterableColumns}
        hasActiveFilters={hasActiveFilters}
        showFilters={showFilters}
        onToggleFilters={onToggleFilters}
        onClearFilters={onClearFilters}
        onRefresh={onRefresh}
        refreshLoading={refreshLoading}
      />

      <div className="admin-grid-wrapper">
        <table className="w-full border-collapse" style={{ minWidth: columns.length * 110 }}>
          <thead>
            <tr className="bg-[#1a5632] text-white">
              {isRtl && hasActions && <ActionsHeader label={t('grid.actions')} />}
              {columns.map((column) => (
                <HeaderCell
                  key={column.key}
                  column={column}
                  isRtl={isRtl}
                  isSorted={sortColumn === column.key}
                  sortDirection={sortDirection}
                  filterActive={!!filters?.[column.key]}
                  onClick={handleHeaderClick}
                />
              ))}
              {!isRtl && hasActions && <ActionsHeader label={t('grid.actions')} />}
            </tr>
            {showFilters && hasFilterableColumns && (
              <tr className="bg-gray-50">
                {isRtl && hasActions && <ActionsFilterCell />}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-2 py-1 border-r border-gray-200 last:border-r-0"
                    style={{ width: column.width, minWidth: column.width }}
                  >
                    <FilterCell
                      column={column}
                      value={filters?.[column.key] || ''}
                      allLabel={t('grid.all')}
                      onFilter={onFilter}
                    />
                  </td>
                ))}
                {!isRtl && hasActions && <ActionsFilterCell />}
              </tr>
            )}
          </thead>
          <tbody>
            {data.map((item, rowIndex) => {
              const rowKey = keyExtractor(item);
              return (
                <BodyRow
                  key={rowKey}
                  item={item}
                  rowIndex={rowIndex}
                  rowKey={rowKey}
                  columns={columns}
                  actions={actions}
                  onRowClick={onRowClick}
                  selectedKey={selectedKey}
                  isRtl={isRtl}
                  openMenuRow={openMenuRow}
                  mounted={mounted}
                  activeButtonRef={activeButtonRef}
                  onToggleMenu={toggleMenu}
                  onCloseMenu={closeMenu}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
