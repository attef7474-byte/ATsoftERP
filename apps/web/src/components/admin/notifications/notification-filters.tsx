'use client';
import React from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';

interface NotificationFiltersProps {
  type?: string;
  read?: string;
  onTypeChange: (type: string) => void;
  onReadChange: (read: string) => void;
}

export function NotificationFilters({ type, read, onTypeChange, onReadChange }: NotificationFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={type || ''}
        onChange={(e) => onTypeChange(e.target.value)}
        className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
      >
        <option value="">{t('common.all')} Types</option>
        <option value="INFO">{t('notifications.INFO')}</option>
        <option value="WARNING">{t('notifications.WARNING')}</option>
        <option value="ERROR">{t('notifications.ERROR')}</option>
        <option value="SUCCESS">{t('notifications.SUCCESS')}</option>
      </select>
      <select
        value={read ?? ''}
        onChange={(e) => onReadChange(e.target.value)}
        className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white"
      >
        <option value="">{t('common.all')}</option>
        <option value="false">{t('notifications.unread')}</option>
        <option value="true">{t('notifications.read')}</option>
      </select>
    </div>
  );
}
