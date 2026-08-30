'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { Card, CardContent, LoadingState, EmptyState, Input, Button, Select, Pagination, StatusBadge } from '@/components/admin/ui';
import { F9Lookup, personAssignmentAdapter } from '@/components/f9';
import { Clock, Users, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import type { HistorySupervisionRow, HistoryLeadershipRow, HistoryResponse, HistoryFilters } from '@/lib/admin-types';
import type { TranslationNamespace } from '@/lib/i18n';

interface HistoryTimelineProps {
  personId?: string;
  assignmentId?: string;
}

const TEMPORAL_BADGES: Record<string, string> = {
  PAST: 'bg-gray-100 text-gray-700',
  CURRENT: 'bg-green-100 text-green-800',
  FUTURE: 'bg-blue-100 text-blue-800',
};

const RELATIONSHIP_BADGES: Record<string, string> = {
  DIRECT: 'bg-blue-100 text-blue-800',
  MATRIX: 'bg-purple-100 text-purple-800',
  FUNCTIONAL: 'bg-amber-100 text-amber-800',
};

const ASSIGNMENT_BADGES: Record<string, string> = {
  PRIMARY: 'bg-blue-100 text-blue-800',
  ACTING: 'bg-amber-100 text-amber-800',
  SECONDARY: 'bg-gray-100 text-gray-600',
  TEMPORARY: 'bg-orange-100 text-orange-800',
};

const LEADERSHIP_BADGES: Record<string, string> = {
  NONE: 'bg-gray-100 text-gray-600',
  TEAM_LEAD: 'bg-blue-100 text-blue-800',
  SUPERVISOR: 'bg-green-100 text-green-800',
  DEPARTMENT_HEAD: 'bg-purple-100 text-purple-800',
  ADMINISTRATION_MANAGER: 'bg-amber-100 text-amber-800',
};

const TEMPORAL_OPTIONS = ['ALL', 'PAST', 'CURRENT', 'FUTURE'];
const RELATIONSHIP_OPTIONS = ['ALL', 'DIRECT', 'MATRIX', 'FUNCTIONAL'];
const LEADERSHIP_OPTIONS = ['ALL', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'];
const ASSIGNMENT_OPTIONS = ['ALL', 'PRIMARY', 'ACTING', 'SECONDARY', 'TEMPORARY'];

export default function HistoryTimeline({ personId, assignmentId }: HistoryTimelineProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'supervision' | 'leadership'>('supervision');
  const [data, setData] = useState<HistoryResponse<HistorySupervisionRow> | HistoryResponse<HistoryLeadershipRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<HistoryFilters>({
    personId: personId || undefined,
    assignmentId: assignmentId || undefined,
    status: 'ALL',
    relationshipType: 'ALL',
    leadershipLevel: 'ALL',
    assignmentType: 'ALL',
    from: '',
    to: '',
  });

  const [appliedFilters, setAppliedFilters] = useState<HistoryFilters>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit: 25 };
      if (appliedFilters.personId) params.personId = appliedFilters.personId;
      if (appliedFilters.assignmentId) params.assignmentId = appliedFilters.assignmentId;
      if (appliedFilters.supervisorAssignmentId) params.supervisorAssignmentId = appliedFilters.supervisorAssignmentId;
      if (appliedFilters.status && appliedFilters.status !== 'ALL') params.status = appliedFilters.status;
      if (appliedFilters.from) params.from = appliedFilters.from;
      if (appliedFilters.to) params.to = appliedFilters.to;
      if (mode === 'supervision') {
        if (appliedFilters.relationshipType && appliedFilters.relationshipType !== 'ALL') params.relationshipType = appliedFilters.relationshipType;
        if (appliedFilters.personId) params.personId = appliedFilters.personId;
        const res = await api.get<HistoryResponse<HistorySupervisionRow>>('/supervisor-assignments/history', { params });
        setData(res);
      } else {
        if (appliedFilters.leadershipLevel && appliedFilters.leadershipLevel !== 'ALL') params.leadershipLevel = appliedFilters.leadershipLevel;
        if (appliedFilters.assignmentType && appliedFilters.assignmentType !== 'ALL') params.assignmentType = appliedFilters.assignmentType;
        if (appliedFilters.branchId) params.branchId = appliedFilters.branchId;
        if (appliedFilters.administrationId) params.administrationId = appliedFilters.administrationId;
        if (appliedFilters.departmentId) params.departmentId = appliedFilters.departmentId;
        const res = await api.get<HistoryResponse<HistoryLeadershipRow>>('/supervisor-assignments/history/leadership', { params });
        setData(res);
      }
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, appliedFilters, mode, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (personId) {
      setFilters(prev => ({ ...prev, personId }));
      setAppliedFilters(prev => ({ ...prev, personId }));
      setPage(1);
    }
  }, [personId]);

  useEffect(() => {
    if (assignmentId) {
      setFilters(prev => ({ ...prev, assignmentId }));
      setAppliedFilters(prev => ({ ...prev, assignmentId }));
      setPage(1);
    }
  }, [assignmentId]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const handleClearFilters = () => {
    const cleared: HistoryFilters = {
      personId: personId || undefined,
      assignmentId: assignmentId || undefined,
      status: 'ALL',
      relationshipType: 'ALL',
      leadershipLevel: 'ALL',
      assignmentType: 'ALL',
      from: '',
      to: '',
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  };

  const formatDate = (d: string | null) => {
    if (!d) return t('core.notSpecified');
    return new Date(d).toLocaleDateString();
  };

  const formatPresent = (d: string | null) => {
    if (!d) return t('core.current');
    return new Date(d).toLocaleDateString();
  };

  const temporalBadge = (status: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TEMPORAL_BADGES[status] || 'bg-gray-100 text-gray-600'}`}>
      {t(`core.temporalCategories.${status}`)}
    </span>
  );

  const relationshipBadge = (type: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RELATIONSHIP_BADGES[type] || 'bg-gray-100 text-gray-600'}`}>
      {t(`core.relationshipTypes.${type}`)}
    </span>
  );

  const assignmentBadge = (type: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ASSIGNMENT_BADGES[type] || 'bg-gray-100 text-gray-600'}`}>
      {t(`core.assignmentTypes.${type}`)}
    </span>
  );

  const leadershipBadge = (level: string) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${LEADERSHIP_BADGES[level] || 'bg-gray-100 text-gray-600'}`}>
      {t(`core.leadershipLevels.${level}`)}
    </span>
  );

  const temporalFilterOptions = TEMPORAL_OPTIONS.map(v => ({ value: v, label: v === 'ALL' ? t('core.allTemporalStatuses') : t(`core.temporalCategories.${v}`) }));
  const relationshipFilterOptions = RELATIONSHIP_OPTIONS.map(v => ({ value: v, label: v === 'ALL' ? t('core.allRelationshipTypes') : t(`core.relationshipTypes.${v}`) }));
  const leadershipFilterOptions = LEADERSHIP_OPTIONS.map(v => ({ value: v, label: v === 'ALL' ? t('core.allLeadershipRoles') : t(`core.leadershipLevels.${v}`) }));
  const assignmentFilterOptions = ASSIGNMENT_OPTIONS.map(v => ({ value: v, label: v === 'ALL' ? t('core.allAssignmentTypes') : t(`core.assignmentTypes.${v}`) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {t('core.timelineHistory')}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setMode('supervision'); setPage(1); setExpandedRow(null); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  mode === 'supervision' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" />
                  {t('core.supervisionHistory')}
                </span>
              </button>
              <button
                onClick={() => { setMode('leadership'); setPage(1); setExpandedRow(null); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  mode === 'leadership' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {t('core.leadershipHistory')}
                </span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            <F9Lookup
              label={t('core.personnel')}
              name="personId"
              value={filters.personId || ''}
              onChange={(id) => setFilters(prev => ({ ...prev, personId: id || undefined }))}
              adapter={personAssignmentAdapter}
              placeholder={t('grid.searchPlaceholder')}
            />
            <Select
              options={temporalFilterOptions}
              value={filters.status || 'ALL'}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            />
            {mode === 'supervision' && (
              <Select
                options={relationshipFilterOptions}
                value={filters.relationshipType || 'ALL'}
                onChange={(e) => setFilters(prev => ({ ...prev, relationshipType: e.target.value }))}
              />
            )}
            {mode === 'leadership' && (
              <>
                <Select
                  options={leadershipFilterOptions}
                  value={filters.leadershipLevel || 'ALL'}
                  onChange={(e) => setFilters(prev => ({ ...prev, leadershipLevel: e.target.value }))}
                />
                <Select
                  options={assignmentFilterOptions}
                  value={filters.assignmentType || 'ALL'}
                  onChange={(e) => setFilters(prev => ({ ...prev, assignmentType: e.target.value }))}
                />
              </>
            )}
            <Input
              type="date"
              value={filters.from || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value || undefined }))}
              className="text-sm"
            />
            <Input
              type="date"
              value={filters.to || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value || undefined }))}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2 mb-4">
            <Button onClick={handleApplyFilters} variant="secondary" size="sm">
              {t('common.search')}
            </Button>
            <Button onClick={handleClearFilters} variant="ghost" size="sm">
              {t('common.reset')}
            </Button>
          </div>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <EmptyState message={error} />
          ) : !data || data.data.length === 0 ? (
            <EmptyState message={mode === 'supervision' ? t('core.noSupervisionHistory') : t('core.noLeadershipHistory')} />
          ) : (
            <>
              <div className="overflow-x-auto">
                {mode === 'supervision' ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.subordinate')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.supervisor')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.relationshipType')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.effectiveFrom')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.effectiveTo')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.temporalStatus')}</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.data as HistorySupervisionRow[]).map((row) => (
                        <SupervisionRow
                          key={row.id}
                          row={row}
                          expanded={expandedRow === row.id}
                          onToggle={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                          formatDate={formatDate}
                          formatPresent={formatPresent}
                          temporalBadge={temporalBadge}
                          relationshipBadge={relationshipBadge}
                          assignmentBadge={assignmentBadge}
                          t={t}
                        />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.personnel')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.leadershipLevel')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.assignmentType')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.department')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.effectiveFrom')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.effectiveTo')}</th>
                        <th className="text-start py-3 px-2 font-medium text-gray-600">{t('core.temporalStatus')}</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.data as HistoryLeadershipRow[]).map((row) => (
                        <LeadershipRow
                          key={row.id}
                          row={row}
                          expanded={expandedRow === row.id}
                          onToggle={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                          formatDate={formatDate}
                          formatPresent={formatPresent}
                          temporalBadge={temporalBadge}
                          leadershipBadge={leadershipBadge}
                          assignmentBadge={assignmentBadge}
                          t={t}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {data.meta.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    page={data.meta.page}
                    total={data.meta.total}
                    totalPages={data.meta.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SupervisionRow({
  row, expanded, onToggle, formatDate, formatPresent, temporalBadge, relationshipBadge, assignmentBadge, t,
}: {
  row: HistorySupervisionRow;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (d: string | null) => string;
  formatPresent: (d: string | null) => string;
  temporalBadge: (s: string) => React.ReactNode;
  relationshipBadge: (s: string) => React.ReactNode;
  assignmentBadge: (s: string) => React.ReactNode;
  t: (key: string, ns?: TranslationNamespace, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="py-3 px-2">
          <div className="font-medium">{row.subordinate?.person?.name || '-'}</div>
          <div className="text-xs text-gray-400">{row.subordinate?.person?.code}</div>
        </td>
        <td className="py-3 px-2">
          <div className="font-medium">{row.supervisor?.person?.name || '-'}</div>
          <div className="text-xs text-gray-400">{row.supervisor?.person?.code}</div>
        </td>
        <td className="py-3 px-2">{relationshipBadge(row.relationshipType)}</td>
        <td className="py-3 px-2 text-xs">{formatDate(row.effectiveFrom)}</td>
        <td className="py-3 px-2 text-xs">{formatPresent(row.effectiveTo)}</td>
        <td className="py-3 px-2">{temporalBadge(row.temporalStatus)}</td>
        <td className="py-3 px-2">
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-3 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">{t('core.subordinate')}</p>
                <p className="font-medium">{row.subordinate?.person?.name || '-'}</p>
                <p className="text-xs text-gray-400">{row.subordinate?.jobTitle?.name || '-'}</p>
                <p className="text-xs text-gray-400">{row.subordinate?.department?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.supervisor')}</p>
                <p className="font-medium">{row.supervisor?.person?.name || '-'}</p>
                <p className="text-xs text-gray-400">{row.supervisor?.jobTitle?.name || '-'}</p>
                <p className="text-xs text-gray-400">{row.supervisor?.department?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.effectiveFrom')}</p>
                <p className="font-medium">{formatDate(row.effectiveFrom)}</p>
                <p className="text-xs text-gray-500 mt-2">{t('core.effectiveTo')}</p>
                <p className="font-medium">{formatPresent(row.effectiveTo)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.assignmentType')}</p>
                {row.subordinate?.assignmentType && assignmentBadge(row.subordinate.assignmentType)}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LeadershipRow({
  row, expanded, onToggle, formatDate, formatPresent, temporalBadge, leadershipBadge, assignmentBadge, t,
}: {
  row: HistoryLeadershipRow;
  expanded: boolean;
  onToggle: () => void;
  formatDate: (d: string | null) => string;
  formatPresent: (d: string | null) => string;
  temporalBadge: (s: string) => React.ReactNode;
  leadershipBadge: (s: string) => React.ReactNode;
  assignmentBadge: (s: string) => React.ReactNode;
  t: (key: string, ns?: TranslationNamespace, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <tr className="border-b hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="py-3 px-2">
          <div className="font-medium">{row.person?.name || '-'}</div>
          <div className="text-xs text-gray-400">{row.person?.code}</div>
        </td>
        <td className="py-3 px-2">{leadershipBadge(row.leadershipLevel)}</td>
        <td className="py-3 px-2">{assignmentBadge(row.assignmentType)}</td>
        <td className="py-3 px-2 text-xs">{row.department?.name || '-'}</td>
        <td className="py-3 px-2 text-xs">{formatDate(row.effectiveFrom)}</td>
        <td className="py-3 px-2 text-xs">{formatPresent(row.effectiveTo)}</td>
        <td className="py-3 px-2">{temporalBadge(row.temporalStatus)}</td>
        <td className="py-3 px-2">
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 py-3 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">{t('core.personnel')}</p>
                <p className="font-medium">{row.person?.name || '-'}</p>
                <p className="text-xs text-gray-400">{row.person?.code}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.jobTitle')}</p>
                <p className="font-medium">{row.jobTitle?.name || t('core.notSpecified')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.department')}</p>
                <p className="font-medium">{row.department?.name || '-'}</p>
                <p className="text-xs text-gray-500 mt-2">{t('core.branch')}</p>
                <p className="font-medium">{row.branch?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('core.effectiveFrom')}</p>
                <p className="font-medium">{formatDate(row.effectiveFrom)}</p>
                <p className="text-xs text-gray-500 mt-2">{t('core.effectiveTo')}</p>
                <p className="font-medium">{formatPresent(row.effectiveTo)}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
