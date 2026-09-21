'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { translateUnit } from '../../../../../lib/i18n/literals';
import { allocationAmountText, canFinalizeAllocation, AllocationPage, OverheadAllocation, OverheadAllocationLine, OverheadAllocationPreview } from '../../../../../lib/overhead-allocation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { AdminDataGrid, GridColumn } from '../../../../../components/admin/datagrid';
import { Button, Input, Select, Pagination, PageHeader, Modal, Textarea } from '../../../../../components/admin/ui';

const ROOT = '/production/overhead-allocations';
type Period = { id: string; code: string; periodFrom: string; periodTo: string };
type Source = { sourceEntryId: string; sourceEntry: { reference: string; costPurpose: string; amount: string; currencyCode: string } };
type History = { id: string; action: string; createdAt: string };
type Can = (action: string) => boolean;

/** Read requests are aborted on navigation/context change; obsolete responses never replace current data. */
function useRead<T>(path: string | null, fetcher: (signal: AbortSignal) => Promise<T>, revision = 0) {
  const [result, setResult] = useState<{ path: string; revision: number; value: T } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const handler = useApiErrorHandler();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  useEffect(() => {
    setResult(null); setFailed(false);
    if (!path) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    fetcherRef.current(controller.signal).then(value => {
      if (!controller.signal.aborted) setResult({ path, revision, value });
    }).catch(error => {
      if (!controller.signal.aborted) { setFailed(true); handlerRef.current(error); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  const data = result?.path === path && result.revision === revision ? result.value : null;
  return { data, loading, failed };
}

export default function OverheadAllocationsPage() {
  const { t, dir } = useTranslation();
  const auth = useAuth();
  const can: Can = action => auth.isSuperAdmin || Boolean(auth.permissions?.permissions.includes('production-cost-overhead-allocation:' + action));
  if (auth.loading || auth.contextLoading) return <p>{t('common.loading')}</p>;
  if (!can('read')) return <p role="alert">{t('errors.forbidden')}</p>;
  if (!auth.contextReady || !auth.activeContext?.companyId || !auth.activeContext?.branchId) return <p role="alert">{t('overheadAllocation.contextRequired')}</p>;
  return <div dir={dir}><Workspace key={auth.contextVersion} can={can} /></div>;
}

function Workspace({ can }: { can: Can }) {
  const { t, locale, dir } = useTranslation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const statusQuery = status === 'DRAFT' || status === 'FINAL' ? `&status=${status}` : '';
  const result = useRead<AllocationPage<OverheadAllocation>>(`${ROOT}?page=${page}&limit=20&search=${encodeURIComponent(search)}${statusQuery}`,
    signal => api.get<AllocationPage<OverheadAllocation>>(`${ROOT}?page=${page}&limit=20&search=${encodeURIComponent(search)}${statusQuery}`, { signal }), revision);
  const refresh = () => setRevision(value => value + 1);
  const columns: GridColumn<OverheadAllocation>[] = [
    { key: 'period', header: t('overheadAllocation.period'), render: row => row.period.code },
    { key: 'status', header: t('common.status'), render: row => t(row.status === 'FINAL' ? 'overheadAllocation.final' : 'overheadAllocation.draft') },
    { key: 'currency', header: t('overheadAllocation.currency'), render: row => row.currencyCode },
    { key: 'lines', header: t('overheadAllocation.lines'), render: row => row._count.lines },
    { key: 'finalizedAt', header: t('overheadAllocation.date'), render: row => row.finalizedAt ? new Date(row.finalizedAt).toLocaleString(locale) : '—' },
  ];
  return <>
    <PageHeader title={t('overheadAllocation.title')} subtitle={t('overheadAllocation.description')}
      actions={can('create') && <Button onClick={() => setCreating(true)}>{t('overheadAllocation.create')}</Button>} />
    <div className="mb-4 flex flex-wrap gap-3">
      <Input label={t('overheadAllocation.periodSearch')} value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setPage(1); }} />
      <Select label={t('common.status')} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} options={[
        { value: '', label: t('overheadAllocation.all') }, { value: 'DRAFT', label: t('overheadAllocation.draft') }, { value: 'FINAL', label: t('overheadAllocation.final') },
      ]} />
    </div>
    <AdminDataGrid columns={columns} data={result.data?.data ?? []} keyExtractor={row => row.id} dir={dir}
      loading={result.loading} loadingMessage={t('common.loading')} emptyMessage={t('overheadAllocation.empty')}
      error={result.failed ? t('errors.loadFailed') : undefined} onRetry={refresh} onRefresh={refresh}
      actions={[{ label: t('actions.view'), onClick: row => setSelected(row.id) }]} />
    {result.data && <Pagination {...result.data.meta} onPageChange={setPage} />}
    {creating && <CreateDraft onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setSelected(id); refresh(); }} />}
    {selected && <AllocationDetails key={selected} id={selected} can={can} onClose={() => { setSelected(''); refresh(); }} />}
  </>;
}

