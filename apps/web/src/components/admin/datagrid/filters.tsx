import React from 'react';
import type { GridColumn } from './types';

export function FilterIcon({ active }: { active?: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 inline-block ms-1 ${active ? 'text-blue-400' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

interface FilterCellProps<T> {
  column: GridColumn<T>;
  value: string;
  allLabel: string;
  onFilter?: (column: string, value: string) => void;
}

export function FilterCell<T>({ column, value, allLabel, onFilter }: FilterCellProps<T>) {
  if (!column.filterable) return null;

  if (column.filterType === 'select' && column.filterOptions) {
    return (
      <select
        value={value}
        onChange={(event) => onFilter?.(column.key, event.target.value)}
        className="w-full text-[11px] border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        onClick={(event) => event.stopPropagation()}
      >
        <option value="">{allLabel}</option>
        {column.filterOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={column.filterType === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(event) => onFilter?.(column.key, event.target.value)}
      placeholder="..."
      className="w-full text-[11px] border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      onClick={(event) => event.stopPropagation()}
    />
  );
}

export function ActionsFilterCell() {
  return <td className="px-2 py-1" />;
}
