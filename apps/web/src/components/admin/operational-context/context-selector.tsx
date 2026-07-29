'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOperationalContext } from '../../../lib/auth-context';
import {
  getOperationalContextKey,
  isSameOperationalContext,
} from '../../../lib/operational-context';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { ContextChip } from './context-chip';

interface ContextSelectorProps {
  open: boolean;
  required?: boolean;
  reloadAfterSelect?: boolean;
  onClose?: () => void;
}

export function ContextSelector({
  open,
  required = false,
  reloadAfterSelect = false,
  onClose,
}: ContextSelectorProps) {
  const { t, dir } = useTranslation();
  const {
    allowedContexts,
    activeContext,
    contextLoading,
    contextError,
    selectContext,
  } = useOperationalContext();
  const initialKey = useMemo(
    () => activeContext ? getOperationalContextKey(activeContext) : '',
    [activeContext],
  );
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [selectionFailed, setSelectionFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectionFailed(false);
    setSelectedKey(
      activeContext
        ? getOperationalContextKey(activeContext)
        : allowedContexts.length === 1
          ? getOperationalContextKey(allowedContexts[0])
          : '',
    );
  }, [activeContext, allowedContexts, open]);

  useEffect(() => {
    if (!open || required) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, open, required]);

  if (!open || typeof document === 'undefined') return null;

  const selectedContext = allowedContexts.find(
    (context) => getOperationalContextKey(context) === selectedKey,
  );

  const handleConfirm = async () => {
    if (!selectedContext) return;
    setSelectionFailed(false);
    try {
      await selectContext(selectedContext, { reload: reloadAfterSelect });
      if (!reloadAfterSelect) onClose?.();
    } catch {
      setSelectionFailed(true);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir={dir}>
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-gray-950/50"
        aria-label={t('auth.context.close')}
        onClick={required ? undefined : onClose}
        tabIndex={-1}
      />
      <section
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operational-context-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="operational-context-title" className="text-lg font-semibold text-gray-900">
              {t('auth.context.title')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {required ? t('auth.context.requiredHint') : t('auth.context.switchHint')}
            </p>
          </div>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label={t('auth.context.close')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
            {allowedContexts.map((context) => {
              const key = getOperationalContextKey(context);
              const selected = selectedKey === key;
              const current = isSameOperationalContext(activeContext, context);
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedKey(key)}
                  className={[
                    'flex min-h-20 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-start transition-colors',
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-950'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <ContextChip context={context} />
                  {current && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
                      {t('auth.context.current')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {(selectionFailed || contextError) && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t('auth.context.validationError')}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4">
          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="button"
            disabled={!selectedContext || contextLoading}
            onClick={() => void handleConfirm()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {contextLoading ? t('common.loading') : t('auth.context.confirm')}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
