'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import { useAuth } from '@/lib/auth-context';
import type {
  SupervisorAssignment, PaginationMeta, TeamResponse, TeamMember,
  CandidateRow, CandidateResponse, PreviewResponse, EligibilityCode,
} from '@/lib/admin-types';
import {
  Button, Input, Card, CardContent, LoadingState, Modal, StatusBadge,
  Pagination, ConfirmDialog, PageHeader, Select, EmptyState,
} from '@/components/admin/ui';
import { F9Lookup, personAssignmentAdapter } from '@/components/f9';
import {
  Search, Trash2, RefreshCw, UserCheck, Users,
  Eye, ChevronDown, ChevronUp, Check, TreePine,
} from 'lucide-react';
import HierarchyTree from './hierarchy-tree';

function useAssignmentTypeOptions() {
  const { t } = useTranslation();
  return useMemo(() => [
    { value: '', label: '' },
    { value: 'PRIMARY', label: t('core.assignmentTypes.PRIMARY') },
    { value: 'SECONDARY', label: t('core.assignmentTypes.SECONDARY') },
    { value: 'ADHOC', label: t('core.assignmentTypes.ACTING') },
  ], [t]);
}

interface LeaderInfo {
  assignmentId: string;
  person: { id: string; name: string; code: string };
  jobTitle: { id: string; name: string; code: string } | null;
  branch: { id: string; name: string; code: string } | null;
  administration: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  assignmentType: string;
  leadershipLevel: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

const isEligible = (status: EligibilityCode) => status === 'ELIGIBLE';

export default function SupervisorAssignmentsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { permissions, isSuperAdmin } = useAuth();

  const canRead = isSuperAdmin || Boolean(permissions?.permissions.includes('supervisor:read'));
  const canAssign = isSuperAdmin || Boolean(permissions?.permissions.includes('supervisor:assign'));
  const canRemove = isSuperAdmin || Boolean(permissions?.permissions.includes('supervisor:remove'));
  const assignmentTypeOptions = useAssignmentTypeOptions();

  const [activeTab, setActiveTab] = useState<'team' | 'relations' | 'hierarchy'>('team');

