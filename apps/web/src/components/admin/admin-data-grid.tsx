'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../lib/i18n/use-translation';

export interface GridAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (item: T) => void;
  enabled?: boolean | ((item: T) => boolean);
  variant?: 'default' | 'danger';
}

export interface GridColumn<T> {
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

function SortIcon({ direction }: { direction?: 'asc' | 'desc' | null }) {
  if (!direction) return <svg className="w-3.5 h-3.5 opacity-30 inline-block ms-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
  if (direction === 'asc') return <svg className="w-3.5 h-3.5 inline-block ms-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
  return <svg className="w-3.5 h-3.5 inline-block ms-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
}

function FilterIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 inline-block ms-1 ${active ? 'text-blue-400' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function ActionDotsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

/* ====== Portal-based actions menu ====== */
function ActionsMenu<T>({
  item, rowKey, actions, isRtl, buttonRef, onClose,
}: {
  item: T; rowKey: string; actions: GridAction<T>[]; isRtl: boolean; buttonRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const updatePos = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const menuW = 176;
      let top = rect.bottom + 4;
      let left: number;

      if (isRtl) {
        left = rect.left;
        if (left + menuW > window.innerWidth - 8) {
          left = window.innerWidth - menuW - 8;
        }
      } else {
        left = rect.right - menuW;
        if (left < 8) {
          left = 8;
        }
      }

      const bottomSpace = window.innerHeight - top;
      if (bottomSpace < 200 && top > 250) {
        top = rect.top - 4 - 200;
      }
      if (top < 4) top = 4;

      setStyle({ position: 'fixed', top, left, zIndex: 100 });
    };

    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [buttonRef, isRtl, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      data-actions-menu="true"
      style={style}
      className="w-44 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 border border-gray-200 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, ai) => {
        const enabled = typeof action.enabled === 'function' ? action.enabled(item) : action.enabled !== false;
        return (
          <button
            key={ai}
            type="button"
            onClick={() => {
              if (enabled) { onClose(); action.onClick(item); }
            }}
            disabled={!enabled}
            className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
              action.variant === 'danger'
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-100'
            } ${!enabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {action.icon && <span className="w-4 h-4 flex-shrink-0">{action.icon}</span>}
            {action.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

export function AdminDataGrid<T>({
  columns, data, keyExtractor, onRowClick, selectedKey,
  loading, emptyMessage, loadingMessage, error, onRetry,
  actions, sortColumn, sortDirection, onSort,
  filters, onFilter, onClearFilters, showFilters, onToggleFilters,
  dir = 'ltr', globalSearch, onGlobalSearch, searchPlaceholder,
  onRefresh, refreshLoading,
}: AdminDataGridProps<T>) {
  const { t } = useTranslation();
  const [openMenuRow, setOpenMenuRow] = useState<string | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const closeMenu = useCallback(() => setOpenMenuRow(null), []);

  useEffect(() => {
    if (!openMenuRow) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeButtonRef.current && !activeButtonRef.current.contains(e.target as Node)) {
        const portalMenus = document.querySelectorAll('[data-actions-menu]');
        let clickedInsidePortal = false;
        portalMenus.forEach((el) => {
          if (el.contains(e.target as Node)) clickedInsidePortal = true;
        });
        if (!clickedInsidePortal) closeMenu();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenuRow, closeMenu]);

  const isRtl = dir === 'rtl';

  const handleHeaderClick = useCallback((col: GridColumn<T>) => {
    if (!col.sortable || !onSort) return;
    let newDir: 'asc' | 'desc' = 'asc';
    if (sortColumn === col.key) {
      if (sortDirection === 'asc') newDir = 'desc';
      else if (sortDirection === 'desc') { onSort(col.key, 'asc'); return; }
    }
    onSort(col.key, newDir);
  }, [sortColumn, sortDirection, onSort]);

  const renderFilterInput = (col: GridColumn<T>) => {
    if (!col.filterable) return null;
    const filterValue = filters?.[col.key] || '';
    if (col.filterType === 'select' && col.filterOptions) {
      return (
        <select
          value={filterValue}
          onChange={(e) => onFilter?.(col.key, e.target.value)}
          className="w-full text-[11px] border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">{t('grid.all')}</option>
          {col.filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={col.filterType === 'number' ? 'number' : 'text'}
        value={filterValue}
        onChange={(e) => onFilter?.(col.key, e.target.value)}
        placeholder="..."
        className="w-full text-[11px] border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const hasActiveFilters = filters && Object.values(filters).some((v) => v !== '');
  const hasFilterableCols = columns.some((c) => c.filterable);

  const actionsCell = (item: T, rowKey: string) => {
    if (!actions || actions.length === 0) return null;
    const isOpen = openMenuRow === rowKey;
    return (
      <td key="__actions__" className="px-2 py-2.5 border-t border-gray-200 text-center relative" style={{ width: '60px', minWidth: '60px' }}>
        <button
          ref={(el) => { if (isOpen) activeButtonRef.current = el; }}
          onClick={(e) => {
            e.stopPropagation();
            activeButtonRef.current = e.currentTarget;
            setOpenMenuRow(isOpen ? null : rowKey);
          }}
          className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ActionDotsIcon />
        </button>
        {isOpen && mounted && (
          <ActionsMenu
            item={item}
            rowKey={rowKey}
            actions={actions}
            isRtl={isRtl}
            buttonRef={activeButtonRef}
            onClose={closeMenu}
          />
        )}
      </td>
    );
  };

  const actionsHeader = () => {
    if (!actions || actions.length === 0) return null;
    return (
      <th key="__actions__" className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap sticky top-0 z-10 bg-[#1a5632]" style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>
        {t('grid.actions')}
      </th>
    );
  };

  const actionsFilterCell = () => {
    if (!actions || actions.length === 0) return null;
    return <td key="__actions__" className="px-2 py-1" />;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-blue-600 hover:text-blue-800 text-sm font-medium">{t('common.retry')}</button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
        <p className="mt-4 text-gray-500 text-sm">{loadingMessage || t('common.loading')}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage || t('common.noData')}</p>
      </div>
    );
  }

  const hasActions = actions && actions.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm" dir={dir}>
      {(onGlobalSearch || onToggleFilters || onRefresh) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
          {onGlobalSearch && (
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <input
                type="text"
                value={globalSearch || ''}
                onChange={(e) => onGlobalSearch(e.target.value)}
                placeholder={searchPlaceholder || t('common.search')}
                className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
          {hasFilterableCols && onToggleFilters && (
            <button
              onClick={onToggleFilters}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FilterIcon active={showFilters || !!hasActiveFilters} />
              {t('grid.filter')}
              {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 inline-block" />}
            </button>
          )}
          {hasActiveFilters && onClearFilters && (
            <button onClick={onClearFilters} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
              {t('grid.clearFilters')}
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${refreshLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('grid.refresh')}
            </button>
          )}
        </div>
      )}

      <div className="admin-grid-wrapper">
        <table className="w-full border-collapse" style={{ minWidth: columns.length * 110 }}>
          <thead>
            <tr className="bg-[#1a5632] text-white">
              {isRtl && hasActions && actionsHeader()}
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col)}
                    className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider border-r border-[#2a6b42] last:border-r-0 whitespace-nowrap sticky top-0 z-10 bg-[#1a5632] ${
                      col.sortable ? 'cursor-pointer hover:bg-[#1e6b3a] select-none' : ''
                    }`}
                    style={{
                      textAlign: col.align || (isRtl ? 'right' : 'left'),
                      width: col.width,
                      minWidth: col.width,
                    }}
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {col.header}
                      {col.sortable && <SortIcon direction={isSorted ? sortDirection : null} />}
                      {col.filterable && <FilterIcon active={!!(filters?.[col.key])} />}
                    </span>
                  </th>
                );
              })}
              {!isRtl && hasActions && actionsHeader()}
            </tr>
            {showFilters && hasFilterableCols && (
              <tr className="bg-gray-50">
                {isRtl && hasActions && actionsFilterCell()}
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-1 border-r border-gray-200 last:border-r-0" style={{ width: col.width, minWidth: col.width }}>
                    {renderFilterInput(col)}
                  </td>
                ))}
                {!isRtl && hasActions && actionsFilterCell()}
              </tr>
            )}
          </thead>
          <tbody>
            {data.map((item, rowIndex) => {
              const rowKey = keyExtractor(item);
              const isSelected = selectedKey === rowKey;
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick?.(item)}
                  className={`${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${
                    isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : rowIndex % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                  } hover:bg-blue-50/60 transition-colors`}
                >
                  {isRtl && hasActions && actionsCell(item, rowKey)}
                  {columns.map((col) => {
                    const cellValue = (item as any)[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 text-sm border-t border-gray-200 whitespace-nowrap overflow-hidden text-ellipsis`}
                        style={{
                          textAlign: col.align || (isRtl ? 'right' : 'left'),
                          width: col.width,
                          minWidth: col.width,
                          maxWidth: col.width || '300px',
                        }}
                        title={typeof cellValue === 'string' ? cellValue : undefined}
                        dir={isRtl ? 'rtl' : 'ltr'}
                      >
                        {col.render ? col.render(item) : (cellValue ?? '-')}
                      </td>
                    );
                  })}
                  {!isRtl && hasActions && actionsCell(item, rowKey)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
