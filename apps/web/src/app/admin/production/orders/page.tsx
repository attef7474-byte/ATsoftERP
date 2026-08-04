'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { AdminDataGrid, GridAction, GridColumn } from '../../../../components/admin/datagrid';
import { Button, Modal, PageHeader, Pagination, Select, Textarea } from '../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import type { ProductionOrder, ProductionOrderReadiness } from '../../../../lib/admin-types';
import { orderErrorMessageKey } from './_components/order-form';

const EDITABLE = ['DRAFT', 'PLANNED'];
const CANCELLABLE = ['DRAFT', 'PLANNED', 'RELEASED'];
const ARCHIVABLE = ['DRAFT', 'PLANNED', 'CANCELLED'];
const ORDER_STATUSES = ['DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED', 'ARCHIVED'];
const ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

interface TransitionTarget {
  id: string;
  action: string;
  reasonRequired: boolean;
  lockVersion: number;
}

function statusLabelKey(value: string): string {
  switch (value) {
    case 'DRAFT': return 'common.status.DRAFT';
    case 'PLANNED': return 'common.status.PLANNED';
    case 'RELEASED': return 'common.status.RELEASED';
    case 'IN_PROGRESS': return 'common.status.IN_PROGRESS';
    case 'COMPLETED': return 'common.status.COMPLETED';
    case 'CANCELLED': return 'common.status.CANCELLED';
    case 'CLOSED': return 'common.status.CLOSED';
    default: return 'common.status.ARCHIVED';
  }
}

function priorityLabelKey(value: string): string {
  switch (value) {
    case 'LOW': return 'common.status.LOW';
    case 'HIGH': return 'common.status.HIGH';
    case 'URGENT': return 'common.status.URGENT';
    default: return 'common.status.NORMAL';
  }
}