  const [leaderInfo, setLeaderInfo] = useState<LeaderInfo | null>(null);
  const [teamData, setTeamData] = useState<TeamResponse | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [candidateMeta, setCandidateMeta] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');
  const [filterAssignmentType, setFilterAssignmentType] = useState('');
  const [filterWithoutSupervisor, setFilterWithoutSupervisor] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');

  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; count: number } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [relData, setRelData] = useState<SupervisorAssignment[]>([]);
  const [relMeta, setRelMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [relLoading, setRelLoading] = useState(true);
  const [relSearch, setRelSearch] = useState('');

  const previewVersionRef = useRef(0);
  const candidateAbortRef = useRef<AbortController | null>(null);

  const loadTeam = useCallback(async (saId: string) => {
    setTeamLoading(true);
    try {
      const res = await api.get<TeamResponse>(`/supervisor-assignments/team/${saId}`);
      setTeamData(res);
    } catch {
      showToast(t('errors.loadFailed'), 'error');
    } finally {
      setTeamLoading(false);
    }
  }, [t, showToast]);

  const loadCandidates = useCallback(async (saId: string, page: number, search: string) => {
    candidateAbortRef.current?.abort();
    const controller = new AbortController();
    candidateAbortRef.current = controller;
    setCandidateLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        supervisorAssignmentId: saId,
        page,
        limit: 10,
      };
      if (search) params.search = search;
      if (filterBranch) params.branchId = filterBranch;
      if (filterDepartment) params.departmentId = filterDepartment;
      if (filterJobTitle) params.jobTitleId = filterJobTitle;
      if (filterAssignmentType) params.assignmentType = filterAssignmentType;
      if (filterWithoutSupervisor) params.withoutCurrentDirectSupervisor = 'true';

      const res = await api.get<CandidateResponse>('/supervisor-assignments/candidates', {
        params,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setCandidates(res.data);
        setCandidateMeta(res.meta);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast(t('errors.loadFailed'), 'error');
      }
    } finally {
      setCandidateLoading(false);
    }
  }, [filterBranch, filterDepartment, filterJobTitle, filterAssignmentType, filterWithoutSupervisor, t, showToast]);

  const handleLeaderSelect = useCallback((item: any) => {
    const leader: LeaderInfo = {
      assignmentId: item.id,
      person: item.person || { id: item.personnelId, name: item.personnelId, code: item.personnelId },
      jobTitle: item.jobTitle || null,
      branch: item.branch || null,
      administration: item.administration || null,
      department: item.department || null,
      assignmentType: item.assignmentType,
      leadershipLevel: item.leadershipLevel || 'NONE',
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo || null,
    };
    setLeaderInfo(leader);
    setSelectedIds(new Set());
    setPreviewData(null);
    setShowPreview(false);
    setApplyResult(null);
    setCandidatePage(1);
    setCandidateSearch('');
    setFilterBranch(leader.branch?.id || '');
    setFilterDepartment('');
    setFilterJobTitle('');
    setFilterAssignmentType('');
    setFilterWithoutSupervisor(false);
    loadTeam(item.id);
    loadCandidates(item.id, 1, '');
  }, [loadTeam, loadCandidates]);

  useEffect(() => {
    if (leaderInfo) {
      loadCandidates(leaderInfo.assignmentId, candidatePage, candidateSearch);
    }
  }, [candidatePage, candidateSearch, filterBranch, filterDepartment, filterJobTitle, filterAssignmentType, filterWithoutSupervisor]);

  useEffect(() => {
    if (activeTab === 'relations') {
      fetchRelData(1, relSearch);
    }
  }, [activeTab]);

  const fetchRelData = useCallback(async (page = 1, searchQuery = '') => {
    setRelLoading(true);
    try {
      const res = await api.get('/supervisor-assignments', { params: { page, limit: 10, search: searchQuery || undefined } }) as any;
      setRelData(res.data);
      setRelMeta(res.meta);
    } catch {
      showToast(t('errors.loadFailed'), 'error');
    } finally {
      setRelLoading(false);
    }
  }, [t, showToast]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/supervisor-assignments/${deleteTarget}`);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDelete(false);
      setDeleteTarget(null);
      fetchRelData(relMeta.page, relSearch);
      if (leaderInfo) loadTeam(leaderInfo.assignmentId);
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || t('errors.deleteFailed'), 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setPreviewData(null);
    setShowPreview(false);
    setApplyResult(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    setPreviewData(null);
    setShowPreview(false);
    setApplyResult(null);
    const eligibleOnPage = candidates.filter(c => isEligible(c.status)).map(c => c.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = eligibleOnPage.every(id => next.has(id));
      if (allSelected) eligibleOnPage.forEach(id => next.delete(id));
      else eligibleOnPage.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setPreviewData(null);
    setShowPreview(false);
    setApplyResult(null);
  };

  const allEligibleOnPageSelected = candidates.length > 0 && candidates.filter(c => isEligible(c.status)).every(c => selectedIds.has(c.id));

  const handlePreview = async () => {
    if (!leaderInfo || selectedIds.size === 0) return;
    previewVersionRef.current++;
    setPreviewLoading(true);
    setShowPreview(true);
    setApplyResult(null);
    try {
      const res = await api.post<PreviewResponse>('/supervisor-assignments/bulk/preview', {
        supervisorAssignmentId: leaderInfo.assignmentId,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        assignmentIds: Array.from(selectedIds),
      });
      setPreviewData(res);
    } catch (err: any) {
      showToast(err?.message || t('errors.loadFailed'), 'error');
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApply = async () => {
    if (!leaderInfo || !previewData) return;
    if (previewData.summary.conflicts > 0 || previewData.summary.invalid > 0) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await api.post<{ count: number }>('/supervisor-assignments/bulk', {
        supervisorAssignmentId: leaderInfo.assignmentId,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        assignmentIds: Array.from(selectedIds),
      });
      setApplyResult({ success: true, count: res.count });
      setSelectedIds(new Set());
      setPreviewData(null);
      setShowPreview(false);
      loadTeam(leaderInfo.assignmentId);
      loadCandidates(leaderInfo.assignmentId, candidatePage, candidateSearch);
      showToast(t('core.applySuccess', undefined, { count: res.count }), 'success');
    } catch (err: any) {
      const serverErrors = err?.errors || err?.details?.errors;
      if (Array.isArray(serverErrors) && serverErrors.length > 0) {
        showToast(t('core.stalePreview'), 'error');
      } else {
        showToast(err?.message || t('core.applyFailed'), 'error');
      }
      setApplyResult({ success: false, count: 0 });
    } finally {
      setApplying(false);
    }
  };

  const renderEligibilityLabel = (status: EligibilityCode) => {
    return t(`core.eligibilityStatuses.${status}`);
  };

  const renderEligibilityBadge = (status: EligibilityCode) => {
    const colors: Record<string, string> = {
      ELIGIBLE: 'bg-green-100 text-green-800',
      SELF: 'bg-gray-100 text-gray-600',
      OUTSIDE_ALLOWED_BRANCH_SCOPE: 'bg-orange-100 text-orange-800',
      ALREADY_ON_THIS_TEAM: 'bg-blue-100 text-blue-800',
      HAS_OTHER_DIRECT_SUPERVISOR: 'bg-yellow-100 text-yellow-800',
      DATE_WINDOW_CONFLICT: 'bg-red-100 text-red-800',
      DIRECT_OVERLAP: 'bg-red-100 text-red-800',
      CYCLE_DETECTED: 'bg-red-100 text-red-800',
      MISSING: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {renderEligibilityLabel(status)}
      </span>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return t('core.notSpecified');
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('core.supervisorAssignments')}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              if (activeTab === 'team' && leaderInfo) {
                loadTeam(leaderInfo.assignmentId);
                loadCandidates(leaderInfo.assignmentId, candidatePage, candidateSearch);
              } else {
                fetchRelData(relMeta.page, relSearch);
              }
            }} variant="secondary" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'team'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('core.teamManagement')}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('relations')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'relations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            {t('core.currentRelationships')}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'hierarchy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <TreePine className="h-4 w-4" />
            {t('core.hierarchyTree')}
          </span>
        </button>
      </div>

      {activeTab === 'team' && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('core.selectLeader')}</h2>
                  <F9Lookup
                    label={t('core.selectLeader')}
                    name="leaderAssignmentId"
                    value={leaderInfo?.assignmentId || ''}
                    onChange={() => {}}
                    onItemSelect={handleLeaderSelect}
                    adapter={personAssignmentAdapter}
                    placeholder={t('core.selectLeader')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {leaderInfo && (
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('core.leaderSummary')}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">{t('core.personnel')}</p>
                    <p className="text-sm font-medium">{leaderInfo.person.name}</p>
                    <p className="text-xs text-gray-400">{leaderInfo.person.code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('core.jobTitle')}</p>
                    <p className="text-sm font-medium">{leaderInfo.jobTitle?.name || t('core.notSpecified')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('core.branch')}</p>
                    <p className="text-sm font-medium">{leaderInfo.branch?.name || t('core.notSpecified')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('core.administration')}</p>
                    <p className="text-sm font-medium">{leaderInfo.administration?.name || t('core.notSpecified')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('core.department')}</p>
                    <p className="text-sm font-medium">{leaderInfo.department?.name || t('core.notSpecified')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('core.assignmentType')}</p>
                    <p className="text-sm font-medium">{t(`core.assignmentTypes.${leaderInfo.assignmentType}` as any)}</p>
                  </div>
                  {leaderInfo.leadershipLevel && leaderInfo.leadershipLevel !== 'NONE' ? (
                    <div>
                      <p className="text-xs text-gray-500">{t('core.leadershipLevel')}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {t(`core.leadershipLevels.${leaderInfo.leadershipLevel}` as any)}
                      </span>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs text-gray-500">{t('core.effectiveFrom')}</p>
                    <p className="text-sm font-medium">{formatDate(leaderInfo.effectiveFrom)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('core.effectiveTo')}</p>
                    <p className="text-sm font-medium">{formatDate(leaderInfo.effectiveTo)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{t('core.currentTeamCount')}:</span>{' '}
                    <span className="text-lg font-bold text-blue-600">{teamData?.teamCount ?? 0}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {leaderInfo && (
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('core.currentTeam')}</h2>
                {teamLoading ? (
                  <LoadingState />
                ) : teamData && teamData.team.length === 0 ? (
                  <EmptyState message={t('core.noTeamMembers')} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('core.personnel')}</th>
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('core.jobTitle')}</th>
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('core.department')}</th>
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('core.administration')}</th>
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('core.assignmentType')}</th>
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('core.effectiveFrom')}</th>
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('core.effectiveTo')}</th>
                          <th className="text-start py-3 px-3 font-medium text-gray-600">{t('common.status')}</th>
                          {canRemove && <th className="text-start py-3 px-3 font-medium text-gray-600">{t('common.actions')}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {teamData?.team.map((m) => (
                          <tr key={m.assignmentId} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-3">
                              <div className="font-medium">{m.person.name}</div>
                              <div className="text-xs text-gray-400">{m.person.code}</div>
                            </td>
                            <td className="py-3 px-3">{m.jobTitle?.name || '-'}</td>
                            <td className="py-3 px-3">{m.department?.name || '-'}</td>
                            <td className="py-3 px-3">{m.administration?.name || '-'}</td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                {t(`core.assignmentTypes.${m.assignmentType}` as any)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs">{formatDate(m.effectiveFrom)}</td>
                            <td className="py-3 px-3 text-xs">{formatDate(m.effectiveTo)}</td>
                            <td className="py-3 px-3"><StatusBadge status={m.status} /></td>
                            {canRemove && (
                              <td className="py-3 px-3">
                                <Button onClick={() => { setDeleteTarget(m.assignmentId); setConfirmDelete(true); }} variant="ghost" size="sm" className="text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {leaderInfo && (
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">{t('core.availablePeople')}</h2>
                  {selectedIds.size > 0 && (
                    <span className="text-sm text-blue-600 font-medium">
                      {t('core.selectedCount', undefined, { count: selectedIds.size })}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                  <Input
                    placeholder={t('grid.searchPlaceholder')}
                    value={candidateSearch}
                    onChange={(e) => { setCandidateSearch(e.target.value); setCandidatePage(1); }}
                    className="text-sm"
                  />
                  <Select
                    options={assignmentTypeOptions}
                    value={filterAssignmentType}
                    onChange={(e) => { setFilterAssignmentType(e.target.value); setCandidatePage(1); }}
                    placeholder={t('core.assignmentType')}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterWithoutSupervisor}
                      onChange={(e) => { setFilterWithoutSupervisor(e.target.checked); setCandidatePage(1); }}
                      className="rounded border-gray-300"
                    />
                    {t('core.noSupervisor')}
                  </label>
                </div>

                {candidateLoading ? (
                  <LoadingState />
                ) : candidates.length === 0 ? (
                  <EmptyState message={t('core.noCandidates')} />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="py-3 px-2 w-10">
                              <input
                                type="checkbox"
                                checked={allEligibleOnPageSelected}
                                onChange={toggleSelectAllPage}
                                className="rounded border-gray-300"
                                title={t('core.selectEligiblePage')}
                              />
                            </th>
                            <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.personnel')}</th>
                            <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.jobTitle')}</th>
                            <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.branch')}</th>
                            <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.department')}</th>
                            <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.assignmentType')}</th>
                            <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.result')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidates.map((c) => {
                            const eligible = isEligible(c.status);
                            const checked = selectedIds.has(c.id);
                            return (
                              <tr key={c.id} className={`border-b ${!eligible ? 'bg-gray-50 opacity-70' : 'hover:bg-blue-50'}`}>
                                <td className="py-3 px-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!eligible}
                                    onChange={() => toggleSelect(c.id)}
                                    className="rounded border-gray-300"
                                  />
                                </td>
                                <td className="py-3 px-2">
                                  <div className="font-medium">{c.person.name}</div>
                                  <div className="text-xs text-gray-400">{c.person.code}</div>
                                </td>
                                <td className="py-3 px-2">{c.jobTitle?.name || '-'}</td>
                                <td className="py-3 px-2">{c.branch?.name || '-'}</td>
                                <td className="py-3 px-2">{c.department?.name || '-'}</td>
                                <td className="py-3 px-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    {t(`core.assignmentTypes.${c.assignmentType}` as any)}
                                  </span>
                                </td>
                                <td className="py-3 px-2">
                                  {renderEligibilityBadge(c.status)}
                                  {!eligible && c.status !== 'SELF' && c.status !== 'MISSING' && (
                                    <button
                                      onClick={() => setExpandedRow(expandedRow === c.id ? null : c.id)}
                                      className="ml-1 text-gray-400 hover:text-gray-600"
                                    >
                                      {expandedRow === c.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {candidateMeta && candidateMeta.totalPages > 1 && (
                      <div className="mt-4">
                        <Pagination
                          page={candidateMeta.page}
                          total={candidateMeta.total}
                          totalPages={candidateMeta.totalPages}
                          onPageChange={setCandidatePage}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {leaderInfo && selectedIds.size > 0 && (
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('core.effectiveDateRange')}</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('core.effectiveFrom')} *</label>
                    <Input type="date" value={effectiveFrom} onChange={(e) => { setEffectiveFrom(e.target.value); setPreviewData(null); setShowPreview(false); }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('core.effectiveTo')}</label>
                    <Input type="date" value={effectiveTo} onChange={(e) => { setEffectiveTo(e.target.value); setPreviewData(null); setShowPreview(false); }} />
                  </div>
                </div>

                <div className="flex gap-3">
                  {canAssign && (
                    <>
                      <Button onClick={handlePreview} variant="secondary" loading={previewLoading}>
                        <Eye className="h-4 w-4 mr-1" />
                        {t('core.previewSelected')}
                      </Button>
                      {showPreview && previewData && previewData.summary.conflicts === 0 && previewData.summary.invalid === 0 && (
                        <Button onClick={handleApply} loading={applying}>
                          <Check className="h-4 w-4 mr-1" />
                          {t('core.addToTeam')}
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {showPreview && (
                  <div className="mt-6">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">{t('core.previewSummary')}</h3>
                    {previewLoading ? (
                      <LoadingState />
                    ) : previewData ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-5 gap-4">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-2xl font-bold text-gray-900">{previewData.summary.requested}</p>
                            <p className="text-xs text-gray-500">{t('core.requested')}</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-700">{previewData.summary.eligible}</p>
                            <p className="text-xs text-gray-500">{t('core.eligible')}</p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-700">{previewData.summary.alreadyAssigned}</p>
                            <p className="text-xs text-gray-500">{t('core.alreadyAssigned')}</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <p className="text-2xl font-bold text-red-700">{previewData.summary.conflicts}</p>
                            <p className="text-xs text-gray-500">{t('core.conflicts')}</p>
                          </div>
                          <div className="text-center p-3 bg-orange-50 rounded-lg">
                            <p className="text-2xl font-bold text-orange-700">{previewData.summary.invalid}</p>
                            <p className="text-xs text-gray-500">{t('core.invalid')}</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50">
                                <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.personnel')}</th>
                                <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.jobTitle')}</th>
                                <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.department')}</th>
                                <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.result')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.rows.map((r) => (
                                <tr key={r.assignmentId} className="border-b">
                                  <td className="py-3 px-2">
                                    <div className="font-medium">{r.person?.name || r.assignmentId}</div>
                                  </td>
                                  <td className="py-3 px-2">{r.jobTitle?.name || '-'}</td>
                                  <td className="py-3 px-2">{r.department?.name || '-'}</td>
                                  <td className="py-3 px-2">{renderEligibilityBadge(r.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {previewData.summary.conflicts > 0 && (
                          <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                            {t('core.stalePreview')}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {applyResult && (
                  <div className={`mt-4 p-4 rounded-lg ${applyResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {applyResult.success
                      ? t('core.applySuccess', undefined, { count: applyResult.count })
                      : t('core.applyFailed')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!leaderInfo && (
            <Card>
              <CardContent>
                <EmptyState message={t('core.noLeaderSelected')} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'relations' && (
        <Card>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder={t('grid.searchPlaceholder')}
                value={relSearch}
                onChange={(e) => setRelSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRelData(1, relSearch)}
                className="max-w-sm"
              />
              <Button onClick={() => fetchRelData(1, relSearch)} variant="secondary" size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {relLoading ? (
              <LoadingState />
            ) : relData.length === 0 ? (
              <EmptyState message={t('common.noData')} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.personnel')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.personnel')} ({t('core.relationshipTypes.DIRECT')})</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.relationshipType')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.effectiveFrom')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('common.status')}</th>
                        {canRemove && <th className="text-start py-3 px-2 font-medium text-gray-600">{t('common.actions')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {relData.map((record) => (
                        <tr key={record.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-2">{record.assignment?.person?.name || record.assignmentId}</td>
                          <td className="py-3 px-2">{record.supervisorAssignment?.person?.name || record.supervisorAssignmentId || '-'}</td>
                          <td className="py-3 px-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {t(`core.relationshipTypes.${record.relationshipType}`)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-xs">{new Date(record.effectiveFrom).toLocaleDateString()}</td>
                          <td className="py-3 px-2"><StatusBadge status={record.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                          {canRemove && (
                            <td className="py-3 px-2">
                              <Button onClick={() => { setDeleteTarget(record.id); setConfirmDelete(true); }} variant="ghost" size="sm" className="text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <Pagination page={relMeta.page} total={relMeta.total} totalPages={relMeta.totalPages} onPageChange={(p) => fetchRelData(p, relSearch)} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'hierarchy' && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('core.selectLeader')}</h2>
                  <F9Lookup
                    label={t('core.selectLeader')}
                    name="hierarchyAssignmentId"
                    value={leaderInfo?.assignmentId || ''}
                    onChange={() => {}}
                    onItemSelect={handleLeaderSelect}
                    adapter={personAssignmentAdapter}
                    placeholder={t('core.selectLeader')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {leaderInfo ? (
            <HierarchyTree assignmentId={leaderInfo.assignmentId} />
          ) : (
            <Card>
              <CardContent>
                <EmptyState message={t('core.selectPersonToViewHierarchy')} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('common.confirmDelete')}
        message={t('common.confirmDeleteMessage')}
        onConfirm={handleDelete}
        onClose={() => { setConfirmDelete(false); setDeleteTarget(null); }}
      />
    </div>
  );
}
