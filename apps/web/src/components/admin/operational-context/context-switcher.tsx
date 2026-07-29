'use client';

import { useState } from 'react';
import { useOperationalContext } from '../../../lib/auth-context';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { ContextChip } from './context-chip';
import { ContextSelector } from './context-selector';

export function ContextSwitcher() {
  const { t } = useTranslation();
  const { activeContext, allowedContexts } = useOperationalContext();
  const [open, setOpen] = useState(false);

  if (!activeContext) return null;

  const canSwitch = allowedContexts.length > 1;
  return (
    <>
      <button
        type="button"
        onClick={() => canSwitch && setOpen(true)}
        disabled={!canSwitch}
        className="flex min-w-0 max-w-[18rem] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-gray-800 hover:bg-gray-100 disabled:cursor-default disabled:opacity-90"
        title={canSwitch ? t('auth.context.switch') : t('auth.context.current')}
        aria-label={canSwitch ? t('auth.context.switch') : t('auth.context.current')}
      >
        <ContextChip context={activeContext} />
        {canSwitch && (
          <svg
            className="h-4 w-4 shrink-0 opacity-60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        )}
      </button>
      <ContextSelector
        open={open}
        reloadAfterSelect
        onClose={() => setOpen(false)}
      />
    </>
  );
}
