import React from 'react';
import { FilterIcon } from './filters';
import type { GridColumn } from './types';

function SortIcon({ direction }: { direction?: 'asc' | 'desc' | null }) {
  if (!direction) {
    return <svg className="w-3.5 h-3.5 opacity-30 inline-block ms-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
  }
  if (direction === 'asc') {
    return <svg className="w-3.5 h-3.5 inline-block ms-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
  }
  return <svg className="w-3.5 h-3.5 inline-block ms-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
}

interface HeaderCellProps<T> {
  column: GridColumn<T>;
  isRtl: boolean;
  isSorted: boolean;
  sortDirection?: 'asc' | 'desc';
  filterActive: boolean;
  onClick: (column: GridColumn<T>) => void;
}

export function HeaderCell<T>({
  column,
  isRtl,
  isSorted,
  sortDirection,
  filterActive,
  onClick,
}: HeaderCellProps<T>) {
  return (
    <th
      onClick={() => onClick(column)}
      className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider border-r border-[#2a6b42] last:border-r-0 whitespace-nowrap sticky top-0 z-10 bg-[#1a5632] ${
        column.sortable ? 'cursor-pointer hover:bg-[#1e6b3a] select-none' : ''
      }`}
      style={{
        textAlign: column.align || (isRtl ? 'right' : 'left'),
        width: column.width,
        minWidth: column.width,
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <span className="inline-flex items-center gap-0.5">
        {column.header}
        {column.sortable && <SortIcon direction={isSorted ? sortDirection : null} />}
        {column.filterable && <FilterIcon active={filterActive} />}
      </span>
    </th>
  );
}
