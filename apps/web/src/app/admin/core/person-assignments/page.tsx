'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import { useApiErrorHandler } from '@/components/admin/error-handler';
import { useAuth } from '@/lib/auth-context';
import {
  HIER_G_TRANSFER_STEPS,
  TRANSFER_RESOLUTION_ACTIONS,
  buildTransferPreviewFingerprint,
  isTransferConfirmationReady,
  isTransferResolutionAuthorized,
  requiredTransferRelationships,
  unresolvedTransferRelationshipIds,
} from '@/lib/admin-types';
import type {
  OperationalPersonAssignment,
  PaginationMeta,
  TransferPreviewResponse,
  TransferApplyResponse,
  AffectedRelationship,
  RelationshipResolutionAction,
  TransferWorkflowStep,
} from '@/lib/admin-types';
import { Button, Input, Card, LoadingState, Modal, StatusBadge, Pagination, ConfirmDialog } from '@/components/admin/ui';
import { F9Lookup, operationalPersonAdapter, branchAdapter, administrationAdapter, departmentAdapter, jobTitleAdapter } from '@/components/f9';
import { Search, Plus, Edit, Trash2, RefreshCw, Users, ArrowRightLeft } from 'lucide-react';

interface AssignmentForm {
  personnelId: string;
  departmentId: string;
  jobTitleId: string;
  assignmentType: string;
  leadershipLevel: string;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

interface TransferForm {
  branchId: string;
  administrationId: string;
  departmentId: string;
  jobTitleId: string;
  leadershipLevel: string;
  effectiveFrom: string;
  notes: string;
}

interface TransferPlacementLabels {
  branch: string;
  administration: string;
  department: string;
  jobTitle: string;
}

const EMPTY_FORM: AssignmentForm = { personnelId: '', departmentId: '', jobTitleId: '', assignmentType: 'PRIMARY', leadershipLevel: 'NONE', effectiveFrom: '', effectiveTo: '', notes: '' };
const EMPTY_TRANSFER_FORM: TransferForm = { branchId: '', administrationId: '', departmentId: '', jobTitleId: '', leadershipLevel: 'NONE', effectiveFrom: '', notes: '' };
const EMPTY_TRANSFER_LABELS: TransferPlacementLabels = { branch: '', administration: '', department: '', jobTitle: '' };
const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };
const ASSIGNMENT_TYPES = ['PRIMARY', 'SECONDARY', 'TEMPORARY', 'ACTING'];
const LEADERSHIP_LEVELS = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'];
const CONTINUATION_BLOCKED_REASON_KEYS = {
  'validation.invalidReference': 'core.continuationBlockedInvalidReference',
  'validation.invalidRange': 'core.continuationBlockedInvalidRange',
  'validation.assignmentOutOfRange': 'core.continuationBlockedAssignmentOutOfRange',
  'validation.selfReference': 'core.continuationBlockedSelfReference',
  'validation.invalidBranchHierarchy': 'core.continuationBlockedBranchHierarchy',
  'validation.directSupervisorOverlap': 'core.continuationBlockedDirectOverlap',
  'validation.cycleDetected': 'core.continuationBlockedCycle',
} as const;

