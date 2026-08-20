'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, getApiBaseUrl, getApiRequestHeaders } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { Button, Input, Modal, PageHeader, Textarea } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import type { ProductionOrder, ProductionOrderAttachment, ProductionOrderReadiness } from '../../../../../lib/admin-types';
import { orderErrorMessageKey } from '../_components/order-form';
import { ORDER_ARCHIVABLE_STATUSES, ORDER_CANCELLABLE_STATUSES, ORDER_CLOSEABLE_STATUSES, ORDER_EDITABLE_STATUSES, ORDER_REOPENABLE_STATUSES, priorityLabelKey, statusLabelKey } from '../_components/order-labels';

const TABS = ['snapshot', 'history', 'attachments'];

interface TransitionTarget {
  action: string;
  reasonRequired: boolean;
}

export default function ProductionOrderDetailPage() {
  const { t, dir } = useTranslation();
  const params = useParams();
  const id = String(params?.id || '');
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const can = useCallback((action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-order:' + action)), [isSuperAdmin, permissions]);

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('snapshot');
  const [transition, setTransition] = useState<TransitionTarget | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [history, setHistory] = useState<{ transitions: any[]; audits: any[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [attachments, setAttachments] = useState<ProductionOrderAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [readiness, setReadiness] = useState<ProductionOrderReadiness | null>(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrder(await api.get<ProductionOrder>('/production/orders/' + id));
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (id) fetchOrder();
  }, [id, fetchOrder]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await api.get('/production/orders/' + id + '/history'));
    } catch (err) {
      handleApiError(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadAttachments = async () => {
    setAttachmentsLoading(true);
    try {
      const result = await api.get<ProductionOrderAttachment[] | { data: ProductionOrderAttachment[] }>('/production/orders/' + id + '/attachments');
      setAttachments(Array.isArray(result) ? result : (result.data || []));
    } catch (err) {
      handleApiError(err);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  useEffect(() => {
    if (!order) return;
    if (tab === 'history') loadHistory();
    if (tab === 'attachments') loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, order?.id]);

  const handleSaveError = (err: any) => {
    const key = orderErrorMessageKey(err);
    handleApiError(err, key ? { message: t(key) } : undefined);
  };

  const runTransition = async () => {
    if (!order || !transition) return;
    if (transition.reasonRequired && reason.trim().length < 3) return;
    setActing(true);
    try {
      const body: any = { requestId: crypto.randomUUID(), lockVersion: order.lockVersion };
      if (transition.reasonRequired) body.reason = reason;
      const updated = await api.post<ProductionOrder>('/production/orders/' + id + '/' + transition.action, body);
      showToast(t('production.orders.actionCompleted'), 'success');
      setTransition(null);
      setReason('');
      setOrder(updated);
    } catch (err) {
      handleSaveError(err);
    } finally {
      setActing(false);
    }
  };

  const showReadiness = async () => {
    if (!order) return;
    try {
      setReadiness(await api.get<ProductionOrderReadiness>('/production/orders/' + id + '/readiness'));
    } catch (err) {
      handleApiError(err);
    }
  };

  const uploadAttachment = async () => {
    if (!order || !attachmentFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', attachmentFile);
      if (attachmentDescription) formData.append('description', attachmentDescription);
      await api.post('/production/orders/' + id + '/attachments', formData);
      showToast(t('common.successCreated'), 'success');
      setAttachmentFile(null);
      setAttachmentDescription('');
      await loadAttachments();
    } catch (err) {
      handleSaveError(err);
    } finally {
      setUploading(false);
    }
  };

  const downloadAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(getApiBaseUrl() + '/production/orders/' + id + '/attachments/' + attachmentId + '/download', {
        headers: getApiRequestHeaders(),
      });
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers.get('content-disposition') || '';
      const nameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      link.download = nameMatch ? nameMatch[1].replace(/['"]/g, '') : attachmentId;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      handleApiError(err);
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!order) return;
    try {
      await api.delete('/production/orders/' + id + '/attachments/' + attachmentId);
      showToast(t('common.successDeleted'), 'success');
      await loadAttachments();
    } catch (err) {
      handleSaveError(err);
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
    if (action === 'close') return t('production.orders.closeOrder');
    if (action === 'reopen') return t('production.orders.reopenOrder');
    if (action === 'plan') return t('production.orders.plan');
    if (action === 'release') return t('production.orders.release');
    return t('production.orders.recalculate');
  };

  const transitionMessage = (action: string) => {
    if (action === 'close') return t('production.orders.closeConfirmation');
    if (action === 'reopen') return t('production.orders.reopenConfirmation');
    return t('production.orders.actionConfirmation');
  };

  if (loading) {
    return <div><PageHeader title={t('production.orders.title')} /><div className="text-gray-500">{t('common.loading')}</div></div>;
  }

  if (error || !order) {
    return (
      <div>
        <PageHeader title={t('production.orders.title')} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{error || t('common.notFound')}</div>
        <div className="mt-4"><Button variant="secondary" onClick={() => router.push('/admin/production/orders')}>{t('common.backToList')}</Button></div>
      </div>
    );
  }

  const canTransition = (action: string) => {
    if (action === 'plan') return can('plan') && order.status === 'DRAFT';
    if (action === 'release') return can('release') && order.status === 'PLANNED';
    if (action === 'recalculate') return can('recalculate') && ORDER_EDITABLE_STATUSES.includes(order.status);
    if (action === 'cancel') return can('cancel') && ORDER_CANCELLABLE_STATUSES.includes(order.status);
    if (action === 'archive') return can('archive') && ORDER_ARCHIVABLE_STATUSES.includes(order.status);
    if (action === 'close') return can('close') && ORDER_CLOSEABLE_STATUSES.includes(order.status);
    if (action === 'reopen') return can('reopen') && ORDER_REOPENABLE_STATUSES.includes(order.status);
    return false;
  };

  const infoCell = (label: string, value: string) => (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900" dir={dir}>{value}</div>
    </div>
  );

  const snapshotCell = (label: string, value: string | number | null | undefined) => (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900" dir="ltr">{value ?? '-'}</div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title={order.orderNumber} subtitle={t('production.orders.title')} />
        <div className="flex flex-wrap gap-2">
          {canTransition('plan') && <Button onClick={() => setTransition({ action: 'plan', reasonRequired: false })}>{t('production.orders.plan')}</Button>}
          {canTransition('release') && <Button onClick={() => setTransition({ action: 'release', reasonRequired: false })}>{t('production.orders.release')}</Button>}
          {canTransition('recalculate') && <Button variant="secondary" onClick={() => setTransition({ action: 'recalculate', reasonRequired: false })}>{t('production.orders.recalculate')}</Button>}
          {can('readiness') && <Button variant="secondary" onClick={showReadiness}>{t('production.orders.readiness')}</Button>}
          {can('update') && ORDER_EDITABLE_STATUSES.includes(order.status) && <Button variant="secondary" onClick={() => router.push('/admin/production/orders/' + id + '/edit')}>{t('actions.edit')}</Button>}
          {canTransition('cancel') && <Button variant="danger" onClick={() => setTransition({ action: 'cancel', reasonRequired: true })}>{t('production.orders.cancelOrder')}</Button>}
          {canTransition('archive') && <Button variant="danger" onClick={() => setTransition({ action: 'archive', reasonRequired: true })}>{t('production.orders.archiveOrder')}</Button>}
          {canTransition('close') && <Button onClick={() => setTransition({ action: 'close', reasonRequired: true })}>{t('production.orders.closeOrder')}</Button>}
          {canTransition('reopen') && <Button variant="secondary" onClick={() => setTransition({ action: 'reopen', reasonRequired: true })}>{t('production.orders.reopenOrder')}</Button>}
          <Button variant="secondary" onClick={() => router.push('/admin/production/orders')}>{t('common.backToList')}</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <CmmsStatusBadge status={order.status} />
        <span className="text-sm text-gray-600">{t('production.orders.orderPriority')}: {t(priorityLabelKey(order.priority))}</span>
        <span className="text-sm text-gray-600">{t('production.orders.orderSourceType')}: {t('production.orders.sourceType.' + order.sourceType)}</span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {infoCell(t('production.product'), order.productionProductDefinition?.name || '-')}
        {infoCell(t('production.versionLabel'), order.productionVersion ? order.productionVersion.versionNumber + ' - ' + order.productionVersion.versionLabel : '-')}
        {infoCell(t('production.packagingType'), order.productionPackaging ? order.productionPackaging.packagingType + ' (' + order.productionPackaging.packQuantity + ')' : '-')}
        {infoCell(t('production.units'), order.productionUnit?.name || '-')}
        {infoCell(t('production.line'), order.productionLine?.name || '-')}
        {infoCell(t('production.machine'), order.machine?.name || '-')}
        {infoCell(t('production.orders.costCenter'), order.costCenter?.name || '-')}
        {infoCell(t('production.orders.issueWarehouse'), order.issueWarehouse?.name || '-')}
        {infoCell(t('production.orders.receiptWarehouse'), order.receiptWarehouse?.name || '-')}
        {infoCell(t('production.orders.plannedQuantity'), order.plannedQuantity + ' ' + order.quantityUnit)}
        {infoCell(t('production.capacityTimeBasis'), t('production.timeBasis.' + order.capacityTimeBasis))}
        {infoCell(t('production.orders.plannedStartAt'), new Date(order.plannedStartAt).toLocaleString())}
        {infoCell(t('production.orders.plannedEndAt'), new Date(order.plannedEndAt).toLocaleString())}
        {infoCell(t('production.sourceReference'), order.sourceReference || '-')}
        {infoCell(t('common.notes'), order.notes || '-')}
        {infoCell(t('common.status'), t(statusLabelKey(order.status)))}
      </div>

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        {TABS.map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={'px-4 py-2 text-sm font-medium ' + (tab === tabKey ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700')}>
            {t('production.orders.' + tabKey)}
          </button>
        ))}
      </div>

      {tab === 'snapshot' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {snapshotCell(t('production.orders.capacityStandard'), order.capacityStandardCodeSnapshot + ' / ' + order.capacityStandardRevisionSnapshot)}
          {snapshotCell(t('production.orders.standardRate'), order.standardRateSnapshot + ' ' + order.outputUnitSnapshot + ' / ' + order.timeBasisSnapshot)}
          {snapshotCell(t('production.orders.efficiency'), order.targetEfficiencyPercentSnapshot + '%')}
          {snapshotCell(t('production.orders.yield'), order.expectedYieldPercentSnapshot + '%')}
          {snapshotCell(t('production.orders.plannedGrossQuantity'), order.plannedGrossQuantity)}
          {snapshotCell(t('production.orders.plannedRunMinutes'), order.plannedRunMinutes)}
          {snapshotCell(t('production.orders.plannedAllowanceMinutes'), order.plannedAllowanceMinutes)}
          {snapshotCell(t('production.orders.plannedDurationMinutes'), order.plannedDurationMinutes)}
          {snapshotCell(t('production.orders.durationCalculationVersion'), order.durationCalculationVersion)}
          {snapshotCell(t('production.orders.snapshotFrozenAt'), order.snapshotFrozenAt ? new Date(order.snapshotFrozenAt).toLocaleString() : null)}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {historyLoading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
          <div>
            <div className="mb-2 font-semibold">{t('production.orders.transitions')}</div>
            <div className="space-y-2">
              {history?.transitions?.map((tr: any) => (
                <div key={tr.id} className="rounded border p-2 text-sm">
                  <span className="font-medium">{tr.fromStatus}</span> → <span className="font-medium">{tr.toStatus}</span> · {tr.action} · {new Date(tr.createdAt).toLocaleString()}
                  {tr.reason ? <div className="text-xs text-gray-600">{t('production.orders.reason')}: {tr.reason}</div> : null}
                </div>
              ))}
              {!historyLoading && !history?.transitions?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
            </div>
          </div>
          <div>
            <div className="mb-2 font-semibold">{t('production.orders.audits')}</div>
            <div className="space-y-2">
              {history?.audits?.map((a: any) => (
                <div key={a.id} className="rounded border p-2 text-sm">{a.action} · {new Date(a.createdAt).toLocaleString()}</div>
              ))}
              {!historyLoading && !history?.audits?.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'attachments' && (
        <div className="space-y-4">
          {can('attach') && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 font-semibold">{t('production.orders.uploadAttachment')}</div>
              <div className="flex flex-wrap items-end gap-3">
                <input type="file" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} className="block text-sm" />
                <Input value={attachmentDescription} onChange={(e) => setAttachmentDescription(e.target.value)} placeholder={t('production.orders.attachmentDescription')} />
                <Button onClick={uploadAttachment} loading={uploading} disabled={!attachmentFile}>{t('common.create')}</Button>
              </div>
            </div>
          )}
          {attachmentsLoading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <div>
                  <div className="font-medium">{a.attachment.originalName}</div>
                  <div className="text-xs text-gray-500">{a.attachment.mimeType} · {a.attachment.size} bytes · {new Date(a.attachment.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <a href={'/api' + ''} className="hidden" />
                  <Button variant="secondary" onClick={() => window.open('/admin/production/orders/' + id + '/attachments/' + a.attachmentId + '/download')}>{t('actions.view')}</Button>
                  {can('attach') && <Button variant="danger" onClick={() => deleteAttachment(a.attachmentId)}>{t('actions.delete')}</Button>}
                </div>
              </div>
            ))}
            {!attachmentsLoading && !attachments.length && <div className="text-sm text-gray-500">{t('common.noData')}</div>}
          </div>
        </div>
      )}

      <Modal open={Boolean(transition)} onClose={() => setTransition(null)} title={transitionTitle(transition?.action || '')}>
        <div className="space-y-4">
          <p>{transitionMessage(transition?.action || '')}</p>
          {transition?.reasonRequired && <Textarea label={t('production.orders.reason')} value={reason} onChange={(e) => setReason(e.target.value)} required />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTransition(null)}>{t('actions.cancel')}</Button>
            <Button onClick={runTransition} loading={acting} disabled={Boolean(transition?.reasonRequired && reason.trim().length < 3)}>{t('actions.confirm')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(readiness)} onClose={() => setReadiness(null)} title={t('production.orders.readiness')} size="lg">
        <div className="space-y-4">
          <div className={readiness?.ready ? 'rounded border border-green-200 bg-green-50 p-3 font-medium text-green-800' : 'rounded border border-red-200 bg-red-50 p-3 font-medium text-red-800'}>
            {readiness?.ready ? t('production.orders.ready') : t('production.orders.notReady')}
          </div>
          {readiness?.blockers?.length ? (
            <div>
              <div className="mb-1 font-semibold">{t('common.error')}</div>
              {readiness.blockers.map((b) => (
                <div key={b.code} className="text-sm text-red-700">{readinessText(b.code)}</div>
              ))}
            </div>
          ) : null}
          {readiness?.warnings?.length ? (
            <div>
              <div className="mb-1 font-semibold">{t('common.warnings')}</div>
              {readiness.warnings.map((w) => (
                <div key={w.code} className="text-sm text-amber-700">{readinessText(w.code)}</div>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}