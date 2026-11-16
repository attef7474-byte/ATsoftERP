'use client';
/**
 * Read-only Inventory Stock Adjustment document workspace.
 *
 * The page exists so an authorized reader can inspect one stock adjustment and
 * print it as a business document. It never creates, edits, submits, approves,
 * rejects, posts or cancels inventory: every action here is a read or a print of
 * the canonical `GET /inventory/stock-adjustments/:id` response.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { isReservedDetailRouteId } from '../../../../../lib/route-guards';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { Button, Card, CardContent, CardHeader, DataTable, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { InventoryStatusBadge } from '../../../../../components/inventory-counting/InventoryStatusBadge';
import {
  useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon,
} from '../../../../../components/admin/admin-action-bar';
import { formatDateTime, translateEnum } from '../../../../../lib/i18n/literals';
import { usePrintDocument } from '../../../../../components/print/use-print-document';
import { inventoryStockAdjustmentDocumentModel } from '../../../../../components/print/inventory-stock-adjustment-document-print';
import type { InventoryStockAdjustment, InventoryStockAdjustmentLine } from '../../../../../lib/admin-types';

export default function StockAdjustmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale, dir } = useTranslation();
  const { print, printing, scopeKey } = usePrintDocument();
  const id = params?.id as string;

  const [data, setData] = useState<InventoryStockAdjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const reserved = isReservedDetailRouteId(id);

  const load = useCallback(async () => {
    if (!id || reserved) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      // Canonical detail read: the same endpoint and read permission the list
      // and print flow use. Tenant/company/branch scoping is enforced by the API.
      const res = await api.get<InventoryStockAdjustment>(`/inventory/stock-adjustments/${id}`);
      setData(res);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) setNotFound(true);
      else setError((err as { message?: string })?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, reserved, t]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = useCallback(() => {
    if (!id || reserved) return;
    return print(scopeKey, async (assertScope) => {
      // Print re-reads the canonical detail endpoint instead of printing the
      // possibly stale React state. A denied read aborts before a document opens.
      const fresh = await api.get<InventoryStockAdjustment>(`/inventory/stock-adjustments/${id}`);
      assertScope();
      return inventoryStockAdjustmentDocumentModel(fresh, t, locale);
    });
  }, [id, locale, print, reserved, scopeKey, t]);

  const handlers = useMemo(() => ({
    back: () => router.push('/admin/inventory/stock-adjustments'),
    refresh: () => load(),
    print: () => handlePrint(),
  }), [handlePrint, load, router]);
  const { exec } = useStableHandlers(handlers);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, permission: 'inventory:stock-adjustment:read', onClick: () => exec('print'), enabled: !!data && !printing, readOnly: true },
  ]);

  const lines = data?.lines || [];
  const hasUnitCost = lines.some(line => line.unitCost != null && line.unitCost !== '');
  const hasCurrency = lines.some(line => Boolean(line.currencyCode));
  const hasValuationReason = lines.some(line => Boolean(line.valuationReason));
  const hasLineNotes = lines.some(line => Boolean(line.notes));

  const lineColumns = useMemo(() => {
    const columns: { key: string; header: string; render: (line: InventoryStockAdjustmentLine) => React.ReactNode }[] = [
      { key: 'product', header: t('inventoryCounting.product'), render: line => line.product ? `[${line.product.code}] ${line.product.name}` : '-' },
      { key: 'adjustmentType', header: t('common.type'), render: line => translateEnum(line.adjustmentType, locale) },
      { key: 'quantity', header: t('inventoryCounting.quantity'), render: line => line.quantity },
      { key: 'unit', header: t('inventoryCounting.unit'), render: line => line.product?.unit || '-' },
    ];
    if (hasUnitCost) columns.push({ key: 'unitCost', header: t('inventoryValuation.unitCost'), render: line => line.unitCost ?? '-' });
    if (hasCurrency) columns.push({ key: 'currency', header: t('inventoryValuation.currency'), render: line => line.currencyCode || '-' });
    if (hasValuationReason) columns.push({ key: 'valuationReason', header: t('inventoryValuation.valuationReason'), render: line => line.valuationReason || '-' });
    if (hasLineNotes) columns.push({ key: 'notes', header: t('inventoryCounting.notes'), render: line => line.notes || '-' });
    return columns;
  }, [hasCurrency, hasLineNotes, hasUnitCost, hasValuationReason, locale, t]);

  if (loading && !data) return <LoadingState message={t('common.loading')} />;
  if (notFound) {
    return <EmptyState message={t('details.notFound')} action={<Button onClick={() => router.push('/admin/inventory/stock-adjustments')}>{t('common.back')}</Button>} />;
  }
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ErrorState message={t('errors.loadFailed')} onRetry={load} />;

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 break-words">{value ?? '-'}</dd>
    </div>
  );

  const workflowTimes: { key: string; label: string; value: string }[] = [
    { key: 'submittedAt', label: t('inventoryCounting.submittedAt'), value: data.submittedAt ? formatDateTime(data.submittedAt, locale) : '' },
    { key: 'approvedAt', label: t('inventoryCounting.approvedAt'), value: data.approvedAt ? formatDateTime(data.approvedAt, locale) : '' },
    { key: 'rejectedAt', label: t('inventoryCounting.rejectedAt'), value: data.rejectedAt ? formatDateTime(data.rejectedAt, locale) : '' },
    { key: 'postedAt', label: t('inventoryCounting.postedAt'), value: data.postedAt ? formatDateTime(data.postedAt, locale) : '' },
    { key: 'cancelledAt', label: t('inventoryCounting.cancelledAt'), value: data.cancelledAt ? formatDateTime(data.cancelledAt, locale) : '' },
  ].filter(item => Boolean(item.value));

  return (
    <div className="space-y-6" dir={dir}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.code}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('inventoryCounting.stockAdjustment')}</p>
            </div>
            <InventoryStatusBadge status={data.status} />
          </div>
        </CardHeader>
        <CardContent>
          {error ? <ErrorState message={error} onRetry={load} /> : null}
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Field label={t('inventoryCounting.company')} value={data.company?.name} />
            <Field label={t('inventoryCounting.branch')} value={data.branch?.name} />
            <Field label={t('inventoryCounting.warehouse')} value={data.warehouse ? `${data.warehouse.code ? `[${data.warehouse.code}] ` : ''}${data.warehouse.name}` : undefined} />
            <Field label={t('inventoryCounting.documentDate')} value={formatDateTime(data.documentDate, locale)} />
            <Field label={t('inventoryCounting.reason')} value={data.reason} />
            {workflowTimes.map(item => <Field key={item.key} label={item.label} value={item.value} />)}
            <Field label={t('common.createdAt')} value={formatDateTime(data.createdAt, locale)} />
            <Field label={t('common.updatedAt')} value={formatDateTime(data.updatedAt, locale)} />
          </dl>
          {data.notes ? (
            <div className="mt-6">
              <h2 className="text-xs text-gray-500 uppercase tracking-wider">{t('inventoryCounting.notes')}</h2>
              <p className="mt-1 text-sm text-gray-900" style={{ whiteSpace: 'pre-line' }}>{data.notes}</p>
            </div>
          ) : null}
          {data.status === 'POSTED' || data.status === 'CANCELLED' ? (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">{t('details.readOnlyRecord')}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-gray-700">{t('inventoryCounting.lines')}</h2></CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p>
          ) : (
            <DataTable columns={lineColumns} data={lines} keyExtractor={(line: InventoryStockAdjustmentLine) => line.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
