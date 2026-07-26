'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useRegisterAdminActions, ActionBackIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';
import { Card, CardContent, CardHeader } from '../../../../components/admin/ui/card';
import { DataTable } from '../../../../components/admin/ui/data-table';
import { LoadingState } from '../../../../components/admin/ui/loading-state';
import { ErrorState } from '../../../../components/admin/ui/error-state';
import { EmptyState } from '../../../../components/admin/ui/empty-state';
import { StatusBadge } from '../../../../components/admin/ui/status-badge';

interface CalendarEvent {
  id: string;
  title: string;
  eventType: string;
  requestId?: string;
  scheduleId?: string;
  machineId?: string;
  machineName?: string;
  productionLineId?: string;
  productionLineName?: string;
  assignedPersonnelName?: string;
  status: string;
  priority: string;
  plannedStartAt?: string;
  plannedEndAt?: string;
  dueAt?: string;
  slaStatus?: string;
  escalationLevel?: string;
  targetRoute: string;
  color: string;
  isCompleted: boolean;
}

interface FilterOption {
  id: string;
  code?: string;
  name?: string;
}

export default function MaintenanceCalendarPage() {
  const { t, dir } = useTranslation();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filters, setFilters] = useState<any>({ personnel: [], machines: [], productionLines: [], types: [], statuses: [], priorities: [], slaStatuses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterPersonnelId, setFilterPersonnelId] = useState('');
  const [filterMachineId, setFilterMachineId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSlaStatus, setFilterSlaStatus] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { startDate: dateRange.start, endDate: dateRange.end };
      if (filterPersonnelId) params.personnelId = filterPersonnelId;
      if (filterMachineId) params.machineId = filterMachineId;
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterSlaStatus) params.slaStatus = filterSlaStatus;
      const [eventsData, filtersData] = await Promise.all([
        api.get<CalendarEvent[]>('/maintenance/calendar-workload/events', { params }),
        api.get<any>('/maintenance/calendar-workload/filters'),
      ]);
      setEvents(eventsData);
      setFilters(filtersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [dateRange, filterPersonnelId, filterMachineId, filterType, filterStatus, filterPriority, filterSlaStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().slice(0, 10);

  const navigateEvent = (event: CalendarEvent) => {
    if (event.targetRoute) window.location.href = event.targetRoute;
  };

  useRegisterAdminActions([
    { id: 'back', labelKey: 'actions.back', icon: <ActionBackIcon />, onClick: () => { window.location.href = '/admin/maintenance'; } },
    { id: 'refresh', labelKey: 'actions.refresh', icon: <ActionRefreshIcon />, onClick: fetchData },
  ]);

  const columns = [
    { key: 'title', header: t('maintenance.title'), render: (r: CalendarEvent) => (
      <button onClick={() => navigateEvent(r)} className="text-blue-600 hover:underline text-left">{r.title}</button>
    )},
    { key: 'eventType', header: t('maintenance.eventType'), render: (r: CalendarEvent) => (
      <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: r.color + '20', color: r.color }}>{r.eventType}</span>
    )},
    { key: 'machineName', header: t('maintenance.machine') },
    { key: 'status', header: t('status.status'), render: (r: CalendarEvent) => <StatusBadge status={r.status} /> },
    { key: 'priority', header: t('maintenance.priority'), render: (r: CalendarEvent) => <StatusBadge status={r.priority} /> },
    { key: 'plannedStartAt', header: t('maintenance.plannedStart'), render: (r: CalendarEvent) => r.plannedStartAt ? new Date(r.plannedStartAt).toLocaleDateString() : '-' },
    { key: 'plannedEndAt', header: t('maintenance.plannedEnd'), render: (r: CalendarEvent) => r.plannedEndAt ? new Date(r.plannedEndAt).toLocaleDateString() : '-' },
    { key: 'assignedPersonnelName', header: t('maintenance.workforce') },
    { key: 'slaStatus', header: t('maintenance.slaStatus'), render: (r: CalendarEvent) => r.slaStatus ? <StatusBadge status={r.slaStatus} /> : '-' },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('maintenance.maintenanceCalendar')}</h1>
      </div>
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('maintenance.plannedStart')}</label>
              <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('maintenance.plannedEnd')}</label>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('maintenance.workforce')}</label>
              <select value={filterPersonnelId} onChange={e => setFilterPersonnelId(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="">{t('common.all')}</option>
                {filters.personnel.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('maintenance.machine')}</label>
              <select value={filterMachineId} onChange={e => setFilterMachineId(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="">{t('common.all')}</option>
                {filters.machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('maintenance.type')}</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="">{t('common.all')}</option>
                {filters.types?.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('status.status')}</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="">{t('common.all')}</option>
                {filters.statuses?.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('maintenance.priority')}</label>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="">{t('common.all')}</option>
                {filters.priorities?.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('maintenance.slaStatus')}</label>
              <select value={filterSlaStatus} onChange={e => setFilterSlaStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="">{t('common.all')}</option>
                {filters.slaStatuses?.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {events.length === 0 ? (
            <EmptyState message={t('maintenance.noEvents')} />
          ) : (
            <DataTable columns={columns} data={events} keyExtractor={(e: CalendarEvent) => e.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
