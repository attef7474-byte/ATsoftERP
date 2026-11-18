'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ActionsMenu } from '../admin/datagrid/actions-menu';
import { translateAuditAction } from '../../lib/i18n/literals';
import { api } from '../../lib/api';
import { useAuth, useOperationalContext } from '../../lib/auth-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useApiErrorHandler } from '../admin/error-handler';
import { useToast } from '../admin/toast-provider';
import { Button, ConfirmDialog, Input, Modal, Pagination, Select, Textarea } from '../admin/ui';
import { AdminDataGrid, GridAction, GridColumn } from '../admin/admin-data-grid';
import { ActionAddIcon, ActionRefreshIcon, useRegisterAdminActions, useStableHandlers } from '../admin/admin-action-bar';
import { F9Lookup } from '../f9/F9Lookup';
import { warehouseAdapter } from '../f9/lookup-adapters';
import { emptyIssueVoucher, formFromIssue, issueEndpoint, issuePayload, issuePermissionPrefix, ISSUE_TYPES, IssueAuthority, IssueType, IssueVoucherForm } from './issue-voucher-form';
import { IssueVoucherDialog } from './issue-voucher-dialog';
import { newIssueClientId } from '../../app/admin/inventory/finished-goods-issues/_components/lines-editor';
interface IssueRow {
  key: string;
  type: IssueType;
  authority: IssueAuthority;
  entityId: string;
  parentEntityId: string | null;
  reference: string;
  title: string | null;
  status: string;
  requestedByName: string | null;
  requestedById: string | null;
  warehouse: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdAt: string;
  documentDate: string;
  sourceType: string | null;
}
const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED', 'RESERVED', 'USED'];
type Transition = 'submit' | 'withdraw' | 'cancel-approval' | 'cancel' | 'post' | 'reverse';
function isStandaloneSpare(row: Pick<IssueRow, 'type' | 'authority'>): boolean {
  return row.type === 'SPARE_PART' && row.authority === 'SPARE_PART_ISSUE';
}
function isLinkedSpare(row: Pick<IssueRow, 'type' | 'authority'>): boolean {
  return row.type === 'SPARE_PART' && !isStandaloneSpare(row);
}
/** Native flat-authority DTOs require a reason for these transitions. */
export function reasonRequired(action: string, row: Pick<IssueRow, 'type' | 'authority'>): boolean {
  if (isLinkedSpare(row)) return false;
  return ['cancel', 'reject', 'cancel-approval'].includes(action);
}
function nativePath(row: IssueRow): string {
  if (row.authority === 'SPARE_PART_ISSUE') return `/inventory/spare-part-issues/${row.entityId}`;
  return `${issueEndpoint(row.type, row.parentEntityId || '')}/${row.entityId}`;
}
function auditEntity(row: IssueRow): string {
  if (row.authority === 'SPARE_PART_ISSUE') return 'SparePartIssue';
  if (row.type === 'SPARE_PART') return 'MaintenanceRequestRequiredPart';
  return row.type === 'RAW_MATERIAL' ? 'ProductionMaterialDocument' : 'FinishedGoodsIssue';
}
export function IssueVouchersPanel() {
  const {
    t,
    dir,
    locale
  } = useTranslation();
  const {
    permissions,
    isSuperAdmin
  } = useAuth();
  const {
    contextVersion
  } = useOperationalContext();
  const handleError = useApiErrorHandler();
  const {
    showToast
  } = useToast();
  const can = useCallback((type: IssueType, action: string, authority?: IssueAuthority) => {
    if (isSuperAdmin) return true;
    const granted = (prefix: string) => Boolean(permissions?.permissions.includes(`${prefix}:${action}`));
    if (authority === 'SPARE_PART_ISSUE' || authority === 'MAINTENANCE_REQUEST_PART') return granted(issuePermissionPrefix(type, authority));
    // Creation and list filters run before a row (and therefore its authority)
    // exists. With no maintenance request, spare parts can be created through
    // either the linked or the standalone authority; the backend decides.
    if (type === 'SPARE_PART' && !authority) return granted('maintenance-request-parts') || granted('spare-part-issue');
    return granted(issuePermissionPrefix(type, authority));
  }, [isSuperAdmin, permissions]);
  const scopedWarehouseAdapter = {
    ...warehouseAdapter,
    endpoint: '/inventory/issues/warehouses',
    detailFilters: true
  };
  const createTypes = ISSUE_TYPES.filter(type => can(type, 'create'));
  const readable = ISSUE_TYPES.some(type => can(type, 'read'));
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    warehouseId: '',
    requesterId: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  const [form, setForm] = useState<IssueVoucherForm | null>(null);
  const [editing, setEditing] = useState<IssueRow | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [detail, setDetail] = useState<{
    row: IssueRow;
    record: any;
    history: any[];
  } | null>(null);
  const [transition, setTransition] = useState<{
    row: IssueRow;
    action: Transition;
    requestId: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [selectedRequester, setSelectedRequester] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const requesterOptions = [...new Map(rows.filter(row => row.requestedById && row.requestedByName).map(row => [row.requestedById!, {
    value: row.requestedById!,
    label: row.requestedByName!
  }])).values()];
  if (selectedRequester && !requesterOptions.some(option => option.value === selectedRequester.value)) requesterOptions.push(selectedRequester);
  const requestVersion = useRef(0);
  const contextRef = useRef(contextVersion);
  contextRef.current = contextVersion;
  const fetchRows = useCallback(async (page = 1) => {
    if (!readable) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{
        data: IssueRow[];
        meta: typeof meta;
      }>('/inventory/issues', {
        params: {
          ...filters,
          page,
          limit: 20
        }
      });
      if (version === requestVersion.current) {
        setRows(response.data);
        setMeta(response.meta);
      }
    } catch (err) {
      if (version === requestVersion.current) {
        setRows([]);
        setError(t('inventory.finishedGoodsIssue.errors.loadFailed'));
        handleError(err);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [readable, filters, contextVersion, t, handleError]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRows();
    }, 250);
    return () => {
      clearTimeout(timer);
      requestVersion.current += 1;
    };
  }, [fetchRows]);
  useEffect(() => {
    setRows([]);
    setForm(null);
    setEditing(null);
    setDetail(null);
    setTransition(null);
    setSelectedRequester(null);
    setFilters({
      type: '',
      status: '',
      warehouseId: '',
      requesterId: '',
      dateFrom: '',
      dateTo: '',
      search: ''
    });
  }, [contextVersion]);
  const {
    exec
  } = useStableHandlers({
    new: () => {
      setEditing(null);
      setForm(emptyIssueVoucher());
    },
    refresh: () => fetchRows(meta.page)
  });
  useRegisterAdminActions([...(createTypes.length ? [{
    id: 'new',
    labelKey: 'inventory.issueVoucher.new',
    icon: <ActionAddIcon />,
    onClick: () => exec('new')
  }] : []), {
    id: 'refresh',
    labelKey: 'common.refresh',
    icon: <ActionRefreshIcon />,
    readOnly: true,
    onClick: () => exec('refresh')
  }]);
  const save = async () => {
    if (!form?.issueType || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      // issueEndpoint never emits an empty maintenanceRequestId: without one,
      // spare parts are created through the native standalone endpoint.
      const path = issueEndpoint(form.issueType, form.maintenanceRequestId);
      if (editing) await api.patch(`${path}/${editing.entityId}`, issuePayload(form, true));else await api.post(path, issuePayload(form));
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
  const load = async (row: IssueRow, edit: boolean) => {
    const version = contextRef.current;
    setLoading(true);
    try {
      const response = await api.get<{
        data: any;
      }>(nativePath(row));
      if (version !== contextRef.current) return;
      const record = response.data;
      if (edit) {
        if (record.status !== 'DRAFT') {
          showToast(t('inventory.issueVoucher.draftOnly'), 'error');
          return;
        }
        setEditing(row);
        setForm(formFromIssue(row.type, record, isLinkedSpare(row) ? row.parentEntityId || undefined : undefined));
      } else {
        setDetail({
          row,
          record,
          history: []
        });
        if (isSuperAdmin || permissions?.permissions.includes('audit:read')) {
          const logs = await api.get<{
            data: any[];
          }>('/audit-logs', {
            params: {
              entity: auditEntity(row),
              search: row.entityId,
              limit: 20
            }
          });
          if (version === contextRef.current) setDetail({
            row,
            record,
            history: logs.data.filter(log => log.entityId === row.entityId)
          });
        }
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };
  const performTransition = async () => {
    if (!transition || savingRef.current) return;
    if (reasonRequired(transition.action, transition.row) && !reason.trim()) {
      showToast(t('inventory.finishedGoodsIssue.errors.reasonRequired'), 'error');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const {
        row,
        action
      } = transition;
      // The maintenance 'request' suffix is exclusive to linked spare-part
      // lines. Every other authority uses its native workflow suffix.
      const suffix = isLinkedSpare(row) && action === 'submit' ? 'request' : action;
      const trimmedReason = reason.trim();
      if (action === 'reverse') await api.post(`${nativePath(row)}/reverse`, {
        requestId: transition.requestId,
        notes: trimmedReason || undefined
      });else await api.patch(`${nativePath(row)}/${suffix}`, isLinkedSpare(row) ? undefined : {
        ...(trimmedReason ? {
          reason: trimmedReason
        } : {})
      });
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
  const beginTransition = (row: IssueRow, action: Transition) => {
    setReason('');
    setTransition({
      row,
      action,
      requestId: newIssueClientId()
    });
  };
  const status = (value: string) => t(`inventory.issueVoucher.status${value === 'REQUESTED' ? 'SUBMITTED' : value}`);
  const columns: GridColumn<IssueRow>[] = [{
    key: 'reference',
    header: t('inventory.finishedGoodsIssue.issueNumber'),
    render: row => row.reference
  }, {
    key: 'type',
    header: t('inventory.issueVoucher.type'),
    render: row => t(`inventory.warehouseApprovals.type${row.type}`)
  }, {
    key: 'warehouse',
    header: t('inventory.finishedGoodsIssue.issueWarehouse'),
    render: row => row.warehouse?.name || '-'
  }, {
    key: 'title',
    header: t('inventory.finishedGoodsIssue.purpose'),
    render: row => row.title || '-'
  }, {
    key: 'requestedByName',
    header: t('inventory.issueVoucher.requester'),
    render: row => row.requestedByName || '-'
  }, {
    key: 'status',
    header: t('inventory.finishedGoodsIssue.status'),
    render: row => status(row.status)
  }, {
    key: 'createdAt',
    header: t('inventory.finishedGoodsIssue.issueDate'),
    render: row => new Date(row.documentDate || row.createdAt).toLocaleDateString()
  }];
  const actions: GridAction<IssueRow>[] = [{
    label: t('inventory.finishedGoodsIssue.view'),
    onClick: row => void load(row, false),
    enabled: row => can(row.type, 'read', row.authority)
  }, {
    label: t('inventory.finishedGoodsIssue.edit'),
    onClick: row => void load(row, true),
    enabled: row => can(row.type, 'update', row.authority) && row.status === 'DRAFT' && row.sourceType !== 'REVERSE'
  }, {
    label: t('inventory.finishedGoodsIssue.submit'),
    onClick: row => beginTransition(row, 'submit'),
    enabled: row => can(row.type, isLinkedSpare(row) ? 'request' : 'submit', row.authority) && row.status === 'DRAFT'
  }, {
    label: t('inventory.finishedGoodsIssue.withdraw'),
    onClick: row => beginTransition(row, 'withdraw'),
    enabled: row => can(row.type, isLinkedSpare(row) ? 'request' : 'withdraw', row.authority) && ['SUBMITTED', 'REQUESTED'].includes(row.status)
  }, {
    label: t('inventory.finishedGoodsIssue.cancelApproval'),
    onClick: row => beginTransition(row, 'cancel-approval'),
    enabled: row => !isLinkedSpare(row) && can(row.type, 'cancel-approval', row.authority) && row.status === 'APPROVED'
  }, {
    label: t('inventory.finishedGoodsIssue.post'),
    onClick: row => beginTransition(row, 'post'),
    enabled: row => !isLinkedSpare(row) && can(row.type, 'post', row.authority) && row.status === 'APPROVED'
  }, {
    label: t('inventory.finishedGoodsIssue.cancel'),
    onClick: row => beginTransition(row, 'cancel'),
    enabled: row => can(row.type, 'cancel', row.authority) && ['DRAFT', 'SUBMITTED', 'REQUESTED', 'REJECTED'].includes(row.status),
    variant: 'danger'
  }, {
    label: t('inventory.finishedGoodsIssue.reverse'),
    onClick: row => beginTransition(row, 'reverse'),
    enabled: row => row.type !== 'SPARE_PART' && can(row.type, 'reverse', row.authority) && row.status === 'POSTED' && row.sourceType !== 'REVERSE'
  }];
  return <div className="space-y-4">
    {!readable && <p role="status">{t('inventory.issueVoucher.noReadPermission')}</p>}
    {readable && <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Select label={t('inventory.issueVoucher.type')} value={filters.type} placeholder={t('inventory.warehouseApprovals.allTypes')} options={ISSUE_TYPES.filter(type => can(type, 'read')).map(type => ({
          value: type,
          label: t(`inventory.warehouseApprovals.type${type}`)
        }))} onChange={event => setFilters({
          ...filters,
          type: event.target.value
        })} />
        <Select label={t('inventory.finishedGoodsIssue.status')} value={filters.status} placeholder={t('inventory.finishedGoodsIssue.allStatuses')} options={STATUSES.map(value => ({
          value,
          label: status(value)
        }))} onChange={event => setFilters({
          ...filters,
          status: event.target.value
        })} />
        <F9Lookup label={t('inventory.finishedGoodsIssue.issueWarehouse')} adapter={scopedWarehouseAdapter} filters={filters.type ? {
          type: filters.type
        } : {}} value={filters.warehouseId} onChange={warehouseId => setFilters({
          ...filters,
          warehouseId
        })} />
        <Select label={t('inventory.issueVoucher.requester')} value={filters.requesterId} placeholder={t('inventory.issueVoucher.allRequesters')} options={requesterOptions} onChange={event => {
          const requesterId = event.target.value;
          setSelectedRequester(requesterOptions.find(option => option.value === requesterId) || null);
          setFilters({
            ...filters,
            requesterId
          });
        }} />
        <Input label={t('inventory.issueVoucher.dateFrom')} type="date" value={filters.dateFrom} onChange={event => setFilters({
          ...filters,
          dateFrom: event.target.value
        })} />
        <Input label={t('inventory.issueVoucher.dateTo')} type="date" value={filters.dateTo} onChange={event => setFilters({
          ...filters,
          dateTo: event.target.value
        })} />
      </div>
      <AdminDataGrid columns={[...columns, {
        key: 'actions',
        header: t('common.actions'),
        render: row => <IssueRowActions row={row} actions={actions.filter(action => typeof action.enabled === 'function' ? action.enabled(row) : action.enabled !== false)} />
      }]} data={rows} keyExtractor={row => row.key} loading={loading} error={error || undefined} emptyMessage={t('common.noData')} onRetry={() => void fetchRows(meta.page)} dir={dir} globalSearch={filters.search} onGlobalSearch={search => setFilters({
        ...filters,
        search
      })} onRefresh={() => void fetchRows(meta.page)} />
      <Pagination page={meta.page} total={meta.total} totalPages={meta.totalPages} onPageChange={page => void fetchRows(page)} />
    </>}
    {form && <IssueVoucherDialog key={`${contextVersion}:${editing?.key || 'new'}`} form={form} onChange={setForm} types={editing ? [editing.type] : createTypes} edit={Boolean(editing)} saving={saving} onSave={save} onClose={() => {
      if (!saving) {
        setForm(null);
        setEditing(null);
      }
    }} />}
    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={t('inventory.finishedGoodsIssue.detail')} size="lg">
      {detail && <div className="space-y-4">
        <p className="font-medium">{detail.row.reference} · {t(`inventory.warehouseApprovals.type${detail.row.type}`)} · {status(detail.record.status)}</p>
        <p>{detail.record.issueWarehouse?.name || detail.row.warehouse?.name || '-'}</p>
        <p>{detail.record.purpose || detail.record.reason || detail.record.notes || detail.record.usageNote || ''}</p>
        <div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr><th>{t('inventory.finishedGoodsIssue.product')}</th><th>{t('inventory.finishedGoodsIssue.quantity')}</th><th>{t('inventory.finishedGoodsIssue.unit')}</th><th>{t('inventory.finishedGoodsIssue.warehouseLocation')}</th><th>{t('inventory.issueVoucher.stockIdentity')}</th></tr></thead><tbody>
          {(isStandaloneSpare(detail.row) || detail.row.type !== 'SPARE_PART' ? detail.record.lines || [] : [detail.record]).map((line: any) => <tr key={line.id || line.sparePartId || line.productId}><td>{line.product?.name || line.sparePart?.name || line.productNameSnapshot || '-'}</td><td>{String(line.quantity)}</td><td>{line.unit}</td><td>{line.warehouseLocation?.name || '-'}</td><td>{[line.batchNumber, line.serialNumber, line.expiryDate?.slice(0, 10)].filter(Boolean).join(' · ') || '-'}</td></tr>)}
        </tbody></table></div>
        {isLinkedSpare(detail.row) && <Link className="text-blue-600 underline" href="/admin/maintenance/spare-part-issues">{t('inventory.issueVoucher.spareActions')}</Link>}
        <h3 className="font-medium">{t('inventory.finishedGoodsIssue.history')}</h3>
        {detail.history.map(log => <p key={log.id} className="text-sm">{translateAuditAction(log.action, locale)} · {log.user?.name || '-'} · {new Date(log.createdAt).toLocaleString()}</p>)}
      </div>}
    </Modal>
    <ConfirmDialog open={Boolean(transition)} title={t(`inventory.finishedGoodsIssue.${transition?.action === 'cancel-approval' ? 'cancelApproval' : transition?.action || 'submit'}`)} message={t('inventory.issueVoucher.confirmTransition')} loading={saving} onClose={() => {
      if (!saving) setTransition(null);
    }} onConfirm={performTransition}>
      {transition && ['cancel', 'reject', 'withdraw', 'reverse', 'cancel-approval'].includes(transition.action) && !isLinkedSpare(transition.row) && <Textarea label={t('inventory.finishedGoodsIssue.reason')} required={reasonRequired(transition.action, transition.row)} value={reason} onChange={event => setReason(event.target.value)} />}
    </ConfirmDialog>
  </div>;
}
function IssueRowActions({
  row,
  actions
}: {
  row: IssueRow;
  actions: GridAction<IssueRow>[];
}) {
  const {
    t,
    dir
  } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (!actions.length) return null;
  return <div><button type="button" ref={buttonRef} className="rounded-lg border px-3 py-1 text-sm" onClick={() => setOpen(!open)}>{t('common.actions')}</button>
    {open && <ActionsMenu item={row} actions={actions} isRtl={dir === 'rtl'} buttonRef={buttonRef} onClose={() => setOpen(false)} />}
  </div>;
}
