'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useOperationalContext } from '../../lib/auth-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useApiErrorHandler } from '../admin/error-handler';
import { useToast } from '../admin/toast-provider';
import { Button, ConfirmDialog, Input, Modal, Pagination, Select, Textarea } from '../admin/ui';
import { AdminDataGrid, GridAction, GridColumn } from '../admin/admin-data-grid';
import {
  ActionAddIcon,
  ActionRefreshIcon,
  useRegisterAdminActions,
  useStableHandlers,
} from '../admin/admin-action-bar';
import { F9Lookup } from '../f9/F9Lookup';
import { warehouseAdapter } from '../f9/lookup-adapters';
import {
  emptyReceiptVoucher,
  formFromReceipt,
  newReceiptLineId,
  ReceiptAuthority,
  receiptAuthorityFor,
  receiptPayload,
  RECEIPT_TYPES,
  receiptSourceLabelKey,
  receiptTypeLabelKey,
  ReceiptType,
  ReceiptVoucherForm,
} from './receipt-voucher-form';
import { ReceiptVoucherDialog } from './receipt-voucher-dialog';

const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED'];
// Literal native endpoints keep the API route-contract audit statically resolvable.
const OPERATIONAL_ENDPOINT = '/inventory/operational-receipts';
const FINISHED_GOODS_ENDPOINT = '/production/finished-goods-receipts';

interface ReceiptRow {
  id: string;
  authority: ReceiptAuthority;
  documentNumber: string;
  receiptType: string | null;
  itemType: string | null;
  receiptSource: string | null;
  sourceDetail: string | null;
  status: string;
  documentDate: string;
  warehouseId: string;
  warehouse: { id: string; code: string; name: string } | null;
  location: { id: string; code: string; name: string } | null;
  lineCount: number;
  totalQuantity: number;
  productionOrderId: string | null;
  productionOrderNumber: string | null;
  productionRunId: string | null;
  productionRunNumber: string | null;
  movementNumber: string | null;
  reason: string | null;
  notes: string | null;
  deepLink: string;
}

interface Capabilities {
  canRead: { operational: boolean; productionFinishedGoods: boolean };
  canWrite: {
    operational: Record<string, boolean>;
    productionFinishedGoods: Record<string, boolean>;
  };
  receiptTypes: ReceiptType[];
}

interface DetailState {
  row: ReceiptRow;
  record: any;
}

type ReceiptAction = 'submit' | 'approve' | 'reject' | 'post' | 'cancel' | 'reverse';
type TransitionState = { row: ReceiptRow; action: ReceiptAction; requestId: string };

const DEFAULT_FILTERS = {
  receiptType: '',
  status: '',
  warehouseId: '',
  dateFrom: '',
  dateTo: '',
  search: '',
};

function authorityLabelKey(authority: ReceiptAuthority): string {
  return authority === 'OPERATIONAL'
    ? 'inventory.receiptVoucher.authorityOperational'
    : 'inventory.receiptVoucher.authorityProduction';
}

function actionLabelKey(action: ReceiptAction): string {
  return `inventory.receiptVoucher.${action}`;
}

