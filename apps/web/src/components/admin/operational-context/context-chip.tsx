'use client';

import type { OperationalContext } from '../../../lib/operational-context';
import { getOperationalContextEntityLabel } from '../../../lib/operational-context';
import { useTranslation } from '../../../lib/i18n/use-translation';

interface ContextChipProps {
  context: OperationalContext;
  compact?: boolean;
}

export function ContextChip({ context, compact = false }: ContextChipProps) {
  const { locale, t } = useTranslation();
  const company = getOperationalContextEntityLabel(context, 'company', locale)
    ?? t('common.unavailable');
  const branch = getOperationalContextEntityLabel(context, 'branch', locale);
  const administration = getOperationalContextEntityLabel(context, 'administration', locale);
  const department = getOperationalContextEntityLabel(context, 'department', locale);
  const fullPath = [company, branch, administration, department].filter(Boolean).join(' / ');

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={fullPath}>
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1M9 14h1m4 0h1M9 18h1m4 0h1"
        />
      </svg>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{company}</span>
        {!compact && branch && (
          <span className="block truncate text-[11px] opacity-75">{branch}</span>
        )}
      </span>
    </span>
  );
}
