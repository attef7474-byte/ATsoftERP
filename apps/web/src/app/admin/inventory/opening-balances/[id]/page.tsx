'use client';
/**
 * Read-only Inventory Opening Balance document workspace.
 *
 * The page exists so an authorized reader can inspect one posted/opening
 * balance and print it as a business document. It never creates, edits, posts
 * or cancels inventory: every action here is a read or a print of the
 * canonical `GET /inventory/opening-balances/:id` response.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { isReservedDetailRouteId } from '../../../../../lib/route-guards';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { Button, Card, CardContent, CardHeader, DataTable, LoadingState, EmptyState, ErrorState } from '../../../../../components/admin/ui';
import { InventoryStatusBadge } from '../../../../../components/inventory-counting/InventoryStatusBadge';
import {
  useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon,
} from '../../../../../components/admin/admin-action-bar';
import { formatDateTime } from '../../../../../lib/i18n/literals';
import { usePrintDocument } from '../../../../../components/print/use-print-document';
import { inventoryOpeningBalanceDocumentModel } from '../../../../../components/print/inventory-opening-balance-document-print';
import type { OpeningBalance, OpeningBalanceLine } from '../../../../../lib/admin-types';

export default function OpeningBalanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale, dir } = useTranslation();
  const handleApiError = useApiErrorHandler();
  const { print, printing, scopeKey } = usePrintDocument();
  const id = params?.id as string;

  const [data, setData] = useState<OpeningBalance | null>(null);
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
      const res = await api.get<OpeningBalance>(`/inventory/opening-balances/${id}`);
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
      const fresh = await api.get<OpeningBalance>(`/inventory/opening-balances/${id}`);
      assertScope();
      return inventoryOpeningBalanceDocumentModel(fresh, t, locale);
    });
  }, [id, locale, print, reserved, scopeKey, t]);

  const handlers = useMemo(() => ({
    back: () => router.push('/admin/inventory/opening-balances'),
    refresh: () => load(),
    print: () => handlePrint(),
  }), [handlePrint, load, router]);
  const { exec } = useStableHandlers(handlers);

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'common.print', icon: <ActionPrintIcon />, permission: 'inventory:opening-balance:read', onClick: () => exec('print'), enabled: !!data && !printing },
  ]);

  const lines = data?.lines || [];
  const hasUnitCost = lines.some(line => line.unitCost != null && line.unitCost !== '');
  const hasCurrency = lines.some(line => Boolean(line.currencyCode));
  const hasLineNotes = lines.some(line => Boolean(line.notes));

  const lineColumns = useMemo(() => {
    const columns: { key: string; header: string; render: (line: OpeningBalanceLine) => React.ReactNode }[] = [
      { key: 'product', header: t('inventoryCounting.product'), render: line => line.product ? `[${line.product.code}] ${line.product.name}` : '-' },
      { key: 'quantity', header: t('inventoryCounting.quantity'), render: line => line.quantity },
      { key: 'unit', header: t('inventoryCounting.unit'), render: line => line.product?.unit || '-' },
    ];
    if (hasUnitCost) columns.push({ key: 'unitCost', header: t('inventoryValuation.unitCost'), render: line => line.unitCost ?? '-' });
    if (hasCurrency) columns.push({ key: 'currency', header: t('inventoryValuation.currency'), render: line => line.currencyCode || '-' });
    if (hasLineNotes) columns.push({ key: 'notes', header: t('inventoryCounting.notes'), render: line => line.notes || '-' });
    return columns;
  }, [hasCurrency, hasLineNotes, hasUnitCost, t]);

  if (loading && !data) return <LoadingState message={t('common.loading')} />;
  if (notFound) {
    return <EmptyState message={t('details.notFound')} action={<Button onClick={() => router.push('/admin/inventory/opening-balances')}>{t('common.back')}</Button>} />;
  }
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ErrorState message={t('errors.loadFailed')} onRetry={load} />;

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 break-words">{value ?? '-'}</dd>
    </div>
  );

  return (
    <div className="space-y-6" dir={dir}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.code}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('inventoryCounting.openingBalance')}</p>
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
            <Field label={t('inventoryCounting.postedAt')} value={data.postedAt ? formatDateTime(data.postedAt, locale) : undefined} />
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
            <DataTable columns={lineColumns} data={lines} keyExtractor={(line: OpeningBalanceLine) => line.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
