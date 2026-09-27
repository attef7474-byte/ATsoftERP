'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { SparePartReplacementHistory } from '../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, LocalizedValue } from '../ui';

interface Props {
  machineId?: string;
  requestId?: string;
  title?: string;
}

// Explicit, exhaustive condition key map. Never build a translation key by string
// concatenation: an unknown condition must fall back to a readable value instead of
// leaking a raw translation key to the user.
const CONDITION_LABEL_KEYS: Record<string, string> = {
  NEW: 'sparePartRequest.conditionNew',
  USED_SERVICEABLE: 'sparePartRequest.conditionUsedServiceable',
  USED_REPAIRABLE: 'sparePartRequest.conditionUsedRepairable',
  DAMAGED_REPAIRABLE: 'sparePartRequest.conditionDamagedRepairable',
  DAMAGED_NOT_REPAIRABLE: 'sparePartRequest.conditionDamagedNotRepairable',
};

function conditionLabel(t: (key: string) => string, condition?: string | null): string | null {
  if (!condition) return null;
  const key = CONDITION_LABEL_KEYS[condition];
  return key ? t(key) : condition;
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

  // R2-E: the removed (old) identity is presented before the new one because the
  // event itself is "the removed part was replaced by the new part". Both sides are
  // always shown as human-readable catalog identity, never as a raw record id.
  const columns = [
    {
      key: 'replacementNumber',
      header: t('common.number') || 'Number',
    },
    {
      key: 'oldSparePart',
      header: t('maintenance.oldPart'),
      render: (row: SparePartReplacementHistory) =>
        row.oldSparePart ? `${row.oldSparePart.code} - ${row.oldSparePart.name}` : '-',
    },
    {
      key: 'removedDetails',
      header: t('maintenance.removedPartDetails'),
      render: (row: SparePartReplacementHistory) => {
        const condition = conditionLabel(t, row.removedCondition);
        const quantity = row.removedQuantity != null ? `${t('common.quantity') || 'Qty'} ${row.removedQuantity}` : null;
        const details = [condition, quantity].filter(Boolean).join(' · ');
        return details || '-';
      },
    },
    {
      key: 'newSparePart',
      header: t('maintenance.newPart'),
      render: (row: SparePartReplacementHistory) =>
        row.newSparePart ? `${row.newSparePart.code} - ${row.newSparePart.name}` : '-',
    },
    {
      key: 'replacementAction',
      header: t('maintenance.replacementAction'),
      render: (row: SparePartReplacementHistory) => <LocalizedValue value={row.replacementAction} kind="action" />,
    },
    {
      key: 'issuedQuantity',
      header: t('common.quantity') || 'Qty',
      render: (row: SparePartReplacementHistory) => `${row.issuedQuantity || 0}`,
    },
    {
      key: 'removedReturnedToStock',
      header: t('maintenance.returnedToStock'),
      render: (row: SparePartReplacementHistory) => row.removedReturnedToStock ? t('common.yes') : t('common.no'),
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
        <CardHeader>{title || t('maintenance.replacementHistory')}</CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">{t('common.noData') || 'No data'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>{title || t('maintenance.replacementHistory')}</CardHeader>
      <CardContent>
        <DataTable columns={columns} data={history} keyExtractor={(h: SparePartReplacementHistory) => h.id} />
      </CardContent>
    </Card>
  );
}