export function ReceiptVouchersPanel() {
  const { t, dir } = useTranslation();
  const { contextVersion } = useOperationalContext();
  const handleError = useApiErrorHandler();
  const { showToast } = useToast();

  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [form, setForm] = useState<ReceiptVoucherForm | null>(null);
  const [editing, setEditing] = useState<ReceiptRow | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const requestVersion = useRef(0);

  const readable = Boolean(
    capabilities?.canRead.operational || capabilities?.canRead.productionFinishedGoods,
  );
  const createTypes = capabilities
    ? RECEIPT_TYPES.filter((type) => canCreate(type))
    : [];

  function groupFor(authority: ReceiptAuthority): 'operational' | 'productionFinishedGoods' {
    return authority === 'OPERATIONAL' ? 'operational' : 'productionFinishedGoods';
  }

  function can(action: string, authority: ReceiptAuthority): boolean {
    return Boolean(capabilities?.canWrite[groupFor(authority)]?.[action]);
  }

  function canCreate(type: ReceiptType): boolean {
    return can('create', receiptAuthorityFor(type));
  }

  const fetchCapabilities = useCallback(async () => {
    setCapabilitiesLoading(true);
    try {
      const response = await api.get<Capabilities>('/inventory/receipts/capabilities');
      setCapabilities(response);
    } catch (err) {
      setCapabilities({
        canRead: { operational: false, productionFinishedGoods: false },
        canWrite: { operational: {}, productionFinishedGoods: {} },
        receiptTypes: [],
      });
      handleError(err);
    } finally {
      setCapabilitiesLoading(false);
    }
  }, [handleError]);

  const fetchRows = useCallback(async (page = 1) => {
    if (!readable) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: ReceiptRow[]; meta: typeof meta }>('/inventory/receipts', {
        params: { ...filters, page, limit: 20 },
      });
      if (version === requestVersion.current) {
        setRows(response.data || []);
        setMeta(response.meta);
      }
    } catch (err) {
      if (version === requestVersion.current) {
        setRows([]);
        setError(t('inventory.receiptVoucher.errors.loadFailed'));
        handleError(err);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [readable, filters, handleError, t]);

  useEffect(() => {
    void fetchCapabilities();
  }, [fetchCapabilities]);

  useEffect(() => {
    const timer = setTimeout(() => { void fetchRows(); }, 250);
    return () => {
      clearTimeout(timer);
      requestVersion.current += 1;
    };
  }, [fetchRows]);

  useEffect(() => {
    requestVersion.current += 1;
    setRows([]);
    setForm(null);
    setEditing(null);
    setDetail(null);
    setTransition(null);
    setFilters(DEFAULT_FILTERS);
  }, [contextVersion]);

  const { exec } = useStableHandlers({
    new: () => { setEditing(null); setForm(emptyReceiptVoucher()); },
    refresh: () => fetchRows(meta.page),
  });

  useRegisterAdminActions([
    ...(createTypes.length ? [{
      id: 'new',
      labelKey: 'inventory.receiptVoucher.new',
      icon: <ActionAddIcon />,
      onClick: () => exec('new'),
    }] : []),
    {
      id: 'refresh',
      labelKey: 'common.refresh',
      icon: <ActionRefreshIcon />,
      readOnly: true,
      onClick: () => exec('refresh'),
    },
  ]);

  const save = async () => {
    if (!form?.receiptType || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const isFinishedGood = receiptAuthorityFor(form.receiptType) === 'PRODUCTION_FG';
      if (editing && isFinishedGood) {
        await api.patch(`${FINISHED_GOODS_ENDPOINT}/${editing.id}`, receiptPayload(form, true));
      } else if (editing) {
        await api.patch(`${OPERATIONAL_ENDPOINT}/${editing.id}`, receiptPayload(form, true));
      } else if (isFinishedGood) {
        await api.post(FINISHED_GOODS_ENDPOINT, receiptPayload(form));
      } else {
        await api.post(OPERATIONAL_ENDPOINT, receiptPayload(form));
      }
      showToast(t('common.saved'), 'success');
      setForm(null);
      setEditing(null);
      await fetchRows(meta.page);
    } catch (err) {
      handleError(err);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const loadRecord = async (row: ReceiptRow) =>
    api.get<any>(`/inventory/receipts/${row.authority}/${row.id}`);

  const openDetail = async (row: ReceiptRow) => {
    try {
      const record = await loadRecord(row);
      setDetail({ row, record });
    } catch (err) {
      handleError(err);
    }
  };

  const openEdit = async (row: ReceiptRow) => {
    if (row.status !== 'DRAFT' || !row.receiptType) return;
    try {
      const record = await loadRecord(row);
      setEditing(row);
      setForm(formFromReceipt(record));
    } catch (err) {
      handleError(err);
    }
  };

  const canTransition = (row: ReceiptRow, action: ReceiptAction): boolean => {
    if (!can(action, row.authority)) return false;
    if (row.authority === 'OPERATIONAL') {
      if (action === 'submit') return row.status === 'DRAFT';
      if (action === 'approve' || action === 'reject') return row.status === 'SUBMITTED';
      if (action === 'post') return row.status === 'APPROVED';
      if (action === 'cancel') return row.status === 'DRAFT' || row.status === 'SUBMITTED';
      return false;
    }
    if (action === 'post' || action === 'cancel') return row.status === 'DRAFT';
    if (action === 'reverse') return row.status === 'POSTED';
    return false;
  };

  const beginTransition = (row: ReceiptRow, action: ReceiptAction) => {
    setReason('');
    setTransition({ row, action, requestId: newReceiptLineId() });
  };

  const performTransition = async () => {
    if (!transition || savingRef.current) return;
    const requiresReason = transition.action === 'cancel' && transition.row.authority === 'PRODUCTION_FG';
    if (requiresReason && !reason.trim()) {
      showToast(t('inventory.receiptVoucher.reasonRequired'), 'error');
      return;
    }
    const { row, action, requestId } = transition;
    savingRef.current = true;
    setSaving(true);
    try {
      if (row.authority === 'OPERATIONAL') {
        if (action === 'submit') await api.post(`${OPERATIONAL_ENDPOINT}/${row.id}/submit`);
        else if (action === 'approve') await api.post(`${OPERATIONAL_ENDPOINT}/${row.id}/approve`);
        else if (action === 'reject') await api.post(`${OPERATIONAL_ENDPOINT}/${row.id}/reject`);
        else if (action === 'post') await api.post(`${OPERATIONAL_ENDPOINT}/${row.id}/post`);
        else if (action === 'cancel') await api.post(`${OPERATIONAL_ENDPOINT}/${row.id}/cancel`);
      } else if (action === 'reverse') {
        await api.post(`${FINISHED_GOODS_ENDPOINT}/${row.id}/reverse`, {
          requestId,
          notes: reason.trim() || undefined,
        });
      } else if (action === 'cancel') {
        await api.patch(`${FINISHED_GOODS_ENDPOINT}/${row.id}/cancel`, { reason: reason.trim() });
      } else if (action === 'post') {
        await api.patch(`${FINISHED_GOODS_ENDPOINT}/${row.id}/post`);
      }
      showToast(t('common.saved'), 'success');
      setTransition(null);
      await fetchRows(meta.page);
    } catch (err) {
      handleError(err);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const sourceLabel = (row: ReceiptRow): string => {
    if (row.receiptSource) return t(receiptSourceLabelKey(row.receiptSource as any));
    if (row.sourceDetail) return row.sourceDetail;
    return t('inventory.receiptVoucher.sourceNotSpecified');
  };

  const columns: GridColumn<ReceiptRow>[] = [
    {
      key: 'documentNumber',
      header: t('inventory.receiptVoucher.documentNumber'),
      render: (row) => <span className="font-medium" dir="ltr">{row.documentNumber}</span>,
    },
    {
      key: 'receiptType',
      header: t('inventory.receiptVoucher.type'),
      render: (row) => row.receiptType
        ? t(receiptTypeLabelKey(row.receiptType as ReceiptType))
        : t('inventory.receiptVoucher.typeLegacy'),
    },
    {
      key: 'authority',
      header: t('inventory.receiptVoucher.authority'),
      render: (row) => t(authorityLabelKey(row.authority)),
    },
    { key: 'warehouse', header: t('inventory.receiptVoucher.warehouse'), render: (row) => row.warehouse?.name || '-' },
    { key: 'source', header: t('inventory.receiptVoucher.source'), render: sourceLabel },
    {
      key: 'order',
      header: t('inventory.receiptVoucher.order'),
      render: (row) => row.productionOrderNumber || '-',
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs">{t(`status.${row.status}`)}</span>,
    },
    {
      key: 'documentDate',
      header: t('inventory.receiptVoucher.date'),
      render: (row) => new Date(row.documentDate).toLocaleDateString(),
    },
    {
      key: 'quantity',
      header: t('inventory.receiptVoucher.totalQuantity'),
      render: (row) => String(row.totalQuantity ?? 0),
    },
  ];

  const gridActions: GridAction<ReceiptRow>[] = [
    {
      label: t('common.view'),
      onClick: (row) => void openDetail(row),
      enabled: (row) => Boolean(capabilities?.canRead[groupFor(row.authority)]),
    },
    {
      label: t('common.edit'),
      onClick: (row) => void openEdit(row),
      enabled: (row) => can('update', row.authority) && row.status === 'DRAFT' && Boolean(row.receiptType),
    },
    {
      label: t(actionLabelKey('submit')),
      onClick: (row) => beginTransition(row, 'submit'),
      enabled: (row) => canTransition(row, 'submit'),
    },
    {
      label: t(actionLabelKey('approve')),
      onClick: (row) => beginTransition(row, 'approve'),
      enabled: (row) => canTransition(row, 'approve'),
    },
    {
      label: t(actionLabelKey('reject')),
      onClick: (row) => beginTransition(row, 'reject'),
      enabled: (row) => canTransition(row, 'reject'),
    },
    {
      label: t(actionLabelKey('post')),
      onClick: (row) => beginTransition(row, 'post'),
      enabled: (row) => canTransition(row, 'post'),
    },
    {
      label: t(actionLabelKey('reverse')),
      onClick: (row) => beginTransition(row, 'reverse'),
      enabled: (row) => canTransition(row, 'reverse'),
    },
    {
      label: t(actionLabelKey('cancel')),
      onClick: (row) => beginTransition(row, 'cancel'),
      enabled: (row) => canTransition(row, 'cancel'),
      variant: 'danger',
    },
  ];

  const detailLines: any[] = Array.isArray(detail?.record?.lines) ? detail.record.lines : [];

  return <div className="space-y-4">
    {capabilitiesLoading && <p role="status">{t('common.loading')}</p>}
    {!capabilitiesLoading && !readable && <p role="status">{t('inventory.receiptVoucher.noReadPermission')}</p>}
    {readable && <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Select
          label={t('inventory.receiptVoucher.type')}
          value={filters.receiptType}
          placeholder={t('inventory.receiptVoucher.allTypes')}
          options={RECEIPT_TYPES.map((type) => ({ value: type, label: t(receiptTypeLabelKey(type)) }))}
          onChange={(event) => setFilters({ ...filters, receiptType: event.target.value })}
        />
        <Select
          label={t('common.status')}
          value={filters.status}
          placeholder={t('inventory.receiptVoucher.allStatuses')}
          options={STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
          onChange={(event) => setFilters({ ...filters, status: event.target.value })}
        />
        <F9Lookup
          label={t('inventory.receiptVoucher.warehouse')}
          adapter={warehouseAdapter}
          value={filters.warehouseId}
          onChange={(warehouseId) => setFilters({ ...filters, warehouseId })}
        />
        <Input label={t('inventory.receiptVoucher.dateFrom')} type="date" value={filters.dateFrom}
          onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
        <Input label={t('inventory.receiptVoucher.dateTo')} type="date" value={filters.dateTo}
          onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
      </div>

      <AdminDataGrid
        columns={columns}
        data={rows}
        keyExtractor={(row) => `${row.authority}:${row.id}`}
        loading={loading}
        error={error || undefined}
        emptyMessage={t('common.noData')}
        onRetry={() => void fetchRows(meta.page)}
        dir={dir}
        globalSearch={filters.search}
        onGlobalSearch={(search) => setFilters({ ...filters, search })}
        searchPlaceholder={t('common.search')}
        onRefresh={() => void fetchRows(meta.page)}
        refreshLoading={loading}
        actions={gridActions}
      />
      <Pagination page={meta.page} total={meta.total} totalPages={meta.totalPages}
        onPageChange={(page) => void fetchRows(page)} />
    </>}

    {form && <ReceiptVoucherDialog
      key={`${contextVersion}:${editing?.id || 'new'}`}
      form={form}
      onChange={setForm}
      types={editing && form.receiptType ? [form.receiptType] : createTypes}
      edit={Boolean(editing)}
      saving={saving}
      onSave={save}
      onClose={() => { if (!saving) { setForm(null); setEditing(null); } }}
    />}

    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={t('inventory.receiptVoucher.detail')} size="lg">
      {detail && <div className="space-y-4">
        <p className="font-medium" dir="ltr">{detail.row.documentNumber}</p>
        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <p>{t(authorityLabelKey(detail.row.authority))}</p>
          <p>{detail.row.receiptType ? t(receiptTypeLabelKey(detail.row.receiptType as ReceiptType)) : t('inventory.receiptVoucher.typeLegacy')}</p>
          <p>{detail.row.warehouse?.name || '-'}</p>
          <p>{sourceLabel(detail.row)}</p>
          <p>{detail.row.productionOrderNumber || '-'}</p>
          <p>{detail.row.productionRunNumber || '-'}</p>
          <p>{detail.row.movementNumber || '-'}</p>
          <p>{t(`status.${detail.row.status}`)}</p>
        </div>
        {detail.row.reason && <p>{detail.row.reason}</p>}
        {detail.row.notes && <p>{detail.row.notes}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead><tr>
              <th>{t('inventory.receiptVoucher.product')}</th>
              <th>{t('inventory.receiptVoucher.quantity')}</th>
              <th>{t('inventory.receiptVoucher.unit')}</th>
              <th>{t('inventory.receiptVoucher.batch')}</th>
              <th>{t('inventory.receiptVoucher.serial')}</th>
              <th>{t('inventory.receiptVoucher.expiry')}</th>
            </tr></thead>
            <tbody>
              {detailLines.map((line: any) => <tr key={line.id || line.productId}>
                <td>{line.productName || line.productCode || line.productId || '-'}</td>
                <td>{String(line.quantity ?? '')}</td>
                <td>{line.unit || '-'}</td>
                <td>{line.batchNumber || '-'}</td>
                <td>{line.serialNumber || '-'}</td>
                <td>{line.expiryDate ? String(line.expiryDate).slice(0, 10) : '-'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <Link className="text-blue-600 underline" href={detail.row.deepLink}>
          {t('inventory.receiptVoucher.openNative')}
        </Link>
      </div>}
    </Modal>

    <ConfirmDialog
      open={Boolean(transition)}
      title={t(transition ? actionLabelKey(transition.action) : 'common.confirm')}
      message={t('inventory.receiptVoucher.confirmTransition')}
      loading={saving}
      onClose={() => { if (!saving) setTransition(null); }}
      onConfirm={() => void performTransition()}
    >
      {transition && (transition.action === 'cancel' || transition.action === 'reverse') && (
        <Textarea
          label={t('inventory.receiptVoucher.reason')}
          required={transition.action === 'cancel' && transition.row.authority === 'PRODUCTION_FG'}
          value={reason}
          maxLength={2000}
          onChange={(event) => setReason(event.target.value)}
        />
      )}
    </ConfirmDialog>
  </div>;
}
