'use client';

import { useTranslation } from '../../../lib/i18n/use-translation';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  const isActive = status === 'ACTIVE' || status === 'active';
  const label = t(`status.${status}` as any);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}
    >
      {label !== `status.${status}` ? label : status}
    </span>
  );
}
