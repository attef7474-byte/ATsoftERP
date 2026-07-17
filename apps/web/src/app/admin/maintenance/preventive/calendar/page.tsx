'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { MaintenanceSchedule } from '../../../../../lib/admin-types';
import { Card, Button, PageHeader, LoadingState, ErrorState, EmptyState } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import { useRegisterAdminActions, useStableHandlers, ActionRefreshIcon } from '../../../../../components/admin/admin-action-bar';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PreventiveCalendarPage() {
  const { t } = useTranslation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: MaintenanceSchedule[] }>('/maintenance/preventive/calendar', { params: { year, month: month + 1 } });
      setData(res.data || []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [year, month, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else { setMonth(m => m - 1); } setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else { setMonth(m => m + 1); } setSelectedDay(null); };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const calendarDays: (number | null)[] = Array(firstDayOfWeek).fill(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getSchedulesForDay = (day: number) => {
    return data.filter((s) => {
      const sd = s.startDate ? new Date(s.startDate) : null;
      return sd && sd.getFullYear() === year && sd.getMonth() === month && sd.getDate() === day;
    });
  };

  const { exec } = useStableHandlers({
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  return (
    <div>
      <PageHeader title={t('maintenance.preventiveCalendar')} />
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Button variant="secondary" onClick={prevMonth}>{t('common.previous')}</Button>
          <h2 className="text-xl font-bold">{MONTH_NAMES[month]} {year}</h2>
          <Button variant="secondary" onClick={nextMonth}>{t('common.next')}</Button>
        </div>

        {error && <ErrorState message={error} onRetry={fetchData} />}
        {!error && loading && <LoadingState />}
        {!error && !loading && (
          <>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map((dn) => (
                <div key={dn} className="text-center text-xs font-semibold text-gray-500 py-2">{dn}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="min-h-[80px]" />;
                const daySchedules = getSchedulesForDay(day);
                const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
                const isSelected = selectedDay === day;
                return (
                  <div
                    key={`day-${day}`}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`min-h-[80px] p-1 border rounded cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : isToday ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</div>
                    {daySchedules.slice(0, 2).map((s) => (
                      <div key={s.id} className="text-[10px] leading-tight mb-0.5 truncate rounded px-0.5 bg-indigo-100 text-indigo-700">
                        {s.title}
                      </div>
                    ))}
                    {daySchedules.length > 2 && <div className="text-[10px] text-gray-400">+{daySchedules.length - 2} more</div>}
                  </div>
                );
              })}
            </div>

            {selectedDay && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {MONTH_NAMES[month]} {selectedDay}, {year}
                </h3>
                {(() => {
                  const daySchedules = getSchedulesForDay(selectedDay);
                  if (daySchedules.length === 0) return <EmptyState message={t('common.noData')} />;
                  return (
                    <div className="space-y-2">
                      {daySchedules.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                          <div>
                            <a href={`/admin/maintenance/schedules/${s.id}`} className="font-medium text-blue-600 hover:text-blue-800">{s.title}</a>
                            <p className="text-xs text-gray-500">{s.machine?.name || '-'} - {t(`status.${s.maintenanceType}` as any) || s.maintenanceType}</p>
                          </div>
                          <CmmsStatusBadge status={s.status} />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
