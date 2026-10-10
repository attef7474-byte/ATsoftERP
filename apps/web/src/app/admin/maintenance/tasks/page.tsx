'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { unwrapApiData, unwrapApiList } from '../../../../lib/form-utils';
import { useAuth } from '../../../../lib/auth-context';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import type { MaintenanceTask } from '../../../../lib/admin-types';
import type { ExecutionPartInput, ExecutionSourceType } from '../../../../lib/maintenance-execution';
import { Button, Input, Select, Textarea, Pagination, PageHeader, Modal } from '../../../../components/admin/ui';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { useToast } from '../../../../components/admin/toast-provider';
import { CmmsStatusBadge } from '../../../../components/maintenance';
import { ExecutionCreateForm, ExecutionParticipants, executionParticipantAdapter } from '../../../../components/maintenance/execution-form';
import { ExecutionPartsEditor, validateExecutionParts } from '../../../../components/maintenance/execution-parts';
import { F9Lookup } from '../../../../components/f9';

export default function MaintenanceTasksPage() {
  const router = useRouter(), params = useSearchParams();
  const { t, dir } = useTranslation();
  const { user, isSuperAdmin, permissions } = useAuth();
  const can = (key: string) => isSuperAdmin || !!permissions?.permissions.includes(key);
  const handleApiError = useApiErrorHandler();
  const { showToast } = useToast();
  const [data, setData] = useState<MaintenanceTask[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [status, setStatus] = useState('');
  const [sourceFilter, setSourceFilter] = useState(params.get('sourceType') || '');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MaintenanceTask | null>(null);
  const [busy, setBusy] = useState(false), [action, setAction] = useState('');
  const [workPerformed, setWorkPerformed] = useState(''), [remainingWork, setRemainingWork] = useState('');
  const [successor, setSuccessor] = useState(''), [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<string[]>([user?.id || '']);
  const [parts, setParts] = useState<ExecutionPartInput[]>([]);
  const [returned, setReturned] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [usedParts, setUsedParts] = useState(false);
  const sourceId = params.get('requestId') || params.get('workOrderId') || '';
  const fetchData = useCallback(async (page = 1) => {
    setLoading(true); setError('');
    try {
      const response = unwrapApiList<MaintenanceTask, typeof meta>(await api.get('/maintenance/tasks', { params: {
        page, limit: 10, search: search || undefined, status: status || undefined, sourceType: sourceFilter || undefined,
        requestId: params.get('requestId') || undefined, workOrderId: params.get('workOrderId') || undefined,
      } }));
      setData(response.data); if (response.meta) setMeta(response.meta);
    } catch (err) { handleApiError(err); setError(t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [search, status, sourceFilter, params, t, handleApiError]);
  useEffect(() => { void fetchData(); }, [status, sourceFilter]);
  useEffect(() => {
    const id = params.get('executionId');
    if (id) void loadDetail(id);
  }, [params]);
  const loadDetail = async (id: string) => {
    setBusy(true);
    try {
      const detail = unwrapApiData<MaintenanceTask>(await api.get('/maintenance/tasks/' + id));
      setSelected(detail);
      const compatibilityAction = params.get('action');
      if (compatibilityAction === 'complete' && detail.status === 'IN_PROGRESS') {
        setAction('complete'); setWorkPerformed(''); setParts([]); setUsedParts(false); setConfirmed(false);
      } else if (compatibilityAction === 'edit' && ['PENDING', 'IN_PROGRESS'].includes(detail.status)) {
        setAction('edit'); setWorkPerformed(detail.description || detail.title); setSuccessor(detail.assignedToId || ''); setNotes(detail.notes || '');
      }
    }
    catch (err) { handleApiError(err); }
    finally { setBusy(false); }
  };
  const openAction = (value: string) => {
    setAction(value); setWorkPerformed(''); setRemainingWork(''); setSuccessor(''); setNotes('');
    setParticipants([user?.id || '']); setParts([]); setUsedParts(false); setReturned(false); setConfirmed(false);
    if (value === 'edit' && selected) { setWorkPerformed(selected.description || selected.title); setSuccessor(selected.assignedToId || ''); setNotes(selected.notes || ''); }
  };
  const act = async () => {
    if (!selected || busy) return;
    if (['complete', 'handoff', 'edit'].includes(action) && !workPerformed.trim()
      || action === 'handoff' && !remainingWork.trim()
      || (action === 'parts' || usedParts) && (!parts.length || !validateExecutionParts(parts))) { showToast(t('validation.required'), 'error'); return; }
    if (action === 'complete' && (selected.sessions?.filter(s => !s.endedAt).length || 0) > 1 && !confirmed) {
      showToast(t('maintenance.executionConfirmTeamCompletion'), 'error'); return;
    }
    setBusy(true);
    try {
      const url = '/maintenance/tasks/' + selected.id;
      if (action === 'edit') {
        await api.patch(url, { description: workPerformed, notes, ...(successor ? { assignedToId: successor } : {}) });
      } else if (action === 'parts') {
        // Each item keeps its submission identity after an error; retries do not duplicate stock.
        for (const part of parts) await api.post(url + '/parts', part);
      } else {
        const payload = action === 'start' ? { participantUserIds: participants.filter(Boolean) }
          : action === 'join' ? (successor ? { technicianUserId: successor } : {})
          : action === 'complete' ? { workPerformed, notes, parts: usedParts ? parts : [], machineReturnedToService: returned, confirmEndParticipants: confirmed }
          : action === 'handoff' ? { workPerformed, remainingWork, notes, ...(successor ? { handoffToUserId: successor } : {}) }
          : action === 'leave' ? { workPerformed, remainingWork, notes, endReason: 'LEAVE' }
          : {};
        await api.patch(url + '/' + action, payload);
      }
      setAction(''); showToast(t('common.successUpdated'), 'success');
      setSelected(unwrapApiData<MaintenanceTask>(await api.get(url))); await fetchData(meta.page);
    } catch (err) { handleApiError(err); }
    finally { setBusy(false); }
  };
  const fmt = (value?: string | null) => value ? new Date(value).toLocaleString() : '-';
  const hours = (minutes = 0) => (minutes / 60).toFixed(2);
  const live = selected?.status === 'IN_PROGRESS';
  const participating = selected?.sessions?.some(s => s.technicianUserId === user?.id && !s.endedAt);
  const canAddParticipant = isSuperAdmin || selected?.assignedToId === user?.id;
  return <div dir={dir} className="space-y-5">
    <PageHeader title={t('maintenance.executeCompleteWork')} subtitle={t('maintenance.executionDescription')} />
    <div className="flex flex-wrap gap-3 items-end">
      <Input label={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void fetchData(); }} />
      <Select label={t('common.status')} value={status} onChange={e => setStatus(e.target.value)} options={[{ value: '', label: t('common.all') }, ...['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map(value => ({ value, label: t('status.' + value) }))]} />
      <Select label={t('maintenance.sourceType')} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} options={[{ value: '', label: t('common.all') }, ...['WORK_ORDER', 'MAINTENANCE_REQUEST', 'DIRECT'].map(value => ({ value, label: t('maintenance.source' + value) }))]} />
      <Button variant="secondary" onClick={() => void fetchData()}>{t('common.refresh')}</Button>
      {can('maintenance-task:create') && can('maintenance-task:start') && <Button onClick={() => setCreateOpen(true)}>{t('maintenance.startWorkNow')}</Button>}
    </div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {loading ? <p role="status">{t('common.loading')}</p> : <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-start text-sm"><thead><tr>{['maintenance.sourceType', 'maintenance.workPerformed', 'maintenance.responsibleEngineer', 'common.status', 'maintenance.elapsedHours', 'maintenance.laborHours'].map(key => <th key={key} className="text-start p-3">{t(key)}</th>)}<th className="p-3">{t('common.actions')}</th></tr></thead>
        <tbody>{data.map(item => <tr key={item.id} className="border-t">
          <td className="p-3">{t('maintenance.source' + item.sourceType)}<div className="text-gray-500">{item.request?.requestNumber || item.workOrder?.workOrderNumber || '-'}</div></td>
          <td className="p-3">{item.description || item.title}{item.metrics?.waitingForContinuation && <p className="text-amber-700">{t('maintenance.waitingForContinuation')}</p>}</td>
          <td className="p-3">{item.assignedTo?.name || '-'}</td><td className="p-3"><CmmsStatusBadge status={item.status} /></td>
          <td className="p-3">{hours(item.metrics?.elapsedMinutes)}</td><td className="p-3">{hours(item.metrics?.totalLaborMinutes)}</td>
          <td className="p-3"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void loadDetail(item.id)}>{t('details.viewDetails')}</Button></td>
        </tr>)}</tbody></table>
      {!data.length && <p className="p-6 text-gray-500">{t('common.noData')}</p>}
    </div>}
    <Pagination {...meta} onPageChange={page => void fetchData(page)} />
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('maintenance.executeCompleteWork')} size="xl">
      {createOpen && <ExecutionCreateForm initialSourceType={(params.get('sourceType') as ExecutionSourceType) || 'WORK_ORDER'} initialSourceId={sourceId}
        onCancel={() => setCreateOpen(false)} onCreated={id => { setCreateOpen(false); void fetchData(); void loadDetail(id); }} />}
    </Modal>
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null); }} title={t('maintenance.executeCompleteWork')} size="xl">
      {selected && <div className="space-y-5">
        <div className="flex gap-3 flex-wrap">
          <CmmsStatusBadge status={selected.status} />
          {['PENDING', 'IN_PROGRESS'].includes(selected.status) && can('maintenance-task:update') && <Button variant="secondary" onClick={() => openAction('edit')}>{t('common.edit')}</Button>}
          {selected.status === 'PENDING' && can('maintenance-task:start') && <Button disabled={busy} onClick={() => openAction('start')}>{t('common.start')}</Button>}
          {live && !participating && can('maintenance-task:start') && <Button disabled={busy} onClick={() => openAction('join')}>{t('maintenance.joinWork')}</Button>}
          {live && canAddParticipant && can('maintenance-task:start') && <Button variant="secondary" disabled={busy} onClick={() => openAction('join')}>{t('maintenance.addParticipant')}</Button>}
          {live && participating && can('maintenance-task:update') && <><Button variant="secondary" onClick={() => openAction('leave')}>{t('maintenance.leaveWork')}</Button><Button variant="secondary" onClick={() => openAction('handoff')}>{t('maintenance.handoffWork')}</Button></>}
          {live && can('maintenance-task:parts.issue') && <Button variant="secondary" onClick={() => openAction('parts')}>{t('maintenance.addActualPart')}</Button>}
          {live && can('maintenance-task:complete') && <Button onClick={() => openAction('complete')}>{t('maintenance.completeExecution')}</Button>}
          {live && selected.machineId && selected.downtimeLogs?.some(log => !log.endTime && !log.cancelledAt) && can('maintenance-task:downtime.close') && <Button variant="secondary" onClick={() => openAction('return-to-service')}>{t('maintenance.machineReturnedToService')}</Button>}
          {['PENDING', 'IN_PROGRESS'].includes(selected.status) && can('maintenance-task:cancel') && <Button variant="danger" onClick={() => openAction('cancel')}>{t('actions.cancel')}</Button>}
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><dt>{t('maintenance.createdBy')}</dt><dd>{selected.createdBy?.name || t('maintenance.historicalCreatorUnknown')}</dd></div>
          <div><dt>{t('maintenance.responsibleEngineer')}</dt><dd>{selected.assignedTo?.name || '-'}</dd></div>
          <div><dt>{t('maintenance.sourceType')}</dt><dd>{t('maintenance.source' + selected.sourceType)} · {selected.request?.requestNumber || selected.workOrder?.workOrderNumber || '-'}</dd></div>
          <div><dt>{t('maintenance.scopeType')}</dt><dd>{t('maintenance.scope' + selected.scopeType)} · {selected.machine?.name || selected.productionLine?.name || selected.workLocation || '-'}</dd></div>
          <div className="md:col-span-2"><dt>{t('common.description')}</dt><dd className="whitespace-pre-wrap">{selected.description || selected.title}</dd></div>
          <div><dt>{t('maintenance.startedAt')}</dt><dd>{fmt(selected.startedAt)}</dd></div><div><dt>{t('maintenance.completedAt')}</dt><dd>{fmt(selected.completedAt)}</dd></div>
          <div><dt>{t('maintenance.elapsedHours')}</dt><dd>{hours(selected.metrics?.elapsedMinutes)}</dd></div>
          <div><dt>{t('maintenance.laborHours')}</dt><dd>{hours(selected.metrics?.totalLaborMinutes)}</dd></div>
          <div><dt>{t('maintenance.downtimeHours')}</dt><dd>{hours(selected.metrics?.downtimeMinutes)}</dd></div>
        </dl>
        {selected.metrics?.waitingForContinuation && <p role="status" className="rounded bg-amber-50 p-3">{t('maintenance.waitingForContinuation')}</p>}
        {selected.requestId && <Button variant="secondary" onClick={() => router.push('/admin/maintenance/requests/' + selected.requestId)}>{t('maintenance.maintenanceRequest')}</Button>}
        {selected.workOrderId && <Button variant="secondary" onClick={() => router.push('/admin/maintenance/work-orders/' + selected.workOrderId)}>{t('maintenance.workOrder')}</Button>}
        <h3 className="font-semibold">{t('maintenance.executionSessions')}</h3>
        <div className="space-y-3">{selected.sessions?.map(session => <article key={session.id} className="border rounded p-3">
          <p>{session.technicianUser?.name} · {fmt(session.startedAt)} → {session.endedAt ? fmt(session.endedAt) : t('maintenance.currentParticipation')}</p>
          <p className="whitespace-pre-wrap">{session.workPerformed}</p><p className="whitespace-pre-wrap">{session.remainingWork}</p>
          {session.endReason && <p>{t('maintenance.session' + session.endReason)} {session.handoffToUser?.name}</p>}
        </article>)}</div>
        <h3 className="font-semibold">{t('maintenance.actualParts')}</h3>
        {selected.partUsages?.map(part => <div key={part.id} className="border rounded p-3">
          <p>{part.sparePart?.name || part.product?.name} × {String(part.quantity)} · {t('maintenance.usage' + part.usageType)}</p>
          <p>{part.inventoryMovement?.movementNumber} · {part.recordedByUser?.name} · {fmt(part.usedAt)}</p>
        </div>)}
        <h3 className="font-semibold">{t('maintenance.downtimeLogs')}</h3>
        {selected.downtimeLogs?.map(log => <p key={log.id}>{fmt(log.startTime)} → {log.endTime ? fmt(log.endTime) : t('maintenance.machineStillStopped')}</p>)}
      </div>}
    </Modal>
    <Modal open={!!action} onClose={() => { if (!busy) setAction(''); }} title={t('maintenance.executionAction')} size="xl">
      <div className="space-y-4">
        {['cancel', 'return-to-service', 'join'].includes(action) && <p>{t('maintenance.confirmExecutionAction')}</p>}
        {action === 'start' && <ExecutionParticipants value={participants} onChange={setParticipants} disabled={busy} />}
        {action === 'join' && canAddParticipant && <F9Lookup label={t('maintenance.participant')} value={successor} adapter={executionParticipantAdapter} disabled={busy} onChange={setSuccessor} description={t('maintenance.joinCurrentUserHint')} />}
        {['complete', 'leave', 'handoff', 'edit'].includes(action) && <>
          <Textarea label={t(action === 'edit' ? 'common.description' : 'maintenance.workPerformed')} value={workPerformed} required={action !== 'leave'} disabled={busy} onChange={e => setWorkPerformed(e.target.value)} />
          {['leave', 'handoff'].includes(action) && <Textarea label={t('maintenance.remainingWork')} value={remainingWork} required={action === 'handoff'} disabled={busy} onChange={e => setRemainingWork(e.target.value)} />}
          {['handoff', 'edit'].includes(action) && <F9Lookup label={t(action === 'edit' ? 'maintenance.responsibleEngineer' : 'maintenance.handoffTo')} value={successor} adapter={executionParticipantAdapter} disabled={busy} onChange={setSuccessor} />}
          <Textarea label={t('maintenance.notes')} value={notes} disabled={busy} onChange={e => setNotes(e.target.value)} />
        </>}
        {action === 'complete' && can('maintenance-task:parts.issue') && <Select label={t('maintenance.partsUsedQuestion')} value={usedParts ? 'YES' : 'NO'} disabled={busy} onChange={event => setUsedParts(event.target.value === 'YES')} options={[{ value: 'NO', label: t('common.no') }, { value: 'YES', label: t('common.yes') }]} />}
        {selected && (action === 'parts' || action === 'complete' && usedParts && can('maintenance-task:parts.issue')) && <ExecutionPartsEditor parts={parts} onChange={setParts} scopeType={selected.scopeType} machineId={selected.machineId} sessions={selected.sessions} disabled={busy} />}
        {action === 'complete' && <>
          <p className="text-sm text-gray-500">{t('maintenance.completionAtomicHint')}</p>
          <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />{t('maintenance.confirmEndParticipants')}</label>
          {selected?.machineId && can('maintenance-task:downtime.close') && <label className="flex gap-2"><input type="checkbox" checked={returned} onChange={e => setReturned(e.target.checked)} disabled={busy} />{t('maintenance.machineReturnedToService')}</label>}
        </>}
        <div className="flex gap-3 justify-end"><Button variant="secondary" disabled={busy} onClick={() => setAction('')}>{t('actions.cancel')}</Button><Button loading={busy} disabled={action === 'parts' && !parts.length} onClick={() => void act()}>{t('actions.confirm')}</Button></div>
      </div>
    </Modal>
  </div>;
}
