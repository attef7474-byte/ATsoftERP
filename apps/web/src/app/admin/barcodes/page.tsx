'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { Button, Card, CardContent, CardHeader, PageHeader, StatusBadge } from '../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../components/admin/admin-action-bar';
import { BarcodeLabel, BarcodeScanEvent, BarcodeLabelTemplate, BarcodePrintJob } from '../../../lib/admin-types';

interface SummaryCard {
  label: string;
  value: string | number;
  icon?: string;
}

function SummaryCards({ cards, loading }: { cards: SummaryCard[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent>
              <div className="animate-pulse h-4 w-20 bg-gray-200 rounded mb-2" />
              <div className="animate-pulse h-8 w-16 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentTable({ title, headers, rows, loading }: { title: string; headers: string[]; rows: React.ReactNode[][]; loading: boolean }) {
  return (
    <Card>
      <CardHeader><h3 className="text-lg font-semibold">{title}</h3></CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-4 bg-gray-200 rounded w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-3 text-sm">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BarcodesOverviewPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [totalLabels, setTotalLabels] = useState(0);
  const [totalScans, setTotalScans] = useState(0);
  const [totalPrintJobs, setTotalPrintJobs] = useState(0);
  const [activeTemplates, setActiveTemplates] = useState(0);
  const [recentLabels, setRecentLabels] = useState<BarcodeLabel[]>([]);
  const [recentScans, setRecentScans] = useState<BarcodeScanEvent[]>([]);
  const [recentPrintJobs, setRecentPrintJobs] = useState<BarcodePrintJob[]>([]);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [labelsRes, scansRes, printJobsRes, templatesRes] = await Promise.all([
        api.get<{ data: BarcodeLabel[]; meta: { total: number } }>('/barcodes/labels', { params: { limit: '5', page: '1' } }).catch(() => null),
        api.get<{ data: BarcodeScanEvent[]; meta: { total: number } }>('/barcodes/scans', { params: { limit: '5', page: '1' } }).catch(() => null),
        api.get<{ total?: number; data?: any[] }>('/barcodes/print-jobs/summary').catch(() => null),
        api.get<{ data: BarcodeLabelTemplate[] }>('/barcodes/templates').catch(() => null),
      ]);
      setTotalLabels(labelsRes?.meta?.total ?? 0);
      setRecentLabels(labelsRes?.data?.slice(0, 5) ?? []);
      setTotalScans(scansRes?.meta?.total ?? 0);
      setRecentScans(scansRes?.data?.slice(0, 5) ?? []);
      setTotalPrintJobs(printJobsRes?.total ?? 0);
      setRecentPrintJobs((printJobsRes?.data ?? []).slice(0, 5));
      setActiveTemplates(templatesRes?.data?.length ?? 0);
    } catch {
      setError(t('common.error'));
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRegisterAdminActions([
    {
      id: 'refresh', labelKey: 'common.refresh',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      onClick: fetchData,
    },
  ]);

  const summaryCards: SummaryCard[] = [
    { label: t('barcodes.overview.totalLabels'), value: totalLabels },
    { label: t('barcodes.overview.totalScans'), value: totalScans },
    { label: t('barcodes.overview.totalPrintJobs'), value: totalPrintJobs },
    { label: t('barcodes.overview.activeTemplates'), value: activeTemplates },
  ];

  const labelHeaders = [t('barcodes.labelCode'), t('barcodes.labelValue'), t('common.status')];
  const labelRows = recentLabels.map((l) => [l.code, l.value, <StatusBadge key={l.id} status={l.status} />]);

  const scanHeaders = [t('barcodes.scannedValue'), t('barcodes.scanResult'), t('barcodes.scannedAt')];
  const scanRows = recentScans.map((s) => [s.scannedValue, <StatusBadge key={s.id} status={s.result} />, s.scannedAt ? new Date(s.scannedAt).toLocaleString() : '-']);

  const printJobHeaders = ['Job ID', t('barcodes.labelCode'), t('common.status')];
  const printJobRows = recentPrintJobs.map((j: any) => [j.id?.slice(0, 8) ?? '-', j.labelCode ?? '-', <StatusBadge key={j.id} status={j.status} />]);

  const quickActions = [
    { label: t('barcodes.generate.title'), href: '/admin/barcodes/generate', icon: '+' },
    { label: t('barcodes.print.title'), href: '/admin/barcodes/print', icon: '\u{1F5A8}' },
    { label: t('barcodes.scan.title'), href: '/admin/barcodes/scan', icon: '\u{1F50D}' },
    { label: t('barcodes.records.title'), href: '/admin/barcodes/records', icon: '\u{1F4CB}' },
    { label: t('barcodes.templates'), href: '/admin/barcodes/templates', icon: '\u{1F4C4}' },
    { label: t('barcodes.productLabels'), href: '/admin/barcodes/generate?entityType=PRODUCT', icon: '\u{1F4E6}' },
    { label: t('barcodes.machineCards'), href: '/admin/barcodes/generate?entityType=MACHINE', icon: '\u{2699}' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.overview.title')} subtitle={t('barcodes.overview.subtitle')} />

      {error && (
        <Card>
          <CardContent>
            <p className="text-red-600 text-sm">{error}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={fetchData}>{t('common.retry')}</Button>
          </CardContent>
        </Card>
      )}

      <SummaryCards cards={summaryCards} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RecentTable title={t('barcodes.overview.recentLabels')} headers={labelHeaders} rows={labelRows} loading={loading} />
        <RecentTable title={t('barcodes.overview.recentScans')} headers={scanHeaders} rows={scanRows} loading={loading} />
        <RecentTable title={t('barcodes.overview.recentPrintJobs')} headers={printJobHeaders} rows={printJobRows} loading={loading} />
      </div>

      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('barcodes.overview.quickActions')}</h3></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href}
                className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-center">
                <span className="text-xl mb-1">{action.icon}</span>
                <span className="text-xs text-gray-600 font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
