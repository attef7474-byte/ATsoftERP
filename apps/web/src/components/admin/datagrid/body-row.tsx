'use client';

import React from 'react';
import type { MutableRefObject } from 'react';
import { ActionsCell } from './actions-menu';
import type { GridAction, GridColumn, GridRowTone } from './types';
import styles from './row-tone.module.css';

interface BodyRowProps<T> {
  item: T;
  rowIndex: number;
  rowKey: string;
  columns: GridColumn<T>[];
  actions?: GridAction<T>[];
  onRowClick?: (item: T) => void;
  selectedKey?: string;
  tone?: GridRowTone;
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
  tone = 'normal',
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

  const handleRowClick = (e: React.MouseEvent) => {
    // Row click guard: skip if clicking interactive elements
    const target = e.target as HTMLElement;
    if (target.closest?.('button, a, input, select, textarea, [role="button"], [data-no-row-open], .admin-grid-row-action-btn, [data-actions-menu]')) return;
    onRowClick?.(item);
  };

  return (
    <tr
      onClick={handleRowClick}
      data-row-tone={tone}
      data-row-selected={isSelected}
      data-row-parity={rowIndex % 2 === 1 ? 'odd' : 'even'}
      aria-selected={isSelected}
      className={`${styles.row} ${onRowClick ? 'cursor-pointer' : ''} transition-colors`}
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
