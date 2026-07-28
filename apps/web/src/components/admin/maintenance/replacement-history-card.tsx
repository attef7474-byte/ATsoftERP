'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { SparePartReplacementHistory } from '../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState } from '../ui';

interface Props {
  machineId?: string;
  requestId?: string;
  title?: string;
}

export function ReplacementHistoryCard({ machineId, requestId, title }: Props) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<SparePartReplacementHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (machineId) {
        res = await api.get<SparePartReplacementHistory[]>(`/installed-parts/replacement-history/by-machine/${machineId}`);
      } else if (requestId) {
        res = await api.get<SparePartReplacementHistory[]>(`/installed-parts/replacement-history/by-request/${requestId}`);
      } else {
        res = await api.get<SparePartReplacementHistory[]>('/installed-parts/replacement-history');
      }
      setHistory(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load replacement history');
    } finally {
      setLoading(false);
    }
  }, [machineId, requestId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchHistory} />;

  const columns = [
    {
      key: 'replacementNumber',
      header: t('common.number') || 'Number',
    },
    {
      key: 'newSparePart',
      header: t('machines.newPart') || 'New Part',
      render: (row: SparePartReplacementHistory) =>
        row.newSparePart ? `${row.newSparePart.code} - ${row.newSparePart.name}` : '-',
    },
    {
      key: 'oldSparePart',
      header: t('machines.oldPart') || 'Old Part',
      render: (row: SparePartReplacementHistory) =>
        row.oldSparePart ? `${row.oldSparePart.code} - ${row.oldSparePart.name}` : '-',
    },
    {
      key: 'replacementAction',
      header: t('machines.replacementAction') || 'Action',
    },
    {
      key: 'issuedQuantity',
      header: t('common.quantity') || 'Qty',
      render: (row: SparePartReplacementHistory) => `${row.issuedQuantity || 0}`,
    },
    {
      key: 'removedReturnedToStock',
      header: t('machines.returnedToStock') || 'Returned',
      render: (row: SparePartReplacementHistory) => row.removedReturnedToStock ? 'Yes' : 'No',
    },
    {
      key: 'replacedAt',
      header: t('common.date') || 'Date',
      render: (row: SparePartReplacementHistory) => row.replacedAt ? new Date(row.replacedAt).toLocaleDateString() : '-',
    },
  ];

  if (!history.length) {
    return (
      <Card>
        <CardHeader>{title || t('machines.replacementHistory') || 'Replacement History'}</CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">{t('common.noData') || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>{title || t('machines.replacementHistory') || 'Replacement History'}</CardHeader>
      <CardContent>
        <DataTable columns={columns} data={history} keyExtractor={(h: SparePartReplacementHistory) => h.id} />
      </CardContent>
    </Card>
  );
}
