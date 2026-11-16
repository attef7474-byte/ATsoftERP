'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { translateMovementSourceType, translateMovementType, translateStatus } from '../../../../lib/i18n/literals';
import { InventoryMovement } from '../../../../lib/admin-types/inventory-movement';
import { Button, Card, Input, Pagination, PageHeader, Select } from '../../../../components/admin/ui';
import { AdminDataGrid, GridColumn } from '../../../../components/admin/admin-data-grid';
import { F9Lookup, productAdapter, warehouseAdapter } from '../../../../components/f9';
import { useRegisterAdminActions, useStableHandlers, ActionPrintIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { useReportPrintSnapshot } from '../../../../components/print/use-report-print-snapshot';
import { inventoryLedgerPrintModel, type LedgerRegisterPrintData, type LedgerRegisterRow } from '../../../../components/print/inventory-ledger-register-print';
import { collectPrintRows } from '../../../../lib/print';
import {
  LEDGER_DIRECTIONS,
  LEDGER_MOVEMENT_TYPES,
  LEDGER_SOURCE_TYPES,
  LEDGER_STATUSES,
  buildLedgerQueryParams,
  createEmptyLedgerFilters,
  normalizeLedgerPrintPage,
  type LedgerFilterDraft,
  type LedgerMovementsPageResponse,
} from './filter-contract';

const PAGE_LIMIT = 20;

export default function InventoryLedgerPage() {
  const { t, dir, locale } = useTranslation();
  const [data, setData] = useState<InventoryMovement[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<LedgerFilterDraft>(createEmptyLedgerFilters);
  const [applied, setApplied] = useState<LedgerFilterDraft>(createEmptyLedgerFilters);
  const [page, setPage] = useState(1);
  const { capture, invalidate, rememberLookup, printSnapshot, canPrint } = useReportPrintSnapshot<LedgerRegisterPrintData>();

  const updateDraft = (patch: Partial<LedgerFilterDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: InventoryMovement[]; meta: any }>(
        '/inventory/ledger/movements',
        { params: buildLedgerQueryParams(applied, page, PAGE_LIMIT) },
      );
      const nextMeta = res.meta || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 };
      setData(res.data || []);
      setMeta(nextMeta);
      capture(
        {
          rows: res.data || [],
          total: nextMeta.total,
          page: nextMeta.page,
          pageSize: nextMeta.limit,
          totalPages: nextMeta.totalPages,
        },
        buildLedgerQueryParams(applied, page, PAGE_LIMIT),
      );
    } catch (err: any) {
      invalidate();
      setError(
        err?.response?.data?.message?.[0] ||
          err?.response?.data?.message ||
          err?.message ||
          t('errors.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [applied, page, t, capture, invalidate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrint = () => printSnapshot(!loading && !error, async (snapshot, assertScope) => {
    const result = await collectPrintRows(
      async (printPage, pageSize) => normalizeLedgerPrintPage(
        await api.get<LedgerMovementsPageResponse<LedgerRegisterRow>>('/inventory/ledger/movements', {
          params: { ...snapshot.params, page: printPage, limit: pageSize },
        }),
      ),
      assertScope,
      row => row.id,
    );
    return inventoryLedgerPrintModel(
      { ...snapshot, data: { ...result.first, rows: result.rows } },
      t,
      locale,
    );
  });

  const { exec } = useStableHandlers({ refresh: () => fetchData(), print: handlePrint });
  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    {
      id: 'print',
      labelKey: 'common.print',
      icon: <ActionPrintIcon />,
      onClick: () => exec('print'),
      readOnly: true,
      enabled: canPrint && !loading && !error,
      permission: 'inventory-ledger:read',
    },
  ]);

  const applyFilters = () => {
    setApplied({ ...draft });
    setPage(1);
  };

  const resetFilters = () => {
    const cleared = createEmptyLedgerFilters();
    setDraft(cleared);
    setApplied(cleared);
    setPage(1);
  };

  const movementTypeOptions = LEDGER_MOVEMENT_TYPES.map((value) => ({
    value,
    label: translateMovementType(value, locale),
  }));

  const statusOptions = LEDGER_STATUSES.map((value) => ({
    value,
    label: translateStatus(value, locale),
  }));

  const directionOptions = LEDGER_DIRECTIONS.map((value) => ({
    value,
    label: translateStatus(value, locale),
  }));

  const sourceTypeOptions = LEDGER_SOURCE_TYPES.map((value) => ({
    value,
    label: translateMovementSourceType(value, locale),
  }));

  const columns: GridColumn<InventoryMovement>[] = [
    { key: 'movementNumber', header: t('inventoryLedger.movementNumber'), sortable: true },
    {
      key: 'movementType',
      header: t('inventoryLedger.movementType'),
      render: (row: InventoryMovement) => translateMovementType(row.movementType, locale),
    },
    {
      key: 'warehouse',
      header: t('inventoryLedger.warehouse'),
      render: (row: InventoryMovement) =>
        row.warehouse ? `[${row.warehouse.code}] ${row.warehouse.name}` : '-',
    },
    {
      key: 'direction',
      header: t('inventoryLedger.direction'),
      render: (row: InventoryMovement) => translateStatus(row.direction, locale),
    },
    {
      key: 'status',
      header: t('inventoryLedger.status'),
      render: (row: InventoryMovement) => translateStatus(row.status, locale),
    },
    {
      key: 'movementDate',
      header: t('inventoryLedger.date'),
      render: (row: InventoryMovement) =>
        row.movementDate
          ? new Date(row.movementDate).toLocaleDateString(locale === 'ar' ? 'ar' : 'en')
          : '-',
    },
    {
      key: 'lines',
      header: t('inventoryLedger.lines'),
      align: 'center',
      render: (row: InventoryMovement) => row.lines?.length ?? 0,
    },
  ];

  return (
    <div dir={dir}>
      <PageHeader title={t('inventoryLedger.title')} />
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <Input
            label={t('inventoryLedger.search')}
            placeholder={t('inventoryLedger.searchPlaceholder')}
            value={draft.search}
            onChange={(event) => updateDraft({ search: event.target.value })}
          />
          <F9Lookup
            label={t('inventoryLedger.warehouse')}
            value={draft.warehouseId}
            onChange={(value) => updateDraft({ warehouseId: value })}
            onItemSelect={(item) => rememberLookup('warehouseId', item)}
            adapter={warehouseAdapter}
          />
          <F9Lookup
            label={t('inventoryLedger.product')}
            value={draft.productId}
            onChange={(value) => updateDraft({ productId: value })}
            onItemSelect={(item) => rememberLookup('productId', item)}
            adapter={productAdapter}
          />
          <Select
            label={t('inventoryLedger.movementType')}
            value={draft.movementType}
            onChange={(event) => updateDraft({ movementType: event.target.value })}
            options={[{ value: '', label: t('common.all') }, ...movementTypeOptions]}
          />
          <Select
            label={t('inventoryLedger.status')}
            value={draft.status}
            onChange={(event) => updateDraft({ status: event.target.value })}
            options={[{ value: '', label: t('common.all') }, ...statusOptions]}
          />
          <Select
            label={t('inventoryLedger.direction')}
            value={draft.direction}
            onChange={(event) => updateDraft({ direction: event.target.value })}
            options={[{ value: '', label: t('common.all') }, ...directionOptions]}
          />
          <Select
            label={t('inventoryLedger.sourceType')}
            value={draft.sourceType}
            onChange={(event) => updateDraft({ sourceType: event.target.value })}
            options={[{ value: '', label: t('common.all') }, ...sourceTypeOptions]}
          />
          <Input
            type="date"
            label={t('inventoryLedger.dateFrom')}
            value={draft.dateFrom}
            onChange={(event) => updateDraft({ dateFrom: event.target.value })}
          />
          <Input
            type="date"
            label={t('inventoryLedger.dateTo')}
            value={draft.dateTo}
            onChange={(event) => updateDraft({ dateTo: event.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={resetFilters}>
            {t('actions.reset')}
          </Button>
          <Button onClick={applyFilters}>{t('actions.apply')}</Button>
        </div>
      </Card>
      <Card>
        {error ? (
          <div className="p-2 bg-red-100 text-red-700 rounded">{error}</div>
        ) : (
          <AdminDataGrid
            columns={columns}
            data={data}
            keyExtractor={(movement: InventoryMovement) => movement.id}
            loading={loading}
            emptyMessage={t('inventoryLedger.noMovements')}
            dir={dir}
          />
        )}
      </Card>
      {meta.totalPages > 1 && (
        <div className="mt-3">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={(nextPage) => setPage(nextPage)}
          />
        </div>
      )}
    </div>
  );
}
