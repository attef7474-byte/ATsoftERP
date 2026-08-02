'use client';
import { useTranslation } from '../../lib/i18n/use-translation';

const LIFE_VARIANTS: Record<string, string> = {
  UNKNOWN: 'bg-gray-100 text-gray-700',
  NORMAL: 'bg-green-100 text-green-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  DUE: 'bg-orange-100 text-orange-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

const LIFE_KEY: Record<string, string> = {
  UNKNOWN: 'maintenance.lifeStatusUnknown',
  NORMAL: 'maintenance.lifeStatusNormal',
  WARNING: 'maintenance.lifeStatusWarning',
  DUE: 'maintenance.lifeStatusDue',
  EXPIRED: 'maintenance.lifeStatusExpired',
};

export function LifeStatusBadge({ status }: { status?: string | null }) {
  const { t } = useTranslation();
  const key = LIFE_KEY[status || ''] || 'maintenance.lifeStatusUnknown';
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${LIFE_VARIANTS[status || ''] || LIFE_VARIANTS.UNKNOWN}`}>
      {t(key)}
    </span>
  );
}
