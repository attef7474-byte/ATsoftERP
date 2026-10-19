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

const ARCHIVED_KEY_PREFIX = 'archived::';

function archivedKey(context: Parameters<typeof getOperationalContextKey>[0]): string {
  return `${ARCHIVED_KEY_PREFIX}${getOperationalContextKey(context)}`;
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
    archivedContexts,
    archivedContext,
    isArchivedContext,
    canArchiveBrowse,
    enterArchiveMode,
    exitArchiveMode,
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
    if (isArchivedContext && archivedContext) {
      setSelectedKey(archivedKey(archivedContext));
      return;
    }
    setSelectedKey(
      activeContext
        ? getOperationalContextKey(activeContext)
        : allowedContexts.length === 1
          ? getOperationalContextKey(allowedContexts[0])
          : '',
    );
  }, [activeContext, allowedContexts, archivedContext, isArchivedContext, open]);

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
  const selectedArchivedContext = archivedContexts.find(
    (context) => archivedKey(context) === selectedKey,
  );

  const handleConfirm = async () => {
    if (selectedArchivedContext) {
      setSelectionFailed(false);
      try {
        await enterArchiveMode(selectedArchivedContext, { reload: true });
      } catch {
        setSelectionFailed(true);
      }
      return;
    }
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

          {canArchiveBrowse && (
            <div className="mt-6 border-t border-dashed border-amber-300 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">
                    {t('auth.context.archivedTitle')}
                  </h3>
                  <p className="mt-0.5 text-xs text-amber-800">
                    {t('auth.context.archivedHint')}
                  </p>
                </div>
                {isArchivedContext && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900">
                    {t('auth.context.archivedCurrent')}
                  </span>
                )}
              </div>

              <div
                className="mt-3 grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t('auth.context.archivedTitle')}
              >
                {archivedContexts.length === 0 && (
                  <p className="text-sm text-amber-800 sm:col-span-2">
                    {t('auth.context.archivedEmpty')}
                  </p>
                )}
                {archivedContexts.map((context) => {
                  const key = archivedKey(context);
                  const selected = selectedKey === key;
                  const current = isArchivedContext && isSameOperationalContext(archivedContext, context);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedKey(key)}
                      className={[
                        'flex min-h-20 items-start justify-between gap-3 rounded-lg border px-4 py-3 text-start transition-colors',
                        selected
                          ? 'border-amber-500 bg-amber-50 text-amber-950'
                          : 'border-amber-200 bg-white text-gray-800 hover:border-amber-300 hover:bg-amber-50/50',
                      ].join(' ')}
                    >
                      <ContextChip context={context} />
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900">
                          {t('auth.context.archivedBadge')}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
                          {t('auth.context.archivedReadOnlyBadge')}
                        </span>
                        {current && (
                          <span className="rounded-full bg-amber-500 px-2 py-1 text-[11px] font-medium text-white">
                            {t('auth.context.archivedCurrent')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(selectionFailed || contextError) && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t('auth.context.validationError')}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4">
          {isArchivedContext && (
            <>
              <button
                type="button"
                onClick={() => void exitArchiveMode({ reload: true })}
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                {t('auth.context.exitArchived')}
              </button>
              <div className="flex-1" />
            </>
          )}
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
            disabled={(!selectedContext && !selectedArchivedContext) || contextLoading}
            onClick={() => void handleConfirm()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {contextLoading
              ? t('common.loading')
              : selectedArchivedContext
                ? t('auth.context.enterArchived')
                : t('auth.context.confirm')}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
