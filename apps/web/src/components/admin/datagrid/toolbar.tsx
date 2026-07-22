'use client';

import React from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { FilterIcon } from './filters';

interface DataGridToolbarProps {
  globalSearch?: string;
  onGlobalSearch?: (value: string) => void;
  searchPlaceholder?: string;
  hasFilterableColumns: boolean;
  hasActiveFilters: boolean;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  onClearFilters?: () => void;
  onRefresh?: () => void;
  refreshLoading?: boolean;
}

export function DataGridToolbar({
  globalSearch,
  onGlobalSearch,
  searchPlaceholder,
  hasFilterableColumns,
  hasActiveFilters,
  showFilters,
  onToggleFilters,
  onClearFilters,
  onRefresh,
  refreshLoading,
}: DataGridToolbarProps) {
  const { t } = useTranslation();

  if (!onGlobalSearch && !onToggleFilters && !onRefresh) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
      {onGlobalSearch && (
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <input
            type="text"
            value={globalSearch || ''}
            onChange={(event) => onGlobalSearch(event.target.value)}
            placeholder={searchPlaceholder || t('common.search')}
            className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}
      {hasFilterableColumns && onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FilterIcon active={showFilters || hasActiveFilters} />
          {t('grid.filter')}
          {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 inline-block" />}
        </button>
      )}
      {hasActiveFilters && onClearFilters && (
        <button type="button" onClick={onClearFilters} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
          {t('grid.clearFilters')}
        </button>
      )}
      {onRefresh && (
        <button
          type="button"
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
  );
}
