'use client';

import React from 'react';
import type { MutableRefObject } from 'react';
import { ActionsCell } from './actions-menu';
import type { GridAction, GridColumn } from './types';

interface BodyRowProps<T> {
  item: T;
  rowIndex: number;
  rowKey: string;
  columns: GridColumn<T>[];
  actions?: GridAction<T>[];
  onRowClick?: (item: T) => void;
  selectedKey?: string;
  isRtl: boolean;
  openMenuRow: string | null;
  mounted: boolean;
  activeButtonRef: MutableRefObject<HTMLButtonElement | null>;
  onToggleMenu: (rowKey: string, isOpen: boolean) => void;
  onCloseMenu: () => void;
}

export function BodyRow<T>({
  item,
  rowIndex,
  rowKey,
  columns,
  actions,
  onRowClick,
  selectedKey,
  isRtl,
  openMenuRow,
  mounted,
  activeButtonRef,
  onToggleMenu,
  onCloseMenu,
}: BodyRowProps<T>) {
  const isSelected = selectedKey === rowKey;
  const actionCell = actions && actions.length > 0 ? (
    <ActionsCell
      item={item}
      rowKey={rowKey}
      actions={actions}
      isOpen={openMenuRow === rowKey}
      isRtl={isRtl}
      mounted={mounted}
      activeButtonRef={activeButtonRef}
      onToggle={onToggleMenu}
      onClose={onCloseMenu}
    />
  ) : null;

  return (
    <tr
      onClick={() => onRowClick?.(item)}
      className={`${
        onRowClick ? 'cursor-pointer' : ''
      } ${
        isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : rowIndex % 2 === 1 ? 'bg-gray-50' : 'bg-white'
      } hover:bg-blue-50/60 transition-colors`}
    >
      {isRtl && actionCell}
      {columns.map((column) => {
        const cellValue = (item as any)[column.key];
        return (
          <td
            key={column.key}
            className="px-3 py-2.5 text-sm border-t border-gray-200 whitespace-nowrap overflow-hidden text-ellipsis"
            style={{
              textAlign: column.align || (isRtl ? 'right' : 'left'),
              width: column.width,
              minWidth: column.width,
              maxWidth: column.width || '300px',
            }}
            title={typeof cellValue === 'string' ? cellValue : undefined}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {column.render ? column.render(item) : (cellValue ?? '-')}
          </td>
        );
      })}
      {!isRtl && actionCell}
    </tr>
  );
}
