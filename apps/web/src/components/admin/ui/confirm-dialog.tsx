'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import {
  CONFIRM_DIALOG_FOCUSABLE_SELECTOR,
  FocusableLike,
  collectFocusable,
  resolveInitialFocus,
  resolveTabTarget,
  shouldCloseOnEscape,
} from './confirm-dialog-focus';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  children?: React.ReactNode;
}

function visibleFocusable(element: FocusableLike): boolean {
  const active = document.activeElement as unknown as FocusableLike | null;
  return (element as HTMLElement).offsetParent !== null || element === active;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, cancelLabel, variant = 'danger', loading, children }: ConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openerRef.current = opener;
    const node = dialogRef.current;
    if (node) {
      const focusable = collectFocusable(node, visibleFocusable);
      resolveInitialFocus(focusable, node).focus();
    }
    return () => {
      const restore = openerRef.current;
      openerRef.current = null;
      if (restore && typeof restore.focus === 'function' && document.contains(restore)) {
        restore.focus();
      }
    };
  }, [open]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (!shouldCloseOnEscape(loading)) return;
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const node = dialogRef.current;
    if (!node) return;
    const focusable = collectFocusable(node, visibleFocusable);
    const resolution = resolveTabTarget({
      focusable,
      active: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      container: node,
      shiftKey: event.shiftKey,
    });
    if (resolution.kind === 'focus') {
      event.preventDefault();
      resolution.target.focus();
    } else if (focusable.length === 0) {
      event.preventDefault();
      node.focus();
    }
  }, [loading, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
      >
        <h3 id={titleId} className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        {children}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{cancelLabel || 'Cancel'}</button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`px-4 py-2 text-sm text-white rounded-lg ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}>
            {loading ? '...' : confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { CONFIRM_DIALOG_FOCUSABLE_SELECTOR };
export type { FocusableLike };
