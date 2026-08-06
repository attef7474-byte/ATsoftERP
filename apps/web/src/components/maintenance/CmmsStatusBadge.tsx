'use client';
import { useTranslation } from '../../lib/i18n/use-translation';
import { translateStatus } from '../../lib/i18n/literals';

export function CmmsStatusBadge({ status }: { status?: string | null }) {
  const { locale } = useTranslation();
  const s = status || '';
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-800',
    OPEN: 'bg-blue-100 text-blue-800',
    DRAFT: 'bg-gray-100 text-gray-800',
    PLANNED: 'bg-indigo-100 text-indigo-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    PENDING: 'bg-gray-100 text-gray-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    PARTIALLY_ISSUED: 'bg-orange-100 text-orange-800',
    FULLY_ISSUED: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    DONE: 'bg-green-100 text-green-800',
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    notDue: 'bg-blue-100 text-blue-800',
    overdue: 'bg-orange-100 text-orange-800',
  };
  const color = colors[s] || 'bg-gray-100 text-gray-800';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>{translateStatus(s, locale)}</span>;
}
