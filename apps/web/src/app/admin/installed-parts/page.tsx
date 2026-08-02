'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { LocalizedValue, PageHeader } from '../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../components/admin/admin-data-grid';
import { LifeStatusBadge } from '../../../components/maintenance/life-status-badge';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionRecalculateIcon } from '../../../components/admin/admin-action-bar';
import { useApiErrorHandler } from '../../../components/admin/error-handler';
import { MachineInstalledPart } from '../../../lib/admin-types';

export default function InstalledPartsPage() {
  const { t, dir } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const [data, setData] = useState<MachineInstalledPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [evaluating, setEvaluating] = useState(false);

  const { exec } = useStableHandlers({ refresh: () => fetchData(), evaluate: () => evaluateAll() });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'evaluate', labelKey: 'maintenance.evaluateAllParts', icon: <ActionRecalculateIcon />, onClick: () => exec('evaluate'), enabled: !evaluating },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<MachineInstalledPart[]>('/installed-parts');
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const evaluateAll = useCallback(async () => {
    setEvaluating(true);
    try {
      const res = await api.post<{ evaluated: number }>('/installed-parts/evaluate-expected-life');
      showToast(`${t('maintenance.partsEvaluated')}: ${res?.evaluated ?? 0}`, 'success');
      fetchData();
    } catch (err: any) { handleApiError(err); }
    finally { setEvaluating(false); }
  }, [t, fetchData, handleApiError, showToast]);

  const visibleData = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return data;
    return data.filter((part) => [
      part.machine?.name,
      part.machine?.code,
      part.sparePart?.name,
      part.sparePart?.code,
      part.machineComponent?.name,
      part.maintenanceRequest?.requestNumber,
      part.installedCondition,
      part.life?.lifeStatus,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [data, search]);

  const columns: GridColumn<MachineInstalledPart>[] = [
    { key: 'machine', header: t('maintenance.machine'), render: (p: MachineInstalledPart) => p.machine?.name || '-' },
    { key: 'sparePart', header: t('maintenance.sparePartLabel'), render: (p: MachineInstalledPart) => p.sparePart?.name || '-' },
    { key: 'installedQuantity', header: t('common.quantity'), render: (p: MachineInstalledPart) => p.installedQuantity },
    { key: 'installedCondition', header: t('maintenance.condition'), render: (p: MachineInstalledPart) => <LocalizedValue value={p.installedCondition} /> },
    { key: 'component', header: t('maintenance.machineComponent'), render: (p: MachineInstalledPart) => p.machineComponent?.name || '-' },
    { key: 'life', header: t('maintenance.lifeStatus'), render: (p: MachineInstalledPart) => <LifeStatusBadge status={p.life?.lifeStatus || p.lifeStatus} /> },
    { key: 'installedAt', header: t('common.date'), render: (p: MachineInstalledPart) => new Date(p.installedAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.installedParts')} />
      <AdminDataGrid
        columns={columns} data={visibleData}
        keyExtractor={(p: MachineInstalledPart) => p.id}
        onRowClick={(p: MachineInstalledPart) => router.push(`/admin/installed-parts/${p.id}`)}
        loading={loading}
        emptyMessage={t('common.noData')}
        error={error || undefined}
        onRetry={fetchData}
        dir={dir}
        globalSearch={search} onGlobalSearch={setSearch}
        searchPlaceholder={t('common.search')}
        onRefresh={fetchData} refreshLoading={loading}
      />
    </div>
  );
}