export default function ProductionOrdersPage() {
  const { t, dir } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const can = useCallback((action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-order:' + action)), [isSuperAdmin, permissions]);
  const [data, setData] = useState<ProductionOrder[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [transition, setTransition] = useState<TransitionTarget | null>(null);
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ProductionOrder | null>(null);
  const [history, setHistory] = useState<{ transitions: any[]; audits: any[] } | null>(null);
  const [readiness, setReadiness] = useState<{ order: ProductionOrder; result: ProductionOrderReadiness } | null>(null);
  const [acting, setActing] = useState(false);

  const fetchData = useCallback(async (page = 1) => {
    if (!can('read')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page, limit: 10 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      const result = await api.get<{ data: ProductionOrder[]; meta: any }>('/production/orders', { params });
      setData(result.data || []);
      setMeta(result.meta);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [can, search, status, priority, t]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleSaveError = (err: any) => {
    const key = orderErrorMessageKey(err);
    handleApiError(err, key ? { message: t(key) } : undefined);
  };

  const runTransition = async () => {
    if (!transition) return;
    if (transition.reasonRequired && reason.trim().length < 3) return;
    setActing(true);
    try {
      const body: any = { requestId: crypto.randomUUID(), lockVersion: transition.lockVersion };
      if (transition.reasonRequired) body.reason = reason;
      await api.post('/production/orders/' + transition.id + '/' + transition.action, body);
      showToast(t('production.orders.actionCompleted'), 'success');
      setTransition(null);
      setReason('');
      await fetchData(meta.page);
    } catch (err) {
      handleSaveError(err);
    } finally {
      setActing(false);
    }
  };

  const deleteOrder = async () => {
    if (!confirmDelete) return;
    setActing(true);
    try {
      await api.delete('/production/orders/' + confirmDelete.id);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDelete(null);
      await fetchData(meta.page);
    } catch (err) {
      handleSaveError(err);
    } finally {
      setActing(false);
    }
  };

  const showHistory = async (item: ProductionOrder) => {
    try {
      setHistory(await api.get('/production/orders/' + item.id + '/history'));
    } catch (err) {
      handleApiError(err);
    }
  };

  const showReadiness = async (item: ProductionOrder) => {
    try {
      setReadiness({ order: item, result: await api.get<ProductionOrderReadiness>('/production/orders/' + item.id + '/readiness') });
    } catch (err) {
      handleApiError(err);
    }
  };

  const readinessText = (code: string) => {
    if (code.startsWith('productionOrder.readiness.')) {
      return t('production.orders.errors.readiness.' + code.slice('productionOrder.readiness.'.length));
    }
    if (code.startsWith('productionOrder.')) {
      return t('production.orders.errors.' + code.slice('productionOrder.'.length));
    }
    return code;
  };

  const transitionTitle = (action: string) => {
    if (action === 'cancel') return t('production.orders.cancelOrder');
    if (action === 'archive') return t('production.orders.archiveOrder');
    if (action === 'plan') return t('production.orders.plan');
    if (action === 'release') return t('production.orders.release');
    return t('production.orders.recalculate');
  };

  const columns: GridColumn<ProductionOrder>[] = [
    { key: 'orderNumber', header: t('production.orders.orderNumber'), render: (item) => item.orderNumber },
    { key: 'product', header: t('production.product'), render: (item) => item.productionProductDefinition?.name || '-' },
    { key: 'line', header: t('production.line'), render: (item) => item.machine?.name || item.productionLine?.name || '-' },
    { key: 'window', header: t('production.orders.plannedStartAt'), render: (item) => `${new Date(item.plannedStartAt).toLocaleString()} - ${new Date(item.plannedEndAt).toLocaleString()}` },
    { key: 'quantity', header: t('production.orders.plannedQuantity'), render: (item) => `${item.plannedQuantity} ${item.quantityUnit}` },
    { key: 'duration', header: t('production.orders.plannedDurationMinutes'), render: (item) => item.plannedDurationMinutes },
    { key: 'priority', header: t('production.orders.orderPriority'), render: (item) => t(priorityLabelKey(item.priority)) },
    { key: 'status', header: t('common.status'), render: (item) => <CmmsStatusBadge status={item.status} /> },
  ];

  const actions: GridAction<ProductionOrder>[] = [
    { label: t('actions.edit'), onClick: (item) => router.push('/admin/production/orders/' + item.id + '/edit'), enabled: (item) => can('update') && EDITABLE.includes(item.status) },
    { label: t('production.orders.plan'), onClick: (item) => setTransition({ id: item.id, action: 'plan', reasonRequired: false, lockVersion: item.lockVersion }), enabled: (item) => can('plan') && item.status === 'DRAFT' },
    { label: t('production.orders.release'), onClick: (item) => setTransition({ id: item.id, action: 'release', reasonRequired: false, lockVersion: item.lockVersion }), enabled: (item) => can('release') && item.status === 'PLANNED' },
    { label: t('production.orders.recalculate'), onClick: (item) => setTransition({ id: item.id, action: 'recalculate', reasonRequired: false, lockVersion: item.lockVersion }), enabled: (item) => can('recalculate') && EDITABLE.includes(item.status) },
    { label: t('production.orders.cancelOrder'), onClick: (item) => setTransition({ id: item.id, action: 'cancel', reasonRequired: true, lockVersion: item.lockVersion }), enabled: (item) => can('cancel') && CANCELLABLE.includes(item.status), variant: 'danger' },
    { label: t('production.orders.archiveOrder'), onClick: (item) => setTransition({ id: item.id, action: 'archive', reasonRequired: true, lockVersion: item.lockVersion }), enabled: (item) => can('archive') && ARCHIVABLE.includes(item.status), variant: 'danger' },
    { label: t('production.orders.readiness'), onClick: (item) => showReadiness(item), enabled: (item) => can('readiness') },
    { label: t('production.orders.history'), onClick: (item) => showHistory(item), enabled: (item) => can('read') },
    { label: t('actions.delete'), onClick: (item) => setConfirmDelete(item), enabled: (item) => can('delete') && item.status === 'DRAFT', variant: 'danger' },
  ];

  if (!can('read')) {
    return (
      <div>
        <PageHeader title={t('production.orders.title')} />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">{t('errors.forbidden')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title={t('production.orders.title')} />
        <div className="flex gap-2">
          {can('create') && <Button onClick={() => router.push('/admin/production/orders/new')}>{t('common.create')}</Button>}
        </div>
      </div>
      <div className="mb-4 flex max-w-lg gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t('production.orders.allStatuses')}
          options={ORDER_STATUSES.map((value) => ({ value, label: t(statusLabelKey(value)) }))} />
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} placeholder={t('production.orders.allPriorities')}
          options={ORDER_PRIORITIES.map((value) => ({ value, label: t(priorityLabelKey(value)) }))} />
      </div>
      <AdminDataGrid columns={columns} data={data} keyExtractor={(item) => item.id}
        onRowClick={(item) => router.push('/admin/production/orders/' + item.id)} selectedKey={selectedId}
        loading={loading} emptyMessage={t('common.noData')} error={error || undefined} onRetry={() => fetchData(meta.page)}
        actions={actions} dir={dir} globalSearch={search} onGlobalSearch={setSearch} searchPlaceholder={t('common.search')}
        onRefresh={() => fetchData(meta.page)} refreshLoading={loading} />
      {data.length > 0 && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />}

      <Modal open={Boolean(transition)} onClose={() => setTransition(null)} title={transitionTitle(transition?.action || '')}>
        <div className="space-y-4">
          <p>{t('production.orders.actionConfirmation')}</p>
          {transition?.reasonRequired && <Textarea label={t('production.orders.reason')} value={reason} onChange={(e) => setReason(e.target.value)} required />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTransition(null)}>{t('actions.cancel')}</Button>
            <Button onClick={runTransition} loading={acting} disabled={Boolean(transition?.reasonRequired && reason.trim().length < 3)}>{t('actions.confirm')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title={t('common.confirmDeleteTitle')}>
        <div className="space-y-4">
          <p>{t('common.confirmDeleteMessage')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>{t('actions.cancel')}</Button>
            <Button variant="danger" onClick={deleteOrder} loading={acting}>{t('actions.confirm')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title={t('production.orders.history')} size="lg">
        <div className="space-y-4">
          <div>
            <div className="mb-2 font-semibold">{t('production.orders.transitions')}</div>
            <div className="space-y-2">
              {history?.transitions?.map((tr: any) => (
                <div key={tr.id} className="rounded border p-2 text-sm">
                  <span className="font-medium">{tr.fromStatus}</span> → <span className="font-medium">{tr.toStatus}</span> · {tr.action} · {new Date(tr.createdAt).toLocaleString()}
                  {tr.reason ? <div className="text-xs text-gray-600">{t('production.orders.reason')}: {tr.reason}</div> : null}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 font-semibold">{t('production.orders.audits')}</div>
            <div className="space-y-2">
              {history?.audits?.map((a: any) => (
                <div key={a.id} className="rounded border p-2 text-sm">{a.action} · {new Date(a.createdAt).toLocaleString()}</div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(readiness)} onClose={() => setReadiness(null)} title={t('production.orders.readiness')} size="lg">
        <div className="space-y-4">
          <div className={readiness?.result.ready ? 'rounded border border-green-200 bg-green-50 p-3 font-medium text-green-800' : 'rounded border border-red-200 bg-red-50 p-3 font-medium text-red-800'}>
            {readiness?.result.ready ? t('production.orders.ready') : t('production.orders.notReady')}
          </div>
          {readiness?.result.blockers?.length ? (
            <div>
              <div className="mb-1 font-semibold">{t('common.error')}</div>
              {readiness.result.blockers.map((b) => (
                <div key={b.code} className="text-sm text-red-700">{readinessText(b.code)}</div>
              ))}
            </div>
          ) : null}
          {readiness?.result.warnings?.length ? (
            <div>
              <div className="mb-1 font-semibold">{t('common.warnings')}</div>
              {readiness.result.warnings.map((w) => (
                <div key={w.code} className="text-sm text-amber-700">{readinessText(w.code)}</div>
              ))}
            </div>
          ) : null}
          {readiness?.result.snapshotPreview ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="mb-1 font-semibold">{t('production.orders.capacitySnapshot')}</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div>{t('production.orders.capacityStandard')}: {readiness.result.snapshotPreview.capacityStandardCode} / {readiness.result.snapshotPreview.capacityStandardRevision}</div>
                <div>{t('production.orders.standardRate')}: {readiness.result.snapshotPreview.standardRate} {readiness.result.snapshotPreview.outputUnit} / {readiness.result.snapshotPreview.timeBasis}</div>
                <div>{t('production.orders.plannedDurationMinutes')}: {readiness.result.snapshotPreview.plannedDurationMinutes}</div>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}