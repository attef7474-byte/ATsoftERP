'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { LocalizedValue, PageHeader } from '../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../components/admin/admin-data-grid';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../components/admin/admin-action-bar';

interface InstalledPart {
  id: string; installedQuantity: number; installedCondition: string;
  installedAt: string;
  machine?: { id: string; name: string; code: string };
  machineComponent?: { id: string; name: string };
  sparePart?: { id: string; code: string; name: string };
  maintenanceRequest?: { id: string; requestNumber: string };
}

export default function InstalledPartsPage() {
  const { t, dir } = useTranslation();
  const [data, setData] = useState<InstalledPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const { exec } = useStableHandlers({ refresh: () => fetchData() });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<InstalledPart[]>('/installed-parts');
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [data, search]);

  const columns: GridColumn<InstalledPart>[] = [
    { key: 'machine', header: t('maintenance.machine'), render: (p: InstalledPart) => p.machine?.name || '-' },
    { key: 'sparePart', header: t('maintenance.sparePartLabel'), render: (p: InstalledPart) => p.sparePart?.name || '-' },
    { key: 'installedQuantity', header: t('common.quantity'), render: (p: InstalledPart) => p.installedQuantity },
    { key: 'installedCondition', header: t('maintenance.condition'), render: (p: InstalledPart) => <LocalizedValue value={p.installedCondition} /> },
    { key: 'component', header: t('maintenance.machineComponent'), render: (p: InstalledPart) => p.machineComponent?.name || '-' },
    { key: 'installedAt', header: t('common.date'), render: (p: InstalledPart) => new Date(p.installedAt).toLocaleDateString() },
  ];

  return (
    <div>
      <PageHeader title={t('maintenance.installedParts')} />
      <AdminDataGrid
        columns={columns} data={visibleData}
        keyExtractor={(p: InstalledPart) => p.id}
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
