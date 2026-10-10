'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { unwrapApiData } from '../../lib/form-utils';
import { useTranslation } from '../../lib/i18n/use-translation';
import type { MaintenanceRequest, MaintenanceWorkOrder, User } from '../../lib/admin-types';
import { emptyExecutionScope, executionSourceReference, isValidHistoricalInterval, type ExecutionScopeType, type ExecutionSourceType } from '../../lib/maintenance-execution';
import { ExecutionPartsEditor, validateExecutionParts } from './execution-parts';
import type { ExecutionPartInput } from '../../lib/maintenance-execution';
import { Button, Input, Select, Textarea } from '../admin/ui';
import { useApiErrorHandler } from '../admin/error-handler';
import { F9Lookup, costCenterAdapter, machineAdapter, machineComponentAdapter, maintenanceRequestAdapter, maintenanceWorkOrderAdapter, productionLineAdapter } from '../f9';
import type { LookupAdapter } from '../f9/types';

export const executionParticipantAdapter: LookupAdapter<User> = {
  endpoint: '/maintenance/tasks/participants',
  displayLabel: (person) => person.name,
  searchFields: ['name'],
  columns: [{ key: 'name', header: 'Name', headerKey: 'common.name' }],
};

export function ExecutionParticipants({ value, onChange, disabled = false }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return <div className="space-y-3">
    {value.map((id, index) => <div key={index} className="flex items-end gap-2">
      <div className="flex-1"><F9Lookup label={`${t('maintenance.participant')} ${index + 1}`} value={id} adapter={executionParticipantAdapter} disabled={disabled} onChange={(next) => onChange(value.map((item, position) => position === index ? next : item))} /></div>
      {value.length > 1 && <Button variant="secondary" disabled={disabled} onClick={() => onChange(value.filter((_, position) => position !== index))}>{t('actions.remove')}</Button>}
    </div>)}
    <Button variant="secondary" disabled={disabled} onClick={() => onChange([...value, ''])}>{t('maintenance.addParticipant')}</Button>
  </div>;
}

