'use client';

import React from 'react';

interface ToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  onRefresh: () => void;
  onCreate?: () => void;
  createLabel?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  extraActions?: React.ReactNode;
}

export function Toolbar({
  searchValue, onSearchChange, onClear, onRefresh, onCreate, createLabel, searchPlaceholder, loading, extraActions,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder || 'Search...'}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      {searchValue && (
        <button onClick={onClear} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
      )}
      <button onClick={onRefresh} disabled={loading} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
        {loading ? '...' : 'Refresh'}
      </button>
      {onCreate && (
        <button onClick={onCreate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {createLabel || 'New'}
        </button>
      )}
      {extraActions}
    </div>
  );
}
