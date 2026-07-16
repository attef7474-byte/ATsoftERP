'use client';
import React from 'react';
import { Button } from '../admin/ui';
import { useTranslation } from '../../lib/i18n/use-translation';

interface ReportExportButtonProps {
  filename?: string;
  headers: string[];
  rows: Record<string, any>[];
  mapRow: (row: Record<string, any>) => string[];
}

export function ReportExportButton({ filename = 'report', headers, rows, mapRow }: ReportExportButtonProps) {
  const { t } = useTranslation();

  const handleExport = () => {
    const csvContent = [
      headers.join(','),
      ...rows.map(r => mapRow(r).map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="secondary" onClick={handleExport}>
      {t('reports.exportCurrentPage')}
    </Button>
  );
}