export default function PersonAssignmentsPage() {
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { permissions, isSuperAdmin } = useAuth();

  const permissionKeys = permissions?.permissions ?? [];
  const canTransferAssignment = isSuperAdmin || permissionKeys.includes('person-assignment:transfer');
  const canReadSupervision = isSuperAdmin || permissionKeys.includes('supervisor:read');
  const canAssignSupervision = isSuperAdmin || permissionKeys.includes('supervisor:assign');
  const canRemoveSupervision = isSuperAdmin || permissionKeys.includes('supervisor:remove');
  const canOpenTransfer = canTransferAssignment;

  const [data, setData] = useState<OperationalPersonAssignment[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(INITIAL_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [transferModal, setTransferModal] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [transferRecord, setTransferRecord] = useState<OperationalPersonAssignment | null>(null);
  const [transferForm, setTransferForm] = useState<TransferForm>(EMPTY_TRANSFER_FORM);
  const [transferLabels, setTransferLabels] = useState<TransferPlacementLabels>(EMPTY_TRANSFER_LABELS);
  const [transferStep, setTransferStep] = useState<TransferWorkflowStep>(1);
  const [transferPreview, setTransferPreview] = useState<TransferPreviewResponse | null>(null);
  const [transferPreviewFingerprint, setTransferPreviewFingerprint] = useState<string | null>(null);
  const [transferResolutions, setTransferResolutions] = useState<Record<string, RelationshipResolutionAction>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [transferResult, setTransferResult] = useState<TransferApplyResponse | null>(null);
  const transferFormRef = useRef<TransferForm>(EMPTY_TRANSFER_FORM);
  const transferIdRef = useRef<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewRequestVersionRef = useRef(0);
  const applyInFlightRef = useRef(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async (page = 1, searchQuery = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/person-assignments', { params: { page, limit: 10, search: searchQuery || undefined } }) as any;
      setData(res.data);
      setMeta(res.meta);
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(1, search); }, []);

  const handleSearch = () => fetchData(1, search);

  useEffect(() => () => {
    previewRequestVersionRef.current += 1;
    previewAbortRef.current?.abort();
  }, []);

  const resolutionCapabilities = useMemo(() => ({
    canAssign: canAssignSupervision,
    canRemove: canRemoveSupervision,
  }), [canAssignSupervision, canRemoveSupervision]);

  const currentTransferFingerprint = buildTransferPreviewFingerprint(transferId, {
    ...transferForm,
    assignmentType: 'PRIMARY',
  });
  const previewIsFresh = Boolean(
    transferPreview &&
    transferPreviewFingerprint &&
    transferPreviewFingerprint === currentTransferFingerprint,
  );
  const requiredRelationships = requiredTransferRelationships(transferPreview);
  const unresolvedRelationshipIds = unresolvedTransferRelationshipIds(
    transferPreview,
    transferResolutions,
    resolutionCapabilities,
  );
  const confirmationReady = isTransferConfirmationReady(
    transferPreview,
    previewIsFresh,
    transferResolutions,
    resolutionCapabilities,
  );
  const lacksRequiredMutationPermission = requiredRelationships.some(
    (relationship) => !relationship.allowedResolutions.some(
      (action) => isTransferResolutionAuthorized(relationship, action, resolutionCapabilities),
    ),
  );

  const invalidateTransferPreview = useCallback(() => {
    previewRequestVersionRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    setPreviewLoading(false);
    setTransferPreview(null);
    setTransferPreviewFingerprint(null);
    setTransferResolutions({});
    setTransferResult(null);
  }, []);

  const updateTransferForm = useCallback((patch: Partial<TransferForm>) => {
    invalidateTransferPreview();
    setTransferForm((previous) => {
      const next = { ...previous, ...patch };
      transferFormRef.current = next;
      return next;
    });
  }, [invalidateTransferPreview]);

  const lookupLabel = (item: unknown) => {
    if (!item || typeof item !== 'object') return '';
    const candidate = item as { name?: unknown; label?: unknown; code?: unknown };
    const name = typeof candidate.name === 'string' ? candidate.name : typeof candidate.label === 'string' ? candidate.label : '';
    const code = typeof candidate.code === 'string' ? candidate.code : '';
    return name && code ? `${name} (${code})` : name || code;
  };

  const formatTransferDate = (value: string | null | undefined) => {
    if (!value) return t('core.notSpecified');
    return new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US');
  };

  const closeTransferWorkflow = (refresh = false) => {
    if (saving || applyInFlightRef.current) return;
    previewRequestVersionRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    transferIdRef.current = null;
    transferFormRef.current = EMPTY_TRANSFER_FORM;
    setTransferModal(false);
    setTransferId(null);
    setTransferRecord(null);
    setTransferForm(EMPTY_TRANSFER_FORM);
    setTransferLabels(EMPTY_TRANSFER_LABELS);
    setTransferStep(1);
    setTransferPreview(null);
    setTransferPreviewFingerprint(null);
    setTransferResolutions({});
    setTransferResult(null);
    setPreviewLoading(false);
    if (refresh) fetchData(meta.page, search);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setValidationErrors({});
    setModalOpen(true);
  };

  const openEditModal = (record: OperationalPersonAssignment) => {
    setEditingId(record.id);
    setForm({
      personnelId: record.personnelId,
      departmentId: record.departmentId,
      jobTitleId: record.jobTitleId || '',
      assignmentType: record.assignmentType,
      leadershipLevel: record.leadershipLevel || 'NONE',
      effectiveFrom: record.effectiveFrom.split('T')[0],
      effectiveTo: record.effectiveTo ? record.effectiveTo.split('T')[0] : '',
      notes: record.notes || '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleSave = async () => {
    const fieldErrors: Record<string, string> = {};
    if (!form.personnelId) fieldErrors.personnelId = t('validation.required');
    if (!form.departmentId) fieldErrors.departmentId = t('validation.required');
    if (!form.effectiveFrom) fieldErrors.effectiveFrom = t('validation.required');
    if (Object.keys(fieldErrors).length > 0) {
      setValidationErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form, effectiveTo: form.effectiveTo || null, jobTitleId: form.jobTitleId || null };
      if (editingId) {
        await api.patch(`/person-assignments/${editingId}`, payload);
        showToast(t('common.successUpdated'), 'success');
      } else {
        await api.post('/person-assignments', payload);
        showToast(t('common.successCreated'), 'success');
      }
      setModalOpen(false);
      fetchData(meta.page, search);
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openTransferModal = (record: OperationalPersonAssignment) => {
    if (!canOpenTransfer || record.assignmentType !== 'PRIMARY' || Boolean(record.effectiveTo)) return;
    previewRequestVersionRef.current += 1;
    previewAbortRef.current?.abort();
    const today = new Date();
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    const nextForm: TransferForm = {
      branchId: '',
      administrationId: '',
      departmentId: '',
      jobTitleId: '',
      leadershipLevel: 'NONE',
      effectiveFrom: localDate,
      notes: '',
    };
    setTransferId(record.id);
    transferIdRef.current = record.id;
    setTransferRecord(record);
    setTransferForm(nextForm);
    transferFormRef.current = nextForm;
    setTransferLabels(EMPTY_TRANSFER_LABELS);
    setTransferStep(1);
    setTransferPreview(null);
    setTransferPreviewFingerprint(null);
    setTransferResolutions({});
    setTransferResult(null);
    setTransferModal(true);
  };

  const handlePreviewTransfer = async () => {
    if (
      previewLoading ||
      !canOpenTransfer ||
      !transferId ||
      !transferForm.departmentId ||
      !transferForm.effectiveFrom
    ) return;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const requestVersion = ++previewRequestVersionRef.current;
    const requestFingerprint = buildTransferPreviewFingerprint(transferId, {
      ...transferForm,
      assignmentType: 'PRIMARY',
    });
    setPreviewLoading(true);
    setTransferPreview(null);
    setTransferPreviewFingerprint(null);
    setTransferResolutions({});
    try {
      const res = await api.post<TransferPreviewResponse>(`/person-assignments/${transferId}/transfer/preview`, {
        departmentId: transferForm.departmentId,
        branchId: transferForm.branchId || undefined,
        administrationId: transferForm.administrationId || undefined,
        jobTitleId: transferForm.jobTitleId || undefined,
        leadershipLevel: transferForm.leadershipLevel || 'NONE',
        effectiveFrom: transferForm.effectiveFrom,
        effectiveTo: undefined,
        notes: transferForm.notes || undefined,
      }, { signal: controller.signal });
      const latestFingerprint = buildTransferPreviewFingerprint(transferIdRef.current, {
        ...transferFormRef.current,
        assignmentType: 'PRIMARY',
      });
      if (
        controller.signal.aborted ||
        requestVersion !== previewRequestVersionRef.current ||
        requestFingerprint !== latestFingerprint
      ) return;
      setTransferPreview(res);
      setTransferPreviewFingerprint(requestFingerprint);
      setTransferResolutions({});
      setTransferStep(2);
    } catch (err: any) {
      if (err?.name !== 'AbortError') handleApiError(err);
    } finally {
      if (requestVersion === previewRequestVersionRef.current) {
        setPreviewLoading(false);
        previewAbortRef.current = null;
      }
    }
  };

  const handleApplyTransfer = async () => {
    if (saving || applyInFlightRef.current) return;
    if (
      !canOpenTransfer ||
      !transferId ||
      !transferForm.departmentId ||
      !transferForm.effectiveFrom ||
      !confirmationReady
    ) {
      showToast(previewIsFresh ? t('core.resolveAllRelationships') : t('core.transferPreviewStale'), 'error');
      return;
    }
    applyInFlightRef.current = true;
    setSaving(true);
    try {
      const resolutions = requiredRelationships.map((relationship) => ({
        relationshipId: relationship.id,
        action: transferResolutions[relationship.id],
      }));
      const res = await api.post<TransferApplyResponse>(`/person-assignments/${transferId}/transfer`, {
        departmentId: transferForm.departmentId,
        branchId: transferForm.branchId || undefined,
        administrationId: transferForm.administrationId || undefined,
        jobTitleId: transferForm.jobTitleId || undefined,
        leadershipLevel: transferForm.leadershipLevel || 'NONE',
        effectiveFrom: transferForm.effectiveFrom,
        effectiveTo: undefined,
        notes: transferForm.notes || undefined,
        relationshipResolutions: resolutions.length > 0 ? resolutions : undefined,
      });
      setTransferResult(res);
      setTransferStep(5);
      showToast(t('core.transferSuccess'), 'success');
    } catch (err: unknown) {
      handleApiError(err);
    } finally {
      applyInFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/person-assignments/${deleteTarget}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDelete(false);
      setDeleteTarget(null);
      fetchData(meta.page, search);
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('errors.deleteFailed'), 'error');
    }
  };

  const renderRelationshipContext = (relationship: AffectedRelationship, allowResolution: boolean) => {
    const otherParty = relationship.otherParty;
    const continuationBlockedMessageKey = relationship.continuationBlockedReason
      ? CONTINUATION_BLOCKED_REASON_KEYS[
          relationship.continuationBlockedReason as keyof typeof CONTINUATION_BLOCKED_REASON_KEYS
        ]
      : undefined;
    const continuationBlockedMessage = continuationBlockedMessageKey
      ? t(continuationBlockedMessageKey)
      : t('core.resolutionNotAllowed');
    return (
      <div key={relationship.id} className="border rounded-lg p-3 space-y-3" data-relationship-row>
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div>
            <p className="text-sm font-medium">{otherParty.person?.name || t('core.notSpecified')}</p>
            {otherParty.person?.code && <p className="text-xs text-gray-500">{otherParty.person.code}</p>}
          </div>
          <div className="flex flex-wrap gap-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${relationship.direction === 'INBOUND' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
              {t(`core.directions.${relationship.direction}`)}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${relationship.temporalCategory === 'CURRENT' ? 'bg-blue-100 text-blue-700' : relationship.temporalCategory === 'FUTURE' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
              {t(`core.temporalCategories.${relationship.temporalCategory}`)}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
              {t(`core.relationshipTypes.${relationship.relationshipType}`)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
          <p><span className="font-medium">{t('core.jobTitle')}:</span> {otherParty.jobTitle?.name || t('core.notSpecified')}</p>
          <p><span className="font-medium">{t('core.department')}:</span> {otherParty.department?.name || t('core.notSpecified')}</p>
          <p><span className="font-medium">{t('core.administration')}:</span> {otherParty.administration?.name || t('core.notSpecified')}</p>
          <p><span className="font-medium">{t('core.branch')}:</span> {otherParty.branch?.name || t('core.notSpecified')}</p>
          <p><span className="font-medium">{t('core.assignmentType')}:</span> {otherParty.assignmentType ? t(`core.assignmentTypes.${otherParty.assignmentType}`) : t('core.notSpecified')}</p>
          <p><span className="font-medium">{t('core.leadershipLevel')}:</span> {otherParty.leadershipLevel ? t(`core.leadershipLevels.${otherParty.leadershipLevel}`) : t('core.notSpecified')}</p>
          <p className="sm:col-span-2">
            <span className="font-medium">{t('core.relationshipEffectiveRange')}:</span>{' '}
            {t('core.relationshipEffectiveRangeValue', 'core', {
              from: formatTransferDate(relationship.effectiveFrom),
              to: relationship.effectiveTo ? formatTransferDate(relationship.effectiveTo) : t('core.current'),
            })}
          </p>
        </div>

        {allowResolution && relationship.temporalCategory !== 'HISTORICAL' && (
          <div className="flex flex-wrap gap-2 pt-1">
            {TRANSFER_RESOLUTION_ACTIONS.map((action) => {
              const allowedByRelationship = relationship.allowedResolutions.includes(action);
              const authorized = isTransferResolutionAuthorized(relationship, action, resolutionCapabilities);
              const disabledReason = !allowedByRelationship
                ? action === 'CONTINUE_ON_NEW_ASSIGNMENT' && relationship.continuationBlockedReason
                  ? continuationBlockedMessage
                  : t('core.resolutionNotAllowed')
                : !authorized
                  ? t('core.resolutionPermissionRequired')
                  : undefined;
              return (
                <button
                  type="button"
                  key={action}
                  onClick={() => {
                    if (!authorized) return;
                    setTransferResolutions((previous) => ({ ...previous, [relationship.id]: action }));
                  }}
                  disabled={!authorized}
                  title={disabledReason}
                  aria-label={t(`core.resolutionActions.${action}`)}
                  aria-pressed={transferResolutions[relationship.id] === action}
                  className={`text-xs px-2 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed ${transferResolutions[relationship.id] === action ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {t(`core.resolutionActions.${action}`)}
                </button>
              );
            })}
          </div>
        )}
        {allowResolution &&
          relationship.continuationBlockedReason &&
          !relationship.allowedResolutions.includes('CONTINUE_ON_NEW_ASSIGNMENT') && (
            <p className="text-xs text-amber-700" data-continuation-blocked-reason>
              {continuationBlockedMessage}
            </p>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{t('core.personAssignments')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(meta.page, search)} variant="secondary" size="sm"><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={openCreateModal} size="sm"><Plus className="h-4 w-4 mr-1" />{t('core.newPersonAssignment')}</Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Input placeholder={t('grid.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-sm" />
          <Button onClick={handleSearch} variant="secondary" size="sm"><Search className="h-4 w-4" /></Button>
        </div>

        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
        {loading && <LoadingState />}

        {!loading && data.length === 0 && <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>}

        {!loading && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">{t('core.personnel')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.department')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.jobTitle')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.assignmentType')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.leadershipLevel')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.effectiveFrom')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.effectiveTo')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">{record.person?.name || t('core.notSpecified')}</td>
                    <td className="py-3 px-2">{record.department?.name || t('core.notSpecified')}</td>
                    <td className="py-3 px-2">{record.jobTitle?.name || '-'}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${record.assignmentType === 'PRIMARY' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {t(`core.assignmentTypes.${record.assignmentType}`)}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {record.leadershipLevel && record.leadershipLevel !== 'NONE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {t(`core.leadershipLevels.${record.leadershipLevel}`)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-xs">{new Date(record.effectiveFrom).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-xs">{record.effectiveTo ? new Date(record.effectiveTo).toLocaleDateString() : '-'}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        {canOpenTransfer && record.assignmentType === 'PRIMARY' && !record.effectiveTo && (
                          <Button
                            onClick={() => openTransferModal(record)}
                            variant="ghost"
                            size="sm"
                            title={t('core.transferPerson')}
                            aria-label={t('core.transferPerson')}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        )}
                        <Button onClick={() => openEditModal(record)} variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                        <Button onClick={() => { setDeleteTarget(record.id); setConfirmDelete(true); }} variant="ghost" size="sm" className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data.length > 0 && <div className="mt-4"><Pagination page={meta.page} total={meta.total} totalPages={meta.totalPages} onPageChange={(p) => fetchData(p, search)} /></div>}
      </Card>

      <Modal open={modalOpen} title={editingId ? t('core.editPersonAssignment') : t('core.newPersonAssignment')} onClose={() => { setModalOpen(false); setValidationErrors({}); }}>
        <div className="space-y-4">
          <F9Lookup
            label={t('core.personnel')}
            name="personnelId"
            value={form.personnelId}
            onChange={(v) => { setForm({ ...form, personnelId: v }); setValidationErrors(prev => ({ ...prev, personnelId: '' })); }}
            adapter={operationalPersonAdapter}
            error={validationErrors.personnelId}
          />
          <F9Lookup
            label={t('core.department')}
            name="departmentId"
            value={form.departmentId}
            onChange={(v) => { setForm({ ...form, departmentId: v }); setValidationErrors(prev => ({ ...prev, departmentId: '' })); }}
            adapter={departmentAdapter}
            error={validationErrors.departmentId}
          />
          <F9Lookup
            label={t('core.jobTitle')}
            name="jobTitleId"
            value={form.jobTitleId}
            onChange={(v) => { setForm({ ...form, jobTitleId: v }); setValidationErrors(prev => ({ ...prev, jobTitleId: '' })); }}
            adapter={jobTitleAdapter}
            error={validationErrors.jobTitleId}
          />
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.assignmentType')}</label>
            <select value={form.assignmentType} onChange={(e) => setForm({ ...form, assignmentType: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              {ASSIGNMENT_TYPES.map((type) => <option key={type} value={type}>{t(`core.assignmentTypes.${type}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('core.leadershipLevel')}</label>
            <select value={form.leadershipLevel} onChange={(e) => setForm({ ...form, leadershipLevel: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              {LEADERSHIP_LEVELS.map((level) => <option key={level} value={level}>{t(`core.leadershipLevels.${level}`)}</option>)}
            </select>
            {['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD'].includes(form.leadershipLevel) && (
              <p className="text-xs text-amber-600 mt-1">{t('core.leadershipDepartmentRequired')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('core.effectiveFrom')} *</label>
              <Input type="date" value={form.effectiveFrom} onChange={(e) => { setForm({ ...form, effectiveFrom: e.target.value }); setValidationErrors(prev => ({ ...prev, effectiveFrom: '' })); }} error={validationErrors.effectiveFrom} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('core.effectiveTo')}</label>
              <Input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('common.notes')}</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setValidationErrors({}); }}>{t('actions.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={transferModal}
        title={t('core.transferPerson')}
        size="xl"
        onClose={() => closeTransferWorkflow(Boolean(transferResult))}
      >
        <div className="space-y-4" aria-busy={previewLoading || saving}>
          {transferRecord && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{t('core.currentPlacement')}</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                 <p><span className="text-gray-500">{t('core.personnel')}:</span> <span className="font-medium">{transferRecord.person?.name || t('core.notSpecified')}</span></p>
                 <p><span className="text-gray-500">{t('core.department')}:</span> <span className="font-medium">{transferRecord.department?.name || t('core.notSpecified')}</span></p>
                 <p><span className="text-gray-500">{t('core.jobTitle')}:</span> <span className="font-medium">{transferRecord.jobTitle?.name || t('core.notSpecified')}</span></p>
                 <p><span className="text-gray-500">{t('core.branch')}:</span> <span className="font-medium">{transferRecord.branch?.name || t('core.notSpecified')}</span></p>
                 <p><span className="text-gray-500">{t('core.administration')}:</span> <span className="font-medium">{transferRecord.administration?.name || t('core.notSpecified')}</span></p>
                 <p><span className="text-gray-500">{t('core.assignmentType')}:</span> <span className="font-medium">{t(`core.assignmentTypes.${transferRecord.assignmentType}`)}</span></p>
                 <p><span className="text-gray-500">{t('core.leadershipLevel')}:</span> <span className="font-medium">{t(`core.leadershipLevels.${transferRecord.leadershipLevel || 'NONE'}`)}</span></p>
               </div>
            </div>
          )}

          <ol className="flex flex-wrap gap-1 justify-center text-xs" aria-label={t('core.transferWorkflow')}>
            {HIER_G_TRANSFER_STEPS.map((step) => (
              <li
                key={step}
                aria-current={transferStep === step ? 'step' : undefined}
                className={`flex items-center gap-1 px-2 py-1 rounded ${transferStep >= step ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-400'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${transferStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{step}</span>
                <span>{t(`core.transferStep${step}`)}</span>
              </li>
            ))}
          </ol>

          {transferStep === 1 && (
            <section className="border-t pt-4" data-transfer-step="placement">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{t('core.transferNewPlacement')}</h3>
              <div className="space-y-4">
                {!canReadSupervision && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                    {t('core.supervisionReadPermissionRequired')}
                  </div>
                )}
                <F9Lookup
                  label={t('core.branch')}
                  name="branchId"
                  value={transferForm.branchId}
                  onChange={(value) => {
                    updateTransferForm({ branchId: value, administrationId: '', departmentId: '' });
                    setTransferLabels((previous) => ({ ...previous, branch: value ? previous.branch : '', administration: '', department: '' }));
                  }}
                  onItemSelect={(item) => setTransferLabels((previous) => ({ ...previous, branch: lookupLabel(item) }))}
                  adapter={branchAdapter}
                  disabled={previewLoading}
                />
                <F9Lookup
                  label={t('core.administration')}
                  name="administrationId"
                  value={transferForm.administrationId}
                  onChange={(value) => {
                    updateTransferForm({ administrationId: value, departmentId: '' });
                    setTransferLabels((previous) => ({ ...previous, administration: value ? previous.administration : '', department: '' }));
                  }}
                  onItemSelect={(item) => setTransferLabels((previous) => ({ ...previous, administration: lookupLabel(item) }))}
                  adapter={administrationAdapter}
                  filters={transferForm.branchId ? { branchId: transferForm.branchId } : undefined}
                  disabled={previewLoading}
                />
                <F9Lookup
                  label={t('core.department')}
                  name="departmentId"
                  value={transferForm.departmentId}
                  onChange={(value) => {
                    updateTransferForm({ departmentId: value });
                    if (!value) setTransferLabels((previous) => ({ ...previous, department: '' }));
                  }}
                  onItemSelect={(item) => setTransferLabels((previous) => ({ ...previous, department: lookupLabel(item) }))}
                  adapter={departmentAdapter}
                  filters={{ ...(transferForm.branchId ? { branchId: transferForm.branchId } : {}), ...(transferForm.administrationId ? { administrationId: transferForm.administrationId } : {}) }}
                  disabled={previewLoading}
                />
                <F9Lookup
                  label={t('core.jobTitle')}
                  name="jobTitleId"
                  value={transferForm.jobTitleId}
                  onChange={(value) => {
                    updateTransferForm({ jobTitleId: value });
                    if (!value) setTransferLabels((previous) => ({ ...previous, jobTitle: '' }));
                  }}
                  onItemSelect={(item) => setTransferLabels((previous) => ({ ...previous, jobTitle: lookupLabel(item) }))}
                  adapter={jobTitleAdapter}
                  disabled={previewLoading}
                />
                <div>
                  <label className="block text-sm font-medium mb-1">{t('core.leadershipLevel')}</label>
                  <select value={transferForm.leadershipLevel} onChange={(event) => updateTransferForm({ leadershipLevel: event.target.value })} disabled={previewLoading} className="w-full border rounded px-3 py-2 text-sm disabled:opacity-50">
                    {LEADERSHIP_LEVELS.map((level) => <option key={level} value={level}>{t(`core.leadershipLevels.${level}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('core.effectiveFrom')} *</label>
                  <Input type="date" value={transferForm.effectiveFrom} onChange={(event) => updateTransferForm({ effectiveFrom: event.target.value })} disabled={previewLoading} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.notes')}</label>
                  <Input value={transferForm.notes} onChange={(event) => updateTransferForm({ notes: event.target.value })} disabled={previewLoading} />
                </div>
              </div>
            </section>
          )}

          {transferStep === 2 && transferPreview && (
            <section className="border-t pt-4 space-y-4" data-transfer-step="preview">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('core.transferPreviewTitle')}</h3>
                <p className="text-sm text-gray-500 mt-1">{t('core.transferPreviewDescription')}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-1">
                   <p className="text-xs text-blue-600 font-medium">{t('core.oldPlacement')}</p>
                   <p className="text-sm font-semibold">{transferPreview.oldAssignment.department?.name || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{transferPreview.oldAssignment.jobTitle?.name || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{transferPreview.oldAssignment.branch?.name || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{transferPreview.oldAssignment.administration?.name || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{t(`core.assignmentTypes.${transferPreview.oldAssignment.assignmentType}`)} · {t(`core.leadershipLevels.${transferPreview.oldAssignment.leadershipLevel || 'NONE'}`)}</p>
                 </div>
                 <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
                   <p className="text-xs text-green-600 font-medium">{t('core.transferNewPlacement')}</p>
                   <p className="text-sm font-semibold">{transferPreview.proposedNewAssignment.department?.name || transferLabels.department || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{transferPreview.proposedNewAssignment.jobTitle?.name || transferLabels.jobTitle || transferPreview.oldAssignment.jobTitle?.name || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{transferPreview.proposedNewAssignment.branch?.name || transferLabels.branch || transferPreview.oldAssignment.branch?.name || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{transferPreview.proposedNewAssignment.administration?.name || transferLabels.administration || transferPreview.oldAssignment.administration?.name || t('core.notSpecified')}</p>
                   <p className="text-xs text-gray-500">{t(`core.assignmentTypes.${transferPreview.proposedNewAssignment.assignmentType}`)} · {t(`core.leadershipLevels.${transferPreview.proposedNewAssignment.leadershipLevel || 'NONE'}`)}</p>
                   <p className="text-xs text-gray-500">{formatTransferDate(transferPreview.transferDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-gray-50 rounded p-2"><span>{t('core.currentInbound')}</span><strong className="block text-base">{transferPreview.summary.currentInbound}</strong></div>
                <div className="bg-gray-50 rounded p-2"><span>{t('core.currentOutbound')}</span><strong className="block text-base">{transferPreview.summary.currentOutbound}</strong></div>
                <div className="bg-gray-50 rounded p-2"><span>{t('core.futureInbound')}</span><strong className="block text-base">{transferPreview.summary.futureInbound}</strong></div>
                <div className="bg-gray-50 rounded p-2"><span>{t('core.futureOutbound')}</span><strong className="block text-base">{transferPreview.summary.futureOutbound}</strong></div>
                <div className="bg-gray-50 rounded p-2"><span>{t('core.historicalUnaffected')}</span><strong className="block text-base">{transferPreview.summary.historicalUnaffected}</strong></div>
                <div className="bg-gray-50 rounded p-2"><span>{t('core.directRelationship')}</span><strong className="block text-base">{transferPreview.summary.directCount}</strong></div>
                <div className="bg-gray-50 rounded p-2"><span>{t('core.matrixRelationship')}</span><strong className="block text-base">{transferPreview.summary.matrixCount}</strong></div>
                <div className="bg-gray-50 rounded p-2"><span>{t('core.functionalRelationship')}</span><strong className="block text-base">{transferPreview.summary.functionalCount}</strong></div>
              </div>

              {transferPreview.summary.totalAffected > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  {t('core.resolutionRequiredNotice', 'core', { count: transferPreview.summary.totalAffected })}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{t('core.noAffectedRelationships')}</div>
              )}

              {transferPreview.affectedRelationships.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {transferPreview.affectedRelationships.map((relationship) => renderRelationshipContext(relationship, false))}
                </div>
              )}
            </section>
          )}

          {transferStep === 3 && transferPreview && (
            <section className="border-t pt-4 space-y-4" data-transfer-step="resolution">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('core.transferStep3')}</h3>
                <p className="text-sm text-gray-500 mt-1">{t('core.resolveAllRelationships')}</p>
              </div>
              {requiredRelationships.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{t('core.noResolutionRequired')}</div>
              ) : (
                <>
                  <div className={`border rounded p-3 text-sm ${unresolvedRelationshipIds.length === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    {t('core.unresolvedRelationships', 'core', { count: unresolvedRelationshipIds.length })}
                  </div>
                  {lacksRequiredMutationPermission && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{t('core.supervisionMutationPermissionRequired')}</div>
                  )}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {requiredRelationships.map((relationship) => renderRelationshipContext(relationship, true))}
                  </div>
                </>
              )}
              {transferPreview.summary.historicalUnaffected > 0 && (
                <p className="text-xs text-gray-500">{t('core.historicalUnaffectedNote')}</p>
              )}
            </section>
          )}

          {transferStep === 4 && transferPreview && (
            <section className="border-t pt-4 space-y-4" data-transfer-step="confirmation">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{t('core.confirmTransferTitle')}</h3>
              <p className="text-sm text-gray-600">{t('core.confirmTransferDescription')}</p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full" />{t('core.confirmTransferCloseOld')}</li>
                <li className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full" />{t('core.confirmTransferCreateNew')}</li>
                {requiredRelationships.length > 0 && (
                  <li className="flex items-center gap-2"><span className="w-2 h-2 bg-amber-500 rounded-full" />{t('core.confirmTransferReconcile', 'core', { count: requiredRelationships.length })}</li>
                )}
              </ul>
               <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 space-y-1">
                 <p><span className="font-medium">{t('core.department')}:</span> {transferPreview.proposedNewAssignment.department?.name || transferLabels.department || t('core.notSpecified')}</p>
                 <p><span className="font-medium">{t('core.jobTitle')}:</span> {transferPreview.proposedNewAssignment.jobTitle?.name || transferLabels.jobTitle || transferPreview.oldAssignment.jobTitle?.name || t('core.notSpecified')}</p>
                 <p><span className="font-medium">{t('core.branch')}:</span> {transferPreview.proposedNewAssignment.branch?.name || transferLabels.branch || transferPreview.oldAssignment.branch?.name || t('core.notSpecified')}</p>
                 <p><span className="font-medium">{t('core.administration')}:</span> {transferPreview.proposedNewAssignment.administration?.name || transferLabels.administration || transferPreview.oldAssignment.administration?.name || t('core.notSpecified')}</p>
                 <p><span className="font-medium">{t('core.transferDateLabel')}:</span> {formatTransferDate(transferForm.effectiveFrom)}</p>
                 <p><span className="font-medium">{t('core.assignmentType')}:</span> {t(`core.assignmentTypes.${transferPreview.proposedNewAssignment.assignmentType}`)}</p>
                 <p><span className="font-medium">{t('core.leadershipLevel')}:</span> {t(`core.leadershipLevels.${transferForm.leadershipLevel}`)}</p>
                <p><span className="font-medium">{t('core.resolutionSummary')}:</span> {Object.values(transferResolutions).filter((action) => action === 'END_AT_TRANSFER').length} {t('core.ended')}, {Object.values(transferResolutions).filter((action) => action === 'CONTINUE_ON_NEW_ASSIGNMENT').length} {t('core.continued')}</p>
              </div>
              {!previewIsFresh && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{t('core.transferPreviewStale')}</div>}
              {saving && <p className="text-sm text-blue-700">{t('core.transferInProgress')}</p>}
            </section>
          )}

          {transferStep === 5 && transferResult && (
            <section className="border-t pt-4 space-y-4" data-transfer-step="result">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 font-medium text-lg">{t('core.transferSuccess')}</p>
                <p className="text-sm text-green-600 mt-2">{t('core.transferSuccessSummary', 'core', { ended: transferResult.relationshipsEnded, continued: transferResult.relationshipsContinued })}</p>
                {transferResult.newAssignment?.person?.name && <p className="text-sm text-gray-600 mt-2">{transferResult.newAssignment.person.name}</p>}
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-between gap-3 pt-4 border-t">
            {transferStep > 1 && transferStep < 5 ? (
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  if (transferStep === 2) {
                    setTransferStep(1);
                    invalidateTransferPreview();
                  } else if (transferStep === 3) {
                    setTransferStep(2);
                  } else {
                    setTransferStep(3);
                  }
                }}
              >
                {t('actions.back')}
              </Button>
            ) : <div />}
            <div className="flex flex-wrap gap-3">
              {transferStep < 5 && (
                <Button variant="secondary" disabled={saving} onClick={() => closeTransferWorkflow(false)}>{t('actions.cancel')}</Button>
              )}
              {transferStep === 1 && (
                <Button onClick={handlePreviewTransfer} loading={previewLoading} disabled={!transferForm.departmentId || !transferForm.effectiveFrom || !canOpenTransfer}>{t('core.transferStep2')}</Button>
              )}
              {transferStep === 2 && (
                <Button onClick={() => setTransferStep(3)} disabled={!previewIsFresh}>{t('core.transferStep3')}</Button>
              )}
              {transferStep === 3 && (
                <Button onClick={() => setTransferStep(4)} disabled={!confirmationReady}>{t('core.transferStep4')}</Button>
              )}
              {transferStep === 4 && (
                <Button onClick={handleApplyTransfer} loading={saving} disabled={!confirmationReady || !previewIsFresh}>{t('core.applyTransfer')}</Button>
              )}
              {transferStep === 5 && (
                <Button onClick={() => closeTransferWorkflow(true)}>{t('actions.close')}</Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDelete} title={t('common.confirmDelete')} message={t('common.confirmDeleteMessage')} onConfirm={handleDelete} onClose={() => { setConfirmDelete(false); setDeleteTarget(null); }} />
    </div>
  );
}
