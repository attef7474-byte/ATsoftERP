'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { EmptyState } from '../../admin/ui';
import { CmmsStatusBadge } from '../index';

/**
 * R4R — the category ↔ operation-type relationship, shown honestly.
 *
 * There is deliberately NO category→operation-type join table. The only structural link
 * in the schema is Machine.categoryId → Machine.operationTypeId → OperationType, so the
 * relationship is DERIVED from the machines that are actually classified.
 *
 * This panel therefore does not offer an "assign operation types to category" control,
 * because no such stored relationship exists and inventing one would fabricate data. It
 * shows where each category's machines actually lead, which is what makes the taxonomy
 * reviewable, and it names the machines responsible so a reviewer can act on the real
 * source records in the Machines module.
 *
 * Assignment itself remains a per-machine fact: a machine is given a category and an
 * operation type, and this view is the audit of that outcome.
 */
export interface DerivedCategoryOperationTypes {
  categoryId: string;
  derivedVia: string;
  machinesWithoutOperationType: number;
  data: {
    id: string;
    code: string;
    name: string;
    status: string;
    description: string | null;
    machineCount: number;
    machines: { id: string; code: string; name: string }[];
  }[];
}

export function CategoryOperationTypesPanel({ categoryId }: { categoryId: string }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<DerivedCategoryOperationTypes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<DerivedCategoryOperationTypes>(
        `/maintenance/machine-categories/${categoryId}/operation-types`,
      );
      setDetail(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [categoryId, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!categoryId) {
    return <EmptyState message={t('maintenance.selectCategoryFirst')} />;
  }
  if (loading) return <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>;
  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-3 rounded">
        <p>{error}</p>
        <button type="button" onClick={load} className="mt-2 underline text-sm">
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('maintenance.categoryOperationTypesDerivedHint')}</p>

      {detail.data.length === 0 ? (
        <EmptyState
          message={`${t('maintenance.noOperationTypesInCategory')} \u2014 ${t('maintenance.categoryOperationTypesEmptyHint')}`}
        />
      ) : (
        <div className="space-y-3">
          {detail.data.map((operationType) => (
            <div key={operationType.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-800">
                    {operationType.code} - {operationType.name}
                  </p>
                  {operationType.description && <p className="text-sm text-gray-500">{operationType.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <CmmsStatusBadge status={operationType.status} />
                  <span className="text-xs text-gray-500">
                    {t('maintenance.machineCount')}: {operationType.machineCount}
                  </span>
                </div>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {operationType.machines.map((machine) => (
                  <li
                    key={machine.id}
                    className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                  >
                    {machine.code} - {machine.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {detail.machinesWithoutOperationType > 0 && (
        <p className="text-xs text-amber-600">
          {t('maintenance.machinesWithoutOperationType')}: {detail.machinesWithoutOperationType}
        </p>
      )}
    </div>
  );
}