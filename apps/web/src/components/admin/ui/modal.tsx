'use client';

import React, { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Reusable stacking support: the canonical Modal may nest (e.g. a "create cost
// center" modal opened from inside a "machine" modal). Each open Modal is pushed
// onto a module-level stack; only the TOPMOST modal owns the document-level
// Escape and focus-trap handlers. Closing the topmost modal leaves the modal
// below it open and restores its interactive state. A lone modal is always the
// topmost, so existing single-modal behavior is unchanged.
const openModals: number[] = [];
let modalSeq = 0;

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useRef<string>(`modal-title-${Math.random().toString(36).slice(2, 8)}`);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalIdRef = useRef<number | null>(null);

  const isTopmost = () => {
    const id = modalIdRef.current;
    return id !== null && openModals.length > 0 && openModals[openModals.length - 1] === id;
  };

  useEffect(() => {
    if (!open) return undefined;
    const id = ++modalSeq;
    modalIdRef.current = id;
    openModals.push(id);
    return () => {
      const idx = openModals.lastIndexOf(id);
      if (idx !== -1) openModals.splice(idx, 1);
      if (modalIdRef.current === id) modalIdRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    const captureFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || typeof target.focus !== 'function') return;
      if (target === document.body) return;
      if (target.closest('[role="dialog"]')) return;
      previousFocusRef.current = target;
    };
    document.addEventListener('focusin', captureFocus, true);
    return () => document.removeEventListener('focusin', captureFocus, true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const focusFirst = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, button:not([aria-label]), [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? dialog).focus();
    };

    focusFirst();

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only the topmost open Modal may act on Escape/Tab; a nested modal below
      // it must not close or steal the focus trap when the topmost one closes.
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const previous = previousFocusRef.current;
      if (previous && previous.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  const sizes: Record<string, string> = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => onCloseRef.current()} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        tabIndex={-1}
        className={`relative bg-white rounded-xl shadow-xl w-full ${sizes[size]} mx-4 max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200" data-form-header>
          <h2 id={titleId.current} className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={() => onCloseRef.current()} aria-label={title} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
