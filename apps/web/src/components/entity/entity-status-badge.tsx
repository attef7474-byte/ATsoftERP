'use client';
import React from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { translateStatus } from '../../lib/i18n/literals';

interface EntityStatusBadgeProps {
  status: string;
  activeLabel?: string;
  inactiveLabel?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  DRAFT: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
  IN_PROGRESS: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  COMPLETED: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  SUSPENDED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
};

export function EntityStatusBadge({ status, activeLabel, inactiveLabel }: EntityStatusBadgeProps) {
  const { locale } = useTranslation();
  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  let label = translateStatus(status, locale);
  if (status === 'ACTIVE' && activeLabel) label = activeLabel;
  else if (status === 'INACTIVE' && inactiveLabel) label = inactiveLabel;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}
