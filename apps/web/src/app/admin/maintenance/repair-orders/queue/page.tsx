'use client';
/**
 * R2-G — the repairable-queue operator workspace.
 *
 * This queue is the R2-E source-identity rule made visible. For every returned
 * part it shows:
 *   - the REMOVED part as the repairable identity (never the newly installed one),
 *   - the exact stock-IN movement the replacement recorded, and its warehouse,
 *     resolved by movement id and verified against the replacement,
 *   - the supporting condition balances for the removed part, with the exact
 *     return warehouse listed first,
 *   - an existing non-terminal repair order for the same replacement, so a
 *     duplicate cannot be created by accident.
 *
 * The warehouse used when creating the order is the backend's decision, not the
 * operator's: creation posts the replacement id to
 * `/from-replacement-history`, and the service re-resolves and re-verifies the
 * source. This page therefore never sends a warehouse, quantity or condition.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useAuth } from '../../../../../lib/auth-context';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import {
  PageHeader, Button, Card, CardContent, DataTable, LoadingState, EmptyState,
  ErrorState, StatusBadge, LocalizedValue, Input, Textarea,
} from '../../../../../components/admin/ui';
import {
  useRegisterAdminActions, useStableHandlers, ActionRefreshIcon, ActionAddIcon,
} from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, machineAdapter, sparePartAdapter } from '../../../../../components/f9';
import { formatDateTime } from '../../../../../lib/i18n/literals';
import {
  RepairableQueueItem, REPAIR_SOURCE_CONDITIONS, fetchRepairableQueue,
  createRepairOrderFromReplacement,
} from '../repair-order-api';
import { repairableRowCanCreate } from '../repair-order-actions';

const PAGE_SIZE = 50;

export default function RepairableQueuePage() {
  const { t, locale, dir } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<RepairableQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [condition, setCondition] = useState('');
  const [machineId, setMachineId] = useState('');
  const [sparePartId, setSparePartId] = useState('');

  const [creating, setCreating] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = isSuperAdmin || Boolean(permissions?.permissions.includes('repair-orders:create'));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await fetchRepairableQueue({
        condition: condition || undefined,
        machineId: machineId || undefined,
        sparePartId: sparePartId || undefined,
        limit: PAGE_SIZE,
      }));
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [condition, machineId, sparePartId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createFromRow = useCallback(async (row: RepairableQueueItem) => {
    if (!row.replacementHistoryId) return;
    setSaving(true);
    setCreateError('');
    try {
      const created = await createRepairOrderFromReplacement(
        row.replacementHistoryId,
        notes.trim() || undefined,
      );
      showToast(t('maintenance.repairOrderCreated'), 'success');
      setCreating(null);
      setNotes('');
      await fetchData();
      if (created?.id) router.push(`/admin/maintenance/repair-orders/${created.id}`);
    } catch (err: unknown) {
      handleApiError(err);
      setCreateError((err as { message?: string })?.message || t('errors.createFailed'));
    } finally {
      setSaving(false);
    }
  }, [notes, showToast, t, fetchData, router, handleApiError]);

  const handlers = useMemo(() => ({ refresh: () => fetchData() }), [fetchData]);
  const { exec } = useStableHandlers(handlers);

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [
      row.replacementNumber,
      row.sparePart?.code,
      row.sparePart?.name,
      row.newSparePart?.name,
      row.machine?.code,
      row.machine?.name,
      row.maintenanceRequest?.requestNumber,
      row.removedCondition,
      row.exactReturnSource?.movementNumber,
      row.exactReturnSource?.warehouse?.name,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [rows, search]);

  const columns = useMemo(() => ([
    {
      key: 'replacementNumber',
      header: t('maintenance.repairReplacementNumber'),
      render: (row: RepairableQueueItem) => row.replacementNumber || '-',
    },
    {
      // The removed part is the repairable identity; the installed part is context.
      key: 'sparePart',
      header: t('maintenance.repairRemovedPart'),
      render: (row: RepairableQueueItem) => (
        <span>
          {row.sparePart ? `[${row.sparePart.code}] ${row.sparePart.name}` : '-'}
          {row.installedPart?.serialNumber ? (
            <span className="block text-xs text-gray-500">{t('maintenance.repairSerialNumber')}: {row.installedPart.serialNumber}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'removedCondition',
      header: t('maintenance.repairRemovedCondition'),
      render: (row: RepairableQueueItem) => <LocalizedValue value={row.removedCondition} />,
    },
    {
      key: 'removedQuantity',
      header: t('maintenance.repairRemovedQuantity'),
      render: (row: RepairableQueueItem) => row.removedQuantity ?? '-',
    },
    {
      // Authoritative return evidence first; never an arbitrary warehouse.
      key: 'exactReturnSource',
      header: t('maintenance.repairReturnSource'),
      render: (row: RepairableQueueItem) => (row.exactReturnSource ? (
        <span>
          {row.exactReturnSource.warehouse ? `[${row.exactReturnSource.warehouse.code}] ${row.exactReturnSource.warehouse.name}` : '-'}
          <span className="block text-xs text-gray-500">
            {t('maintenance.repairReturnMovement')}: {row.exactReturnSource.movementNumber || row.exactReturnSource.movementId}
          </span>
        </span>
      ) : (
        <span className="text-gray-500">{t('maintenance.repairReturnSourceUnavailable')}</span>
      )),
    },
    {
      key: 'balances',
      header: t('maintenance.repairAvailableBalances'),
      render: (row: RepairableQueueItem) => (
        (row.availableBalances || []).length === 0
          ? <span className="text-gray-500">{t('maintenance.repairNoBalance')}</span>
          : (
            <ul className="text-xs">
              {(row.availableBalances || []).map((balance) => (
                <li key={balance.id}>
                  {balance.warehouse ? `[${balance.warehouse.code}] ${balance.warehouse.name}` : balance.warehouseId}
                  {' — '}{balance.quantity}
                </li>
              ))}
            </ul>
          )
      ),
    },
    {
      key: 'machine',
      header: t('maintenance.machine'),
      render: (row: RepairableQueueItem) => (row.machine ? `[${row.machine.code}] ${row.machine.name}` : '-'),
    },
    {
      key: 'replacedAt',
      header: t('maintenance.repairReplacedAt'),
      render: (row: RepairableQueueItem) => formatDateTime(row.replacedAt, locale),
    },
    {
      key: 'existingRepairOrder',
      header: t('maintenance.repairExistingOrder'),
      render: (row: RepairableQueueItem) => (row.existingRepairOrder ? (
        <button
          type="button"
          className="text-blue-600 hover:text-blue-800"
          onClick={() => router.push(`/admin/maintenance/repair-orders/${row.existingRepairOrder!.id}`)}
        >
          {row.existingRepairOrder.repairOrderNumber || row.existingRepairOrder.id}
          {' '}<StatusBadge status={row.existingRepairOrder.status} />
        </button>
      ) : (
        <span className="text-gray-500">{t('maintenance.repairNoExistingOrder')}</span>
      )),
    },
  ]), [t, locale, router]);

  if (loading && rows.length === 0) return <LoadingState message={t('common.loading')} />;

  return (
    <div dir={dir}>
      <PageHeader title={t('maintenance.repairablePartsQueue')} />

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="repair-queue-filters">
        <label className="text-xs text-gray-600">
          {t('maintenance.condition')}
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">{t('common.all')}</option>
            {REPAIR_SOURCE_CONDITIONS.map((value) => (
              <option key={value} value={value}>
                {t(value === 'USED_REPAIRABLE' ? 'maintenance.conditionUsedRepairable' : 'maintenance.conditionDamagedRepairable')}
              </option>
            ))}
          </select>
        </label>

        <F9Lookup
          label={t('maintenance.machine')}
          name="queueMachine"
          value={machineId}
          onChange={setMachineId}
          adapter={machineAdapter}
          bindToActiveContext
        />

        <F9Lookup
          label={t('maintenance.sparePartLabel')}
          name="queueSparePart"
          value={sparePartId}
          onChange={setSparePartId}
          adapter={sparePartAdapter}
        />
      </div>

      {error ? <ErrorState message={error} onRetry={fetchData} /> : null}

      {creating ? (
        <Card>
          <CardContent>
            <div className="space-y-3 pt-4">
              <h2 className="text-base font-semibold">{t('maintenance.repairCreateFromReplacement')}</h2>
              {createError ? <div role="alert" className="text-sm text-red-700">{createError}</div> : null}
              <Textarea
                label={t('maintenance.notes')}
                name="queueCreateNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => { setCreating(null); setCreateError(''); }} disabled={saving}>
                  {t('common.cancel')}
                </Button>
                <Button
                  loading={saving}
                  onClick={() => {
                    // Resolve from the unfiltered set: a search typed after the
                    // dialog opened must not silently swallow the submission.
                    const row = rows.find((item) => item.replacementHistoryId === creating);
                    if (row) createFromRow(row);
                  }}
                >
                  {t('common.confirm')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 && !loading ? <EmptyState message={t('common.noData')} /> : (
        <DataTable
          columns={columns}
          data={visibleRows}
          keyExtractor={(row: RepairableQueueItem) => row.replacementHistoryId}
          loading={loading}
          emptyMessage={t('common.noData')}
        />
      )}

      {canCreate ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {rows
            .filter((row) => repairableRowCanCreate(row))
            .map((row) => (
              <Button
                key={row.replacementHistoryId}
                size="sm"
                variant="primary"
                onClick={() => { setCreating(row.replacementHistoryId); setCreateError(''); }}
              >
                <span className="inline-flex items-center gap-1">
                  <ActionAddIcon />
                  {t('maintenance.repairCreateFromReplacement')}
                  {row.replacementNumber ? ` — ${row.replacementNumber}` : ''}
                </span>
              </Button>
            ))}
        </div>
      ) : null}

      <p className="mt-3 text-sm text-gray-600">
        {t('maintenance.repairQueueSourceRule')}
      </p>
    </div>
  );
}
