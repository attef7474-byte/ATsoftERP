'use client';
import { useTranslation } from '../../lib/i18n/use-translation';
import { translatePriority } from '../../lib/i18n/literals';

export function CmmsPriorityBadge({ priority }: { priority?: string | null }) {
  const { locale } = useTranslation();
  const p = priority || '';
  const colors: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-800',
    MEDIUM: 'bg-blue-100 text-blue-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };
  const color = colors[p] || 'bg-gray-100 text-gray-800';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>{translatePriority(p, locale)}</span>;
}
