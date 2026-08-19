'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import type { MaintenancePersonnel, OperationalPersonAssignment, SupervisorAssignment } from '@/lib/admin-types';
import { Button, Card, LoadingState, StatusBadge } from '@/components/admin/ui';
import { ArrowLeft, RefreshCw, UserCheck, Briefcase, Wrench, ClipboardList } from 'lucide-react';

type Tab = 'assignments' | 'reporting' | 'machines' | 'requests';

export default function MaintenancePersonnelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params?.id as string;

  const [personnel, setPersonnel] = useState<MaintenancePersonnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('assignments');

  const [assignments, setAssignments] = useState<OperationalPersonAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [supervisorAssignments, setSupervisorAssignments] = useState<SupervisorAssignment[]>([]);
  const [supervisorLoading, setSupervisorLoading] = useState(false);

  const fetchPersonnel = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MaintenancePersonnel>(`/maintenance/personnel/${id}`);
      setPersonnel(res);
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const fetchAssignments = useCallback(async () => {
    const personId = personnel?.operationalPersonId;
    if (!personId) return;
    setAssignmentsLoading(true);
    try {
      const res = await api.get('/v1/person-assignments', { params: { personnelId: personId, limit: 50 } }) as any;
      setAssignments(res.data.data || []);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [personnel?.operationalPersonId]);

  const fetchSupervisorAssignments = useCallback(async () => {
    const personId = personnel?.operationalPersonId;
    if (!personId) return;
    setSupervisorLoading(true);
    try {
      const assignmentsRes = await api.get('/v1/person-assignments', { params: { personnelId: personId, limit: 50 } }) as any;
      const personAssignments: OperationalPersonAssignment[] = assignmentsRes.data.data || [];
      const assignmentIds = new Set(personAssignments.map((a) => a.id));

      const res = await api.get('/v1/supervisor-assignments', { params: { limit: 100 } }) as any;
      const allSupervisor: SupervisorAssignment[] = res.data.data || [];
      const filtered = allSupervisor.filter(
        (sa) => assignmentIds.has(sa.assignmentId) || (sa.supervisorAssignmentId && assignmentIds.has(sa.supervisorAssignmentId))
      );
      setSupervisorAssignments(filtered);
    } catch {
      setSupervisorAssignments([]);
    } finally {
      setSupervisorLoading(false);
    }
  }, [personnel?.operationalPersonId]);

  useEffect(() => { fetchPersonnel(); }, [fetchPersonnel]);

  useEffect(() => {
    if (personnel && activeTab === 'assignments') fetchAssignments();
  }, [personnel, activeTab, fetchAssignments]);

  useEffect(() => {
    if (personnel && activeTab === 'reporting') fetchSupervisorAssignments();
  }, [personnel, activeTab, fetchSupervisorAssignments]);

  if (loading) return <LoadingState />;
  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;
  if (!personnel) return null;

  const currentAssignment = assignments.find(
    (a) => !a.effectiveTo || new Date(a.effectiveTo) > new Date()
  );

  const currentSupervisor = supervisorAssignments.find(
    (sa) => sa.assignment?.personnelId === personnel.operationalPersonId && sa.supervisorAssignmentId && (!sa.effectiveTo || new Date(sa.effectiveTo) > new Date())
  );

  const directReports = supervisorAssignments.filter(
    (sa) => sa.supervisorAssignment?.personnelId === personnel.operationalPersonId && (!sa.effectiveTo || new Date(sa.effectiveTo) > new Date())
  );

  const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: 'assignments', icon: <Briefcase className="h-4 w-4" />, label: t('core.assignments') || 'Assignments' },
    { key: 'reporting', icon: <UserCheck className="h-4 w-4" />, label: t('core.reporting') || 'Reporting' },
    { key: 'machines', icon: <Wrench className="h-4 w-4" />, label: t('maintenance.machineResponsibilities') || 'Machine Responsibilities' },
    { key: 'requests', icon: <ClipboardList className="h-4 w-4" />, label: t('maintenance.requestAssignments') || 'Request Assignments' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push('/admin/maintenance/personnel')} variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('common.back')}
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{personnel.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{t('common.code')}: {personnel.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${personnel.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {personnel.isActive ? t('common.active') : t('common.inactive')}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.personnelRole')}</span>
            <p className="font-medium text-gray-900 mt-1">{personnel.role}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{t('maintenance.specialty')}</span>
            <p className="font-medium text-gray-900 mt-1">{personnel.specialty || '-'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{t('common.phone')}</span>
            <p className="font-medium text-gray-900 mt-1">{personnel.phone || '-'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{t('common.email')}</span>
            <p className="font-medium text-gray-900 mt-1">{personnel.email || '-'}</p>
          </div>
        </div>
        {personnel.user && (
          <div className="mt-3 text-sm text-gray-600">
            {t('maintenance.userAccount')}: <span className="font-medium">{personnel.user.name}</span> ({personnel.user.email})
          </div>
        )}
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
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
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

      {activeTab === 'machines' && (
        <Card>
          {!personnel.machineResponsibilities || personnel.machineResponsibilities.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">{t('common.code')}</th>
                    <th className="text-left py-3 px-2 font-medium">{t('common.name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {personnel.machineResponsibilities.map((mr) => (
                    <tr key={mr.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">{mr.machine?.code || '-'}</td>
                      <td className="py-3 px-2">{mr.machine?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'requests' && (
        <Card>
          {!personnel.requestAssignments || personnel.requestAssignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">{t('maintenance.requestNumber') || 'Request #'}</th>
                    <th className="text-left py-3 px-2 font-medium">{t('common.title')}</th>
                  </tr>
                </thead>
                <tbody>
                  {personnel.requestAssignments.map((ra) => (
                    <tr key={ra.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">{ra.maintenanceRequest?.requestNumber || '-'}</td>
                      <td className="py-3 px-2">{ra.maintenanceRequest?.title || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
