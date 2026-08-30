'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import type { OperationalPerson, OperationalPersonAssignment, SupervisorAssignment } from '@/lib/admin-types';
import { Button, Card, LoadingState, StatusBadge } from '@/components/admin/ui';
import { ArrowLeft, RefreshCw, UserCheck, Briefcase } from 'lucide-react';

type Tab = 'assignments' | 'reporting';

export default function PersonDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params?.id as string;

  const [person, setPerson] = useState<OperationalPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('assignments');

  const [assignments, setAssignments] = useState<OperationalPersonAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [supervisorAssignments, setSupervisorAssignments] = useState<SupervisorAssignment[]>([]);
  const [supervisorLoading, setSupervisorLoading] = useState(false);

  const fetchPerson = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/employees/${id}`) as any;
      setPerson(res);
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const fetchAssignments = useCallback(async () => {
    if (!id) return;
    setAssignmentsLoading(true);
    try {
      const res = await api.get('/person-assignments', { params: { personnelId: id, limit: 50 } }) as any;
      setAssignments(res.data || []);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [id]);

  const fetchSupervisorAssignments = useCallback(async () => {
    if (!id) return;
    setSupervisorLoading(true);
    try {
      const assignmentsRes = await api.get('/person-assignments', { params: { personnelId: id, limit: 50 } }) as any;
      const personAssignments: OperationalPersonAssignment[] = assignmentsRes.data || [];
      const assignmentIds = new Set(personAssignments.map((a) => a.id));

      const res = await api.get('/supervisor-assignments', { params: { limit: 100 } }) as any;
      const allSupervisor: SupervisorAssignment[] = res.data || [];
      const filtered = allSupervisor.filter(
        (sa) => assignmentIds.has(sa.assignmentId) || (sa.supervisorAssignmentId && assignmentIds.has(sa.supervisorAssignmentId))
      );
      setSupervisorAssignments(filtered);
    } catch {
      setSupervisorAssignments([]);
    } finally {
      setSupervisorLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPerson(); }, [fetchPerson]);

  useEffect(() => {
    if (person && activeTab === 'assignments') fetchAssignments();
  }, [person, activeTab, fetchAssignments]);

  useEffect(() => {
    if (person && activeTab === 'reporting') fetchSupervisorAssignments();
  }, [person, activeTab, fetchSupervisorAssignments]);

  if (loading) return <LoadingState />;
  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;
  if (!person) return null;

  const currentAssignment = assignments.find(
    (a) => !a.effectiveTo || new Date(a.effectiveTo) > new Date()
  );

  const currentSupervisor = supervisorAssignments.find(
    (sa) => sa.assignment?.personnelId === id && sa.supervisorAssignmentId && (!sa.effectiveTo || new Date(sa.effectiveTo) > new Date())
  );

  const directReports = supervisorAssignments.filter(
    (sa) => sa.supervisorAssignment?.personnelId === id && (!sa.effectiveTo || new Date(sa.effectiveTo) > new Date())
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push('/admin/core/persons')} variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('common.back')}
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{person.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('common.code')}: {person.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${person.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {person.isActive ? t('common.active') : t('common.inactive')}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{t('core.personCategory') || 'Category'}</span>
            <p className="font-medium text-gray-900 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {t(`core.employeeCategories.${person.category || 'MAINTENANCE'}`) || person.category || '-'}
              </span>
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{t('common.phone') || 'Phone'}</span>
            <p className="font-medium text-gray-900 mt-1">{person.phone || '-'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{t('common.email') || 'Email'}</span>
            <p className="font-medium text-gray-900 mt-1">{person.email || '-'}</p>
          </div>
        </div>
      </Card>

      {currentAssignment && (
        <Card>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2 uppercase tracking-wide">{t('core.currentAssignment') || 'Current Assignment'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-gray-500">{t('core.department')}</span>
                <p className="font-medium text-gray-900">{currentAssignment.department?.name || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">{t('core.jobTitle')}</span>
                <p className="font-medium text-gray-900">{currentAssignment.jobTitle?.name || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">{t('core.assignmentType')}</span>
                <p className="font-medium text-gray-900">{currentAssignment.assignmentType}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'assignments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            {t('core.assignments') || 'Assignments'}
          </button>
          <button
            onClick={() => setActiveTab('reporting')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'reporting'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            {t('core.reporting') || 'Reporting'}
          </button>
        </nav>
      </div>

      {activeTab === 'assignments' && (
        <Card>
          {assignmentsLoading ? (
            <LoadingState />
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">{t('core.department')}</th>
                    <th className="text-left py-3 px-2 font-medium">{t('core.jobTitle')}</th>
                    <th className="text-left py-3 px-2 font-medium">{t('core.assignmentType')}</th>
                    <th className="text-left py-3 px-2 font-medium">{t('core.effectiveFrom')}</th>
                    <th className="text-left py-3 px-2 font-medium">{t('core.effectiveTo')}</th>
                    <th className="text-left py-3 px-2 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">{a.department?.name || '-'}</td>
                      <td className="py-3 px-2">{a.jobTitle?.name || '-'}</td>
                      <td className="py-3 px-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {a.assignmentType}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-xs">{new Date(a.effectiveFrom).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-xs">{a.effectiveTo ? new Date(a.effectiveTo).toLocaleDateString() : '-'}</td>
                      <td className="py-3 px-2">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'reporting' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('core.mySupervisor') || 'My Supervisor'}</h3>
            {supervisorLoading ? (
              <LoadingState />
            ) : currentSupervisor ? (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-500">{t('common.name')}</span>
                    <p className="font-medium text-gray-900">{currentSupervisor.supervisorAssignment?.person?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t('core.department')}</span>
                    <p className="font-medium text-gray-900">{currentSupervisor.supervisorAssignment?.department?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t('core.relationshipType')}</span>
                    <p className="font-medium text-gray-900">{currentSupervisor.relationshipType}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">{t('core.noSupervisor') || 'No supervisor assigned'}</div>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('core.directReports') || 'Direct Reports'} ({directReports.length})</h3>
            {supervisorLoading ? (
              <LoadingState />
            ) : directReports.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">{t('core.noDirectReports') || 'No direct reports'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">{t('common.name')}</th>
                      <th className="text-left py-3 px-2 font-medium">{t('core.department')}</th>
                      <th className="text-left py-3 px-2 font-medium">{t('core.jobTitle')}</th>
                      <th className="text-left py-3 px-2 font-medium">{t('core.relationshipType')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directReports.map((sa) => (
                      <tr key={sa.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2 font-medium">{sa.assignment?.person?.name || '-'}</td>
                        <td className="py-3 px-2">{sa.assignment?.department?.name || '-'}</td>
                        <td className="py-3 px-2">{sa.assignment?.jobTitle?.name || '-'}</td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {sa.relationshipType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