export function ExecutionCreateForm({ initialSourceType = 'WORK_ORDER', initialSourceId = '', onCreated, onCancel }: { initialSourceType?: ExecutionSourceType; initialSourceId?: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const { user, isSuperAdmin, permissions } = useAuth();
  const handleApiError = useApiErrorHandler();
  const canHistorical = isSuperAdmin || !!permissions?.permissions.includes('maintenance-task:registerHistorical');
  const [sourceType, setSourceType] = useState<ExecutionSourceType>(initialSourceType);
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [source, setSource] = useState<MaintenanceRequest | MaintenanceWorkOrder | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [scope, setScope] = useState(emptyExecutionScope('MACHINE'));
  const [description, setDescription] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [assignedToId, setAssignedToId] = useState(user?.id || '');
  const [team, setTeam] = useState(false);
  const [participants, setParticipants] = useState<string[]>([user?.id || '']);
  const [mode, setMode] = useState<'NOW' | 'HISTORICAL'>('NOW');
  const [startedAt, setStartedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [notes, setNotes] = useState('');
  const [parts, setParts] = useState<ExecutionPartInput[]>([]);
  const [machineStopped, setMachineStopped] = useState(false);
  const [returned, setReturned] = useState(false);
  const [downtimeStartedAt, setDowntimeStartedAt] = useState('');
  const sourceMachineId = sourceType === 'DIRECT' ? scope.machineId : source?.machineId;
  const effectiveScope = sourceType === 'DIRECT' ? scope.scopeType : ((source as MaintenanceWorkOrder)?.scopeType || (sourceMachineId ? 'MACHINE' : 'GENERAL'));
  const canParts = isSuperAdmin || !!permissions?.permissions.includes('maintenance-task:parts.issue');
  const canReturn = isSuperAdmin || !!permissions?.permissions.includes('maintenance-task:downtime.close');
  const [saving, setSaving] = useState(false);
  const [usedParts, setUsedParts] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A failed start must retry the created execution, never create a duplicate.
  const createdId = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    setSource(null);
    if (!sourceId || sourceType === 'DIRECT') { setSourceLoading(false); return; }
    setSourceLoading(true);
    const endpoint = sourceType === 'WORK_ORDER' ? '/maintenance-work-orders' : '/maintenance/requests';
    void api.get(`${endpoint}/${sourceId}`).then((response) => {
      if (current) setSource(unwrapApiData<MaintenanceRequest | MaintenanceWorkOrder>(response));
    }).catch((error) => { if (current) handleApiError(error); }).finally(() => { if (current) setSourceLoading(false); });
    return () => { current = false; };
  }, [sourceType, sourceId]);

  const save = async () => {
    if (saving) return;
    const invalid: Record<string, string> = {};
    if (sourceType !== 'DIRECT' && (!sourceId || !source)) invalid.sourceId = t('validation.required');
    if (sourceType === 'DIRECT') {
      if (!description.trim()) invalid.description = t('validation.required');
      if (scope.scopeType !== 'GENERAL' && !scope.productionLineId) invalid.productionLineId = t('validation.required');
      if (scope.scopeType === 'MACHINE' && !scope.machineId) invalid.machineId = t('validation.required');
    }
    const participantUserIds = team ? participants.filter(Boolean) : [assignedToId || user?.id || ''];
    if (!assignedToId || participantUserIds.some((id) => !id) || !participantUserIds.length) invalid.participants = t('validation.required');
    if (new Set(participantUserIds).size !== participantUserIds.length) invalid.participants = t('maintenance.participantAlreadyAdded');
    if (mode === 'HISTORICAL') {
      if (!isValidHistoricalInterval(startedAt, completedAt)) invalid.timestamps = t('maintenance.invalidExecutionChronology');
      if (!workPerformed.trim()) invalid.workPerformed = t('validation.required');
    }
    if (usedParts && (!parts.length || !validateExecutionParts(parts))) invalid.parts = t('validation.required');
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setSaving(true);
    try {
      const payload = {
        ...executionSourceReference(sourceType, sourceId),
        ...(sourceType === 'DIRECT' ? {
          scopeType: scope.scopeType,
          ...(scope.productionLineId ? { productionLineId: scope.productionLineId } : {}),
          ...(scope.machineId ? { machineId: scope.machineId } : {}),
          ...(scope.machineComponentId ? { machineComponentId: scope.machineComponentId } : {}),
          ...(workLocation.trim() ? { workLocation: workLocation.trim() } : {}),
          ...(costCenterId ? { costCenterId } : {}),
        } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        assignedToId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      if (mode === 'HISTORICAL') {
        const completed = unwrapApiData<{ id: string }>(await api.post('/maintenance/tasks/register-historical', {
          ...payload, startedAt: new Date(startedAt).toISOString(), completedAt: new Date(completedAt).toISOString(), participantUserIds, workPerformed: workPerformed.trim(), parts: usedParts ? parts : [],
          machineReturnedToService: returned, ...(downtimeStartedAt ? { downtimeStartedAt: new Date(downtimeStartedAt).toISOString() } : {}),
        }));
        onCreated(completed.id);
      } else {
        if (!createdId.current) {
          const created = unwrapApiData<{ id: string }>(await api.post('/maintenance/tasks', payload));
          createdId.current = created.id;
        }
        await api.patch(`/maintenance/tasks/${createdId.current}/start`, { participantUserIds, machineStopped });
        onCreated(createdId.current!);
      }
    } catch (error) { handleApiError(error); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input label={t('common.code')} value={t('common.codeAutoGenerated')} disabled />
      <Input label={t('maintenance.createdBy')} value={user?.name || ''} disabled />
    </div>
    <Select label={t('maintenance.sourceType')} value={sourceType} disabled={saving || !!createdId.current} onChange={(event) => { setSourceType(event.target.value as ExecutionSourceType); setSourceId(''); setDescription(''); setParts([]); setUsedParts(false); setMachineStopped(false); setReturned(false); setDowntimeStartedAt(''); }} options={['WORK_ORDER', 'MAINTENANCE_REQUEST', 'DIRECT'].map((value) => ({ value, label: t(`maintenance.source${value}`) }))} />
    {sourceType !== 'DIRECT' && <F9Lookup label={t(sourceType === 'WORK_ORDER' ? 'maintenance.workOrder' : 'maintenance.maintenanceRequest')} value={sourceId} adapter={(sourceType === 'WORK_ORDER' ? maintenanceWorkOrderAdapter : maintenanceRequestAdapter) as LookupAdapter<MaintenanceRequest | MaintenanceWorkOrder>} filters={{ executionEligible: 'true' }} disabled={saving || !!createdId.current} error={errors.sourceId} onChange={setSourceId} />}
    {sourceLoading && <p role="status">{t('common.loading')}</p>}
    {source && <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
      <div><dt className="text-gray-500">{t('maintenance.createdBy')}</dt><dd>{('requestedBy' in source ? source.requestedBy?.name : (source as MaintenanceWorkOrder).createdBy?.name) || '-'}</dd></div>
      <div><dt className="text-gray-500">{t('maintenance.priority')}</dt><dd>{t(`status.${source.priority}`)}</dd></div>
      <div className="md:col-span-2"><dt className="text-gray-500">{t('common.description')}</dt><dd className="whitespace-pre-wrap">{source.description || source.title}</dd></div>
      <div><dt className="text-gray-500">{t('maintenance.productionLine')}</dt><dd>{source.productionLine?.name || '-'}</dd></div>
      <div><dt className="text-gray-500">{t('maintenance.machine')}</dt><dd>{source.machine?.name || '-'}</dd></div>
      <div><dt className="text-gray-500">{t('maintenance.machineComponent')}</dt><dd>{source.machineComponent?.name || '-'}</dd></div>
      {'parts' in source && <div className="md:col-span-2"><dt className="text-gray-500">{t('maintenance.plannedParts')}</dt><dd>{source.parts?.map((part) => `${part.sparePart?.name || part.product?.name || ''} × ${part.quantity}`).join('، ') || t('common.noData')}</dd></div>}
    </dl>}
    {sourceType === 'DIRECT' && <>
      <Select label={t('maintenance.scopeType')} value={scope.scopeType} disabled={saving || !!createdId.current} onChange={(event) => { setScope(emptyExecutionScope(event.target.value as ExecutionScopeType)); setParts([]); setUsedParts(false); }} options={['MACHINE', 'PRODUCTION_LINE', 'GENERAL'].map((value) => ({ value, label: t(`maintenance.scope${value}`) }))} />
      {scope.scopeType !== 'GENERAL' && <F9Lookup label={t('maintenance.productionLine')} value={scope.productionLineId} adapter={productionLineAdapter} error={errors.productionLineId} disabled={saving || !!createdId.current} onChange={(productionLineId) => setScope({ ...scope, productionLineId, machineId: '', machineComponentId: '' })} />}
      {scope.scopeType === 'MACHINE' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F9Lookup label={t('maintenance.machine')} value={scope.machineId} adapter={machineAdapter} filters={{ productionLineId: scope.productionLineId }} disabled={!scope.productionLineId || saving || !!createdId.current} error={errors.machineId} onChange={(machineId) => setScope({ ...scope, machineId, machineComponentId: '' })} />
        <F9Lookup label={t('maintenance.machineComponent')} value={scope.machineComponentId} adapter={machineComponentAdapter} filters={{ machineId: scope.machineId }} disabled={!scope.machineId || saving || !!createdId.current} onChange={(machineComponentId) => setScope({ ...scope, machineComponentId })} />
      </div>}
      <Input label={t('maintenance.workLocation')} value={workLocation} disabled={saving || !!createdId.current} onChange={(event) => setWorkLocation(event.target.value)} />
      <F9Lookup label={t('maintenance.costCenter')} value={costCenterId} adapter={costCenterAdapter} disabled={saving || !!createdId.current} onChange={setCostCenterId} />
    </>}
    <Textarea label={t('common.description')} value={description} error={errors.description} required={sourceType === 'DIRECT'} disabled={saving || !!createdId.current} onChange={(event) => setDescription(event.target.value)} />
    <F9Lookup label={t('maintenance.responsibleEngineer')} value={assignedToId} adapter={executionParticipantAdapter} disabled={saving || !!createdId.current} onChange={setAssignedToId} />
    <Select label={t('maintenance.executionTeam')} value={team ? 'TEAM' : 'INDIVIDUAL'} disabled={saving || !!createdId.current} onChange={(event) => setTeam(event.target.value === 'TEAM')} options={[{ value: 'INDIVIDUAL', label: t('maintenance.individual') }, { value: 'TEAM', label: t('maintenance.team') }]} />
    {team && <ExecutionParticipants value={participants} onChange={setParticipants} disabled={saving} />}
    {errors.participants && <p role="alert" className="text-red-600 text-sm">{errors.participants}</p>}
    <Select label={t('maintenance.registrationMode')} value={mode} disabled={saving || !!createdId.current} onChange={(event) => setMode(event.target.value as 'NOW' | 'HISTORICAL')} options={[{ value: 'NOW', label: t('maintenance.startWorkNow') }, ...(canHistorical ? [{ value: 'HISTORICAL', label: t('maintenance.registerPerformedWork') }] : [])]} />
    {mode === 'HISTORICAL' && <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input type="datetime-local" label={t('maintenance.startedAt')} value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /><Input type="datetime-local" label={t('maintenance.completedAt')} value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></div>
      {errors.timestamps && <p role="alert" className="text-red-600 text-sm">{errors.timestamps}</p>}
      <Textarea label={t('maintenance.workPerformed')} value={workPerformed} required error={errors.workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} />
    </>}
    {sourceMachineId && mode === 'NOW' && <label className="flex gap-2"><input type="checkbox" checked={machineStopped} disabled={saving || !!createdId.current} onChange={event => setMachineStopped(event.target.checked)} />{t('maintenance.machineStopped')}</label>}
    {mode === 'HISTORICAL' && <>
      {canParts && <Select label={t('maintenance.partsUsedQuestion')} value={usedParts ? 'YES' : 'NO'} disabled={saving} onChange={event => setUsedParts(event.target.value === 'YES')} options={[{ value: 'NO', label: t('common.no') }, { value: 'YES', label: t('common.yes') }]} />}
      {canParts && usedParts && <ExecutionPartsEditor parts={parts} onChange={setParts} scopeType={effectiveScope} machineId={sourceMachineId} disabled={saving} />}
      {errors.parts && <p role="alert" className="text-red-600">{errors.parts}</p>}
      {sourceMachineId && canReturn && <>
        <Input type="datetime-local" label={t('maintenance.downtimeStartedAt')} value={downtimeStartedAt} onChange={event => setDowntimeStartedAt(event.target.value)} />
        <label className="flex gap-2"><input type="checkbox" checked={returned} disabled={saving} onChange={event => setReturned(event.target.checked)} />{t('maintenance.machineReturnedToService')}</label>
      </>}
    </>}
    <Textarea label={t('maintenance.notes')} value={notes} disabled={saving} onChange={(event) => setNotes(event.target.value)} />
    {createdId.current && <p className="text-amber-700 text-sm">{t('maintenance.executionCreatedStartPending')}</p>}
    <div className="flex justify-end gap-3"><Button variant="secondary" disabled={saving} onClick={createdId.current ? () => onCreated(createdId.current!) : onCancel}>{createdId.current ? t('details.viewDetails') : t('actions.cancel')}</Button><Button loading={saving} disabled={sourceLoading} onClick={save}>{t(mode === 'NOW' ? 'maintenance.startWorkNow' : 'maintenance.registerPerformedWork')}</Button></div>
  </div>;
}
