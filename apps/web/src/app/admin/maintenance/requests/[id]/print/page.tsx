'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { MaintenanceRequest, MaintenanceTask, DowntimeLog, MaintenanceRequestPartUsage, MaintenanceRequestCostEntry } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, StatusBadge, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../../components/admin/admin-action-bar';

interface PrintData extends MaintenanceRequest {
  tasks?: MaintenanceTask[];
  downtimeLogs?: DowntimeLog[];
  partsUsed?: MaintenanceRequestPartUsage[];
  costEntries?: MaintenanceRequestCostEntry[];
}

export default function RequestPrintPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const printRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<PrintData>(`/maintenance/requests/${id}/print`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    print: () => handlePrint(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, onClick: () => exec('print'), enabled: !!data },
  ]);

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div>
      <div className="mb-4 print:hidden">
        <Button onClick={handlePrint}>{t('common.print')}</Button>
      </div>

      <div ref={printRef} className="bg-white print:bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="text-center mb-8 border-b pb-4 print:border-gray-300">
          <h1 className="text-2xl font-bold text-gray-900">{t('maintenance.maintenanceRequest')}</h1>
          <p className="text-lg text-gray-600 mt-1">{data.requestNumber}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
          <PrintField label={t('details.maintenanceRequest.title')} value={data.title} />
          <PrintField label={t('common.status')} value={<StatusBadge status={data.status} />} />
          <PrintField label={t('details.maintenanceRequest.machine')} value={data.machine?.name || '-'} />
          <PrintField label={t('details.maintenanceRequest.type')} value={t('status.' + data.type)} />
          <PrintField label={t('details.maintenanceRequest.priority')} value={t('status.' + data.priority)} />
          <PrintField label={t('details.maintenanceRequest.requestedBy')} value={data.requestedBy?.name || '-'} />
          <PrintField label={t('details.maintenanceRequest.assignedTo')} value={data.assignedTo?.name || '-'} />
          <PrintField label={t('details.maintenanceRequest.estimatedCost')} value={data.estimatedCost != null ? data.estimatedCost.toLocaleString() : '-'} />
          <PrintField label={t('details.maintenanceRequest.actualCost')} value={data.actualCost != null ? data.actualCost.toLocaleString() : '-'} />
          <PrintField label={t('details.maintenanceRequest.downtimeHours')} value={data.downtimeHours != null ? String(data.downtimeHours) : '-'} />
          <PrintField label={t('details.maintenanceRequest.startedAt')} value={fmt(data.startedAt)} />
          <PrintField label={t('details.maintenanceRequest.completedAt')} value={fmt(data.completedAt)} />
          <PrintField label={t('common.createdAt')} value={fmt(data.createdAt)} />
          <PrintField label={t('common.updatedAt')} value={fmt(data.updatedAt)} />
        </div>

        {data.description && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1 print:border-gray-300">{t('common.description')}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.description}</p>
          </div>
        )}

        {data.tasks && data.tasks.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1 print:border-gray-300">{t('details.maintenanceRequest.tasks')}</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 print:bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('common.name')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.assignedTo')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.startedAt')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.completedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="border border-gray-300 px-3 py-2">{task.title}</td>
                    <td className="border border-gray-300 px-3 py-2">{task.status}</td>
                    <td className="border border-gray-300 px-3 py-2">{task.assignedTo?.name || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{fmt(task.startedAt)}</td>
                    <td className="border border-gray-300 px-3 py-2">{fmt(task.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.partsUsed && data.partsUsed.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1 print:border-gray-300">{t('maintenanceWorkflow.workflowParts')}</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 print:bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('common.name')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.quantity')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.unitCost')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.totalCost')}</th>
                </tr>
              </thead>
              <tbody>
                {data.partsUsed.map((part) => (
                  <tr key={part.id}>
                    <td className="border border-gray-300 px-3 py-2">{part.product?.name || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{part.quantity}</td>
                    <td className="border border-gray-300 px-3 py-2">{part.unitCost != null ? part.unitCost.toLocaleString() : '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{part.totalCost != null ? part.totalCost.toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.costEntries && data.costEntries.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1 print:border-gray-300">{t('maintenanceWorkflow.workflowCosts')}</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 print:bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.type')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('common.description')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.amount')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.incurredAt')}</th>
                </tr>
              </thead>
              <tbody>
                {data.costEntries.map((cost) => (
                  <tr key={cost.id}>
                    <td className="border border-gray-300 px-3 py-2">{cost.type}</td>
                    <td className="border border-gray-300 px-3 py-2">{cost.description || '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{cost.amount != null ? cost.amount.toLocaleString() : '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{fmt(cost.incurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.downtimeLogs && data.downtimeLogs.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1 print:border-gray-300">{t('details.maintenanceRequest.downtimeLogs')}</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 print:bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.reason')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.startTime')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.endTime')}</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('maintenance.durationHours')}</th>
                </tr>
              </thead>
              <tbody>
                {data.downtimeLogs.map((downtime) => (
                  <tr key={downtime.id}>
                    <td className="border border-gray-300 px-3 py-2">{downtime.reason}</td>
                    <td className="border border-gray-300 px-3 py-2">{fmt(downtime.startTime)}</td>
                    <td className="border border-gray-300 px-3 py-2">{downtime.endTime ? fmt(downtime.endTime) : '-'}</td>
                    <td className="border border-gray-300 px-3 py-2">{downtime.durationHours ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 mt-12 pt-4 border-t print:border-gray-300">
          {t('common.printedOn')}: {new Date().toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function PrintField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
