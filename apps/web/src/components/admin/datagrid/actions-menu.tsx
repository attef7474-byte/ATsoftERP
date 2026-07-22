'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type { GridAction } from './types';

const MENU_WIDTH = 176;
const VIEWPORT_MARGIN = 8;
const MENU_GAP = 4;
const MENU_Z_INDEX = 100;

function ActionDotsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

interface ActionsMenuProps<T> {
  item: T;
  actions: GridAction<T>[];
  isRtl: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export function ActionsMenu<T>({ item, actions, isRtl, buttonRef, onClose }: ActionsMenuProps<T>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: MENU_Z_INDEX,
    visibility: 'hidden',
  });

  useEffect(() => {
    const updatePosition = () => {
      if (!buttonRef.current) return;

      const anchorRect = buttonRef.current.getBoundingClientRect();
      const measuredMenu = menuRef.current?.getBoundingClientRect();
      const menuWidth = measuredMenu?.width || MENU_WIDTH;
      const maxMenuHeight = Math.max(0, window.innerHeight - (VIEWPORT_MARGIN * 2));
      const menuHeight = Math.min(measuredMenu?.height || 200, maxMenuHeight);

      let left = isRtl ? anchorRect.left : anchorRect.right - menuWidth;
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - menuWidth - VIEWPORT_MARGIN);
      left = Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft);

      let top = anchorRect.bottom + MENU_GAP;
      if (top + menuHeight > window.innerHeight - VIEWPORT_MARGIN) {
        top = anchorRect.top - MENU_GAP - menuHeight;
      }
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - menuHeight - VIEWPORT_MARGIN);
      top = Math.min(Math.max(top, VIEWPORT_MARGIN), maxTop);

      setStyle({
        position: 'fixed',
        top,
        left,
        zIndex: MENU_Z_INDEX,
        visibility: 'visible',
        maxWidth: Math.max(0, window.innerWidth - (VIEWPORT_MARGIN * 2)),
        maxHeight: maxMenuHeight,
        overflowY: 'auto',
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [buttonRef, isRtl, onClose]);

  return createPortal(
    <div
      ref={menuRef}
      data-actions-menu="true"
      style={style}
      className="w-44 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 border border-gray-200 py-1"
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action, actionIndex) => {
        const enabled = typeof action.enabled === 'function'
          ? action.enabled(item)
          : action.enabled !== false;

        return (
          <button
            key={actionIndex}
            type="button"
            onClick={() => {
              if (!enabled) return;
              try {
                action.onClick(item);
              } finally {
                onClose();
              }
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
    document.body,
  );
}

interface ActionsCellProps<T> {
  item: T;
  rowKey: string;
  actions: GridAction<T>[];
  isOpen: boolean;
  isRtl: boolean;
  mounted: boolean;
  activeButtonRef: MutableRefObject<HTMLButtonElement | null>;
  onToggle: (rowKey: string, isOpen: boolean) => void;
  onClose: () => void;
}

export function ActionsCell<T>({
  item,
  rowKey,
  actions,
  isOpen,
  isRtl,
  mounted,
  activeButtonRef,
  onToggle,
  onClose,
}: ActionsCellProps<T>) {
  return (
    <td
      className="px-2 py-2.5 border-t border-gray-200 text-center relative"
      style={{ width: '60px', minWidth: '60px' }}
    >
      <button
        ref={(element) => {
          if (isOpen) activeButtonRef.current = element;
        }}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          activeButtonRef.current = event.currentTarget;
          onToggle(rowKey, isOpen);
        }}
        className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ActionDotsIcon />
      </button>
      {isOpen && mounted && (
        <ActionsMenu
          item={item}
          actions={actions}
          isRtl={isRtl}
          buttonRef={activeButtonRef}
          onClose={onClose}
        />
      )}
    </td>
  );
}

export function ActionsHeader({ label }: { label: string }) {
  return (
    <th
      className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap sticky top-0 z-10 bg-[#1a5632]"
      style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}
    >
      {label}
    </th>
  );
}
