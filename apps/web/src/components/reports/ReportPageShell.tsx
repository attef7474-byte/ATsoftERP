'use client';
import React from 'react';
import { Card, CardContent, LoadingState, ErrorState, EmptyState } from '../admin/ui';
import { useTranslation } from '../../lib/i18n/use-translation';

interface ReportPageShellProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  filters?: React.ReactNode;
}

export function ReportPageShell({ title, description, loading, error, empty, emptyMessage, onRetry, children, filters }: ReportPageShellProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {filters && <Card><CardContent>{filters}</CardContent></Card>}
      {loading ? <LoadingState message={t('reports.loading')} /> :
       error ? <ErrorState message={error} onRetry={onRetry} /> :
       empty ? <EmptyState message={emptyMessage || t('reports.noData')} /> :
       children}
    </div>
  );
}
