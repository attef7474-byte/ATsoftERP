'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { MachineInstalledPart } from '../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, LocalizedValue } from '../ui';
import { LifeStatusBadge } from '../../maintenance/life-status-badge';

const STATUS_VARIANTS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  REMOVED: 'bg-yellow-100 text-yellow-800',
  REPLACED: 'bg-blue-100 text-blue-800',
  DECOMMISSIONED: 'bg-red-100 text-red-800',
};

interface Props {
  machineId?: string;
  requestId?: string;
  title?: string;
}

export function InstalledPartsCard({ machineId, requestId, title }: Props) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<MachineInstalledPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (machineId) {
        res = await api.get<MachineInstalledPart[]>(`/installed-parts/by-machine/${machineId}`);
      } else if (requestId) {
        res = await api.get<MachineInstalledPart[]>(`/installed-parts/by-request/${requestId}`);
      } else {
        res = await api.get<MachineInstalledPart[]>('/installed-parts');
      }
      setParts(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load installed parts');
    } finally {
      setLoading(false);
    }
  }, [machineId, requestId]);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  const columns = useMemo(() => {
    const cols: any[] = [
      {
        key: 'sparePart',
        header: t('maintenance.installedPart'),
        render: (row: MachineInstalledPart) =>
          row.sparePart ? `${row.sparePart.code} - ${row.sparePart.name}` : '-',
      },
      {
        key: 'machineComponent',
        header: t('maintenance.machineComponent'),
        render: (row: MachineInstalledPart) =>
          row.machineComponent ? row.machineComponent.name : '-',
      },
      {
        key: 'installedQuantity',
        header: t('common.quantity') || 'Qty',
        render: (row: MachineInstalledPart) => `${row.installedQuantity} ${row.sparePart?.unit || ''}`,
      },
      {
        key: 'installedCondition',
        header: t('maintenance.condition'),
        render: (row: MachineInstalledPart) => <LocalizedValue value={row.installedCondition} />,
      },
      {
        key: 'installedAt',
        header: t('common.date') || 'Date',
        render: (row: MachineInstalledPart) => row.installedAt ? new Date(row.installedAt).toLocaleDateString() : '-',
      },
      {
        key: 'life',
        header: t('maintenance.lifeStatus') || 'Life',
        render: (row: MachineInstalledPart) => (
          <LifeStatusBadge status={row.life?.lifeStatus || row.lifeStatus} />
        ),
      },
      {
        key: 'status',
        header: t('common.status') || 'Status',
        render: (row: MachineInstalledPart) => (
          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_VARIANTS[row.status] || 'bg-gray-100 text-gray-800'}`}>
            <LocalizedValue value={row.status} kind="status" />
          </span>
        ),
      },
    ];
    if (!machineId) {
      cols.unshift({
        key: 'machine',
        header: t('maintenance.machine'),
        render: (row: MachineInstalledPart) =>
          row.machine ? `${row.machine.code} - ${row.machine.name}` : '-',
      });
    }
    return cols;
  }, [t, machineId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchParts} />;

  if (!parts.length) {
    return (
      <Card>
        <CardHeader>{title || t('maintenance.installedParts')}</CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">{t('common.noData') || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>{title || t('maintenance.installedParts')}</CardHeader>
      <CardContent>
        <DataTable columns={columns} data={parts} keyExtractor={(p: MachineInstalledPart) => p.id} />
      </CardContent>
    </Card>
  );
}