function CreateDraft({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const handleError = useApiErrorHandler();
  const [requestId] = useState(() => crypto.randomUUID());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [period, setPeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const periods = useRead<AllocationPage<Period>>(`${ROOT}/eligible-periods?page=${page}&limit=20&search=${encodeURIComponent(search)}`,
    signal => api.get<AllocationPage<Period>>(`${ROOT}/eligible-periods?page=${page}&limit=20&search=${encodeURIComponent(search)}`, { signal }), revision);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !period) return;
    lock.current = true; setBusy(true);
    try {
      const row = await api.post<OverheadAllocation>(ROOT, { periodId: period, notes, clientRequestId: requestId });
      if (alive.current) onCreated(row.id);
    } catch (error) { if (alive.current) handleError(error); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <Modal open title={t('overheadAllocation.create')} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={create} className="space-y-4">
      <Input label={t('overheadAllocation.periodSearch')} maxLength={100} value={search} disabled={busy} onChange={event => { setSearch(event.target.value); setPage(1); setPeriod(''); }} />
      {periods.loading && <p role="status">{t('common.loading')}</p>}
      {periods.failed && <Button type="button" onClick={() => setRevision(value => value + 1)}>{t('common.refresh')}</Button>}
      {!periods.loading && !periods.failed && periods.data?.data.length === 0 && <p>{t('overheadAllocation.noPeriods')}</p>}
      <Select label={t('overheadAllocation.period')} placeholder={t('overheadAllocation.selectPeriod')} required value={period} disabled={busy || periods.loading}
        options={(periods.data?.data ?? []).map(row => ({ value: row.id, label: row.code }))} onChange={event => setPeriod(event.target.value)} />
      {periods.data && !busy && <Pagination {...periods.data.meta} onPageChange={value => { setPage(value); setPeriod(''); }} />}
      <Textarea label={t('overheadAllocation.notes')} maxLength={2000} value={notes} disabled={busy} onChange={event => setNotes(event.target.value)} />
      <div className="flex gap-3"><Button type="submit" disabled={!period || periods.loading || periods.failed} loading={busy}>{t('overheadAllocation.create')}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button></div>
    </form>
  </Modal>;
}

function AllocationDetails({ id, can, onClose }: { id: string; can: Can; onClose: () => void }) {
  const { t, locale, dir } = useTranslation();
  const handleError = useApiErrorHandler();
  const { showToast } = useToast();
  const [revision, setRevision] = useState(0);
  const header = useRead<OverheadAllocation>(`${ROOT}/${id}`,
    signal => api.get<OverheadAllocation>(`${ROOT}/${id}`, { signal }), revision);
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<OverheadAllocationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState('lines');
  const [page, setPage] = useState(1);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (header.data) setNotes(header.data.notes ?? ''); }, [header.data]);
  const row = header.data;
  const evidence = useRead<AllocationPage<OverheadAllocationLine | Source | History>>(
    row && (row.status === 'FINAL' || tab === 'history') ? `${ROOT}/${id}/${tab}?page=${page}&limit=20` : null,
    signal => api.get<AllocationPage<OverheadAllocationLine | Source | History>>(`${ROOT}/${id}/${tab}?page=${page}&limit=20`, { signal }), revision);
  async function mutate(action: 'save' | 'calculate' | 'finalize', previewPage = 1) {
    if (lock.current || !row) return;
    lock.current = true; setBusy(true);
    if (action === 'calculate') setPreview(null);
    try {
      if (action === 'calculate') {
        const result = await api.post<OverheadAllocationPreview>(`${ROOT}/${id}/calculate`, {}, { params: { page: previewPage, limit: 20 } });
        if (alive.current) { setPreview(result); setTab('lines'); }
      } else {
        if (action === 'save') {
          await api.patch<OverheadAllocation>(`${ROOT}/${id}`, { notes });
        } else {
          await api.patch<OverheadAllocation>(`${ROOT}/${id}/finalize`, {});
        }
        if (alive.current) {
          setRevision(value => value + 1); setPreview(null); setConfirm(false); setPage(1);
          showToast(t(action === 'save' ? 'overheadAllocation.saved' : 'overheadAllocation.finalized'), 'success');
        }
      }
    } catch (error) { if (alive.current) { setPreview(null); setConfirm(false); handleError(error); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const lineColumns: GridColumn<OverheadAllocationLine>[] = [
    { key: 'run', header: t('overheadAllocation.run'), render: line => line.runNumberSnapshot },
    { key: 'purpose', header: t('overheadAllocation.purpose'), render: line => t('common.costPurpose.' + line.costPurpose) },
    { key: 'destination', header: t('overheadAllocation.destination'), render: line => line.costCenterCodeSnapshot },
    { key: 'driver', header: t('overheadAllocation.driver'), render: line => allocationAmountText(line.driverQuantity) },
    { key: 'unit', header: t('overheadAllocation.driverUnit'), render: line => translateUnit(line.driverUnit, locale) },
    { key: 'pool', header: t('overheadAllocation.pool'), render: line => allocationAmountText(line.poolAmount) },
    { key: 'amount', header: t('overheadAllocation.amount'), render: line => allocationAmountText(line.allocatedAmount) },
    { key: 'currency', header: t('overheadAllocation.currency'), render: line => line.currencyCode },
    { key: 'membership', header: t('overheadAllocation.membership'), render: line => new Date(line.runCostClosedAt).toLocaleString(locale) },
  ];
  const historyLabels: Record<string, string> = { OVERHEAD_ALLOCATION_CREATE: 'overheadAllocation.created', OVERHEAD_ALLOCATION_UPDATE: 'overheadAllocation.updated', OVERHEAD_ALLOCATION_FINALIZE: 'overheadAllocation.finalAudit' };
  const tabLabels: Record<string, string> = { lines: 'overheadAllocation.lines', sources: 'overheadAllocation.sources', history: 'overheadAllocation.history' };
  const gridProps = { dir, loading: evidence.loading || busy, loadingMessage: t('common.loading'), emptyMessage: t('common.noData'), error: evidence.failed ? t('errors.loadFailed') : undefined, onRetry: () => setRevision(value => value + 1) };
  return <Modal open size="xl" title={t('overheadAllocation.details')} onClose={() => { if (!busy && !confirm) onClose(); }}>
    {header.loading && <p role="status">{t('common.loading')}</p>}
    {header.failed && <Button onClick={() => setRevision(value => value + 1)}>{t('common.refresh')}</Button>}
    {row && <div className="space-y-4">
      <p>{row.period.code} · {t(row.status === 'FINAL' ? 'overheadAllocation.final' : 'overheadAllocation.draft')} · {row.currencyCode}</p>
      <p>{new Date(row.periodFrom).toLocaleString(locale)} — {new Date(row.periodTo).toLocaleString(locale)}</p>
      <Textarea label={t('overheadAllocation.notes')} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} disabled={busy || row.status === 'FINAL' || !can('update')} />
      {row.status === 'DRAFT' ? <div className="flex flex-wrap gap-3">
        {can('update') && <Button disabled={busy || notes === (row.notes ?? '')} onClick={() => void mutate('save')}>{t('common.save')}</Button>}
        {can('calculate') && <Button disabled={busy} onClick={() => void mutate('calculate')}>{t('overheadAllocation.calculate')}</Button>}
        {can('finalize') && <Button disabled={!canFinalizeAllocation(row.status, !!preview, can('finalize'), busy)} title={!preview ? t('overheadAllocation.previewRequired') : undefined} onClick={() => setConfirm(true)}>{t('overheadAllocation.finalize')}</Button>}
        {!preview && <p>{t('overheadAllocation.previewRequired')}</p>}
      </div> : <p>{t('overheadAllocation.immutable')}</p>}
      <div className="flex gap-3">{['lines', ...(row.status === 'FINAL' ? ['sources'] : []), 'history'].map(value => <Button key={value} variant={tab === value ? 'primary' : 'secondary'} disabled={busy} onClick={() => { setTab(value); setPage(1); }}>{t(tabLabels[value])}</Button>)}</div>
      {busy && <p role="status">{t('common.loading')}</p>}
      {tab === 'lines' && row.status === 'DRAFT' && !preview && <p>{t('overheadAllocation.notCalculated')}</p>}
      {tab === 'lines' && (row.status === 'FINAL' || preview) && <>
        {preview && <p>{t('overheadAllocation.preview')} · {t('overheadAllocation.sourceAmount')}: {allocationAmountText(preview.sourceAmount)} {row.currencyCode}</p>}
        <AdminDataGrid {...gridProps} columns={lineColumns} data={(row.status === 'DRAFT' ? preview?.data : evidence.data?.data as OverheadAllocationLine[]) ?? []} keyExtractor={line => line.productionRunId + ':' + line.costPurpose} />
        {row.status === 'DRAFT' && preview && !busy && <Pagination {...preview.meta} onPageChange={value => void mutate('calculate', value)} />}
      </>}
      {tab === 'sources' && <AdminDataGrid {...gridProps} data={(evidence.data?.data as Source[]) ?? []} keyExtractor={source => source.sourceEntryId} columns={[
        { key: 'reference', header: t('overheadAllocation.reference'), render: source => source.sourceEntry.reference },
        { key: 'purpose', header: t('overheadAllocation.purpose'), render: source => t('common.costPurpose.' + source.sourceEntry.costPurpose) },
        { key: 'amount', header: t('overheadAllocation.sourceAmount'), render: source => allocationAmountText(source.sourceEntry.amount) },
        { key: 'currency', header: t('overheadAllocation.currency'), render: source => source.sourceEntry.currencyCode },
      ]} />}
      {tab === 'history' && <AdminDataGrid {...gridProps} data={(evidence.data?.data as History[]) ?? []} keyExtractor={event => event.id} columns={[
        { key: 'action', header: t('overheadAllocation.action'), render: event => t(historyLabels[event.action] ?? 'overheadAllocation.history') },
        { key: 'date', header: t('overheadAllocation.date'), render: event => new Date(event.createdAt).toLocaleString(locale) },
      ]} />}
      {evidence.data && !busy && <Pagination {...evidence.data.meta} onPageChange={setPage} />}
    </div>}
    <Modal open={confirm} title={t('overheadAllocation.confirm')} onClose={() => { if (!busy) setConfirm(false); }}>
      <p className="mb-4">{t('overheadAllocation.confirmMessage')}</p>
      <div className="flex gap-3"><Button loading={busy} onClick={() => void mutate('finalize')}>{t('overheadAllocation.finalize')}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>{t('common.cancel')}</Button></div>
    </Modal>
  </Modal>;
}
