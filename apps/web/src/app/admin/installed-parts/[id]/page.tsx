'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Card, CardHeader, CardContent, Input, Select, LoadingState, ErrorState, LocalizedValue } from '../../../../components/admin/ui';
import { LifeStatusBadge } from '../../../../components/maintenance/life-status-badge';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { MachineInstalledPart, MachineInstalledPartReading } from '../../../../lib/admin-types';

export default function InstalledPartDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const [part, setPart] = useState<MachineInstalledPart | null>(null);
  const [readings, setReadings] = useState<MachineInstalledPartReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [lifeForm, setLifeForm] = useState({ expectedLifeValue: '', expectedLifeUnit: 'DAYS', lifeStartDate: '', lifeStartReading: '', currentReading: '', warningThresholdPercent: '80' });
  const [readingForm, setReadingForm] = useState({ readingType: 'HOURS', readingValue: '', isReset: false, notes: '' });
  const [lifeErrors, setLifeErrors] = useState<Record<string, string>>({});
  const [readingErrors, setReadingErrors] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [partRes, readingsRes] = await Promise.all([
        api.get<MachineInstalledPart>('/installed-parts/' + params.id),
        api.get<MachineInstalledPartReading[]>('/installed-parts/' + params.id + '/readings'),
      ]);
      setPart(partRes);
      setReadings(Array.isArray(readingsRes) ? readingsRes : []);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [params.id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fillLifeForm = (p: MachineInstalledPart) => {
    setLifeForm({
      expectedLifeValue: p.expectedLifeValue !== null && p.expectedLifeValue !== undefined ? String(p.expectedLifeValue) : '',
      expectedLifeUnit: p.expectedLifeUnit || 'DAYS',
      lifeStartDate: p.lifeStartDate ? new Date(p.lifeStartDate).toISOString().slice(0, 10) : '',
      lifeStartReading: p.lifeStartReading !== null && p.lifeStartReading !== undefined ? String(p.lifeStartReading) : '',
      currentReading: p.currentReading !== null && p.currentReading !== undefined ? String(p.currentReading) : '',
      warningThresholdPercent: p.warningThresholdPercent !== null && p.warningThresholdPercent !== undefined ? String(p.warningThresholdPercent) : '80',
    });
  };

  const handleSaveLife = async () => {
    const errors: Record<string, string> = {};
    if (!lifeForm.expectedLifeValue || Number(lifeForm.expectedLifeValue) <= 0) errors.expectedLifeValue = t('validation.required');
    if (lifeForm.expectedLifeUnit === 'DAYS' && !lifeForm.lifeStartDate) errors.lifeStartDate = t('validation.required');
    if (lifeForm.expectedLifeUnit !== 'DAYS' && lifeForm.lifeStartReading === '') errors.lifeStartReading = t('validation.required');
    setLifeErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload: any = {
        expectedLifeValue: Number(lifeForm.expectedLifeValue),
        expectedLifeUnit: lifeForm.expectedLifeUnit,
        warningThresholdPercent: Number(lifeForm.warningThresholdPercent) || 80,
      };
      if (lifeForm.lifeStartDate) payload.lifeStartDate = new Date(lifeForm.lifeStartDate).toISOString();
      if (lifeForm.lifeStartReading !== '') payload.lifeStartReading = Number(lifeForm.lifeStartReading);
      if (lifeForm.currentReading !== '') payload.currentReading = Number(lifeForm.currentReading);
      await api.patch(`/installed-parts/${params.id}/expected-life`, payload);
      showToast(t('common.successUpdated'), 'success');
      fetchData();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  const handleSaveReading = async () => {
    const errors: Record<string, string> = {};
    if (readingForm.readingValue === '' || Number(readingForm.readingValue) < 0) errors.readingValue = t('validation.required');
    setReadingErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload: any = {
        readingType: readingForm.readingType,
        readingValue: Number(readingForm.readingValue),
        isReset: readingForm.isReset,
      };
      if (readingForm.notes) payload.notes = readingForm.notes;
      await api.post(`/installed-parts/${params.id}/readings`, payload);
      showToast(t('common.successCreated'), 'success');
      setReadingForm({ readingType: part?.expectedLifeUnit === 'CYCLES' ? 'CYCLES' : 'HOURS', readingValue: '', isReset: false, notes: '' });
      fetchData();
    } catch (err: any) { handleApiError(err); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!part) return <ErrorState message={t('common.noData')} onRetry={fetchData} />;

  const life = part.life;
  const progressPct = life?.progress !== null && life?.progress !== undefined ? Math.round(life.progress * 100) : null;
  const readingTypeOptions = [
    { value: 'HOURS', label: t('maintenance.lifeUnitHours') },
    { value: 'CYCLES', label: t('maintenance.lifeUnitCycles') },
  ];
  const unitOptions = [
    { value: 'DAYS', label: t('maintenance.lifeUnitDays') },
    { value: 'HOURS', label: t('maintenance.lifeUnitHours') },
    { value: 'CYCLES', label: t('maintenance.lifeUnitCycles') },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('maintenance.installedPart')}</h3>
            <LifeStatusBadge status={life?.lifeStatus || part.lifeStatus} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">{t('maintenance.sparePartLabel')}</p>
              <p className="font-medium">{part.sparePart ? `${part.sparePart.code} - ${part.sparePart.name}` : '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">{t('maintenance.machine')}</p>
              <p className="font-medium">{part.machine ? `${part.machine.code} - ${part.machine.name}` : '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">{t('maintenance.machineComponent')}</p>
              <p className="font-medium">{part.machineComponent?.name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">{t('maintenance.condition')}</p>
              <p className="font-medium"><LocalizedValue value={part.installedCondition} /></p>
            </div>
            {part.maintenanceRequest && (
              <div>
                <p className="text-gray-500 text-xs">{t('maintenance.relatedRequest')}</p>
                <p className="font-medium">{part.maintenanceRequest.requestNumber}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 text-xs">{t('maintenance.expectedLifeValue')}</p>
              <p className="font-medium">{part.expectedLifeValue ? `${part.expectedLifeValue} ${t(part.expectedLifeUnit === 'DAYS' ? 'maintenance.lifeUnitDays' : part.expectedLifeUnit === 'HOURS' ? 'maintenance.lifeUnitHours' : 'maintenance.lifeUnitCycles')}` : '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">{t('maintenance.currentReading')}</p>
              <p className="font-medium">{part.currentReading ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">{t('maintenance.lifeProgress')}</p>
              <p className="font-medium">{progressPct !== null ? `${progressPct}%` : '-'}</p>
            </div>
            {life?.expectedExpiryDate && (
              <div>
                <p className="text-gray-500 text-xs">{t('maintenance.expectedExpiryDate')}</p>
                <p className="font-medium">{new Date(life.expectedExpiryDate).toLocaleDateString()}</p>
              </div>
            )}
            {life?.expectedExpiryReading !== null && life?.expectedExpiryReading !== undefined && (
              <div>
                <p className="text-gray-500 text-xs">{t('maintenance.expectedExpiryReading')}</p>
                <p className="font-medium">{life.expectedExpiryReading}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold">{t('maintenance.configureExpectedLife')}</h3></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('maintenance.expectedLifeValue')} type="number" min={0} value={lifeForm.expectedLifeValue} onChange={(e) => { setLifeForm({ ...lifeForm, expectedLifeValue: e.target.value }); setLifeErrors(prev => ({ ...prev, expectedLifeValue: '' })); }} />
              <Select label={t('maintenance.expectedLifeUnit')} value={lifeForm.expectedLifeUnit} onChange={(e) => setLifeForm({ ...lifeForm, expectedLifeUnit: e.target.value })} options={unitOptions} />
            </div>
            {lifeErrors.expectedLifeValue && <p className="text-red-500 text-sm">{lifeErrors.expectedLifeValue}</p>}
            {lifeForm.expectedLifeUnit === 'DAYS' ? (
              <Input label={t('maintenance.lifeStartDate')} type="date" value={lifeForm.lifeStartDate} onChange={(e) => { setLifeForm({ ...lifeForm, lifeStartDate: e.target.value }); setLifeErrors(prev => ({ ...prev, lifeStartDate: '' })); }} />
            ) : (
              <Input label={t('maintenance.lifeStartReading')} type="number" min={0} value={lifeForm.lifeStartReading} onChange={(e) => { setLifeForm({ ...lifeForm, lifeStartReading: e.target.value }); setLifeErrors(prev => ({ ...prev, lifeStartReading: '' })); }} />
            )}
            {lifeErrors.lifeStartDate && <p className="text-red-500 text-sm">{lifeErrors.lifeStartDate}</p>}
            {lifeErrors.lifeStartReading && <p className="text-red-500 text-sm">{lifeErrors.lifeStartReading}</p>}
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('maintenance.currentReading')} type="number" min={0} value={lifeForm.currentReading} onChange={(e) => setLifeForm({ ...lifeForm, currentReading: e.target.value })} />
              <Input label={t('maintenance.warningThreshold')} type="number" min={1} max={99} value={lifeForm.warningThresholdPercent} onChange={(e) => setLifeForm({ ...lifeForm, warningThresholdPercent: e.target.value })} />
            </div>
            <Button onClick={handleSaveLife} loading={saving} disabled={part.status !== 'ACTIVE'}>{t('actions.save')}</Button>
            {part.status !== 'ACTIVE' && <p className="text-xs text-gray-500">{t('maintenance.partNotActive')}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold">{t('maintenance.recordReading')}</h3></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('maintenance.readingType')} value={readingForm.readingType} onChange={(e) => setReadingForm({ ...readingForm, readingType: e.target.value })} options={readingTypeOptions} />
              <Input label={t('maintenance.readingValue')} type="number" min={0} value={readingForm.readingValue} onChange={(e) => { setReadingForm({ ...readingForm, readingValue: e.target.value }); setReadingErrors(prev => ({ ...prev, readingValue: '' })); }} />
            </div>
            {readingErrors.readingValue && <p className="text-red-500 text-sm">{readingErrors.readingValue}</p>}
            <Input label={t('common.description')} value={readingForm.notes} onChange={(e) => setReadingForm({ ...readingForm, notes: e.target.value })} />
            <Select label={t('maintenance.isReset')} value={String(readingForm.isReset)} onChange={(e) => setReadingForm({ ...readingForm, isReset: e.target.value === 'true' })} options={[{ value: 'false', label: t('status.false') }, { value: 'true', label: t('status.true') }]} />
            <Button onClick={handleSaveReading} loading={saving} disabled={part.status !== 'ACTIVE'}>{t('maintenance.recordReading')}</Button>
            {part.status !== 'ACTIVE' && <p className="text-xs text-gray-500">{t('maintenance.partNotActive')}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold">{t('maintenance.readings')}</h3></CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('common.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500 text-xs">
                    <th className="py-2 pr-4">{t('common.date')}</th>
                    <th className="py-2 pr-4">{t('maintenance.readingType')}</th>
                    <th className="py-2 pr-4">{t('maintenance.readingValue')}</th>
                    <th className="py-2 pr-4">{t('maintenance.isReset')}</th>
                    <th className="py-2 pr-4">{t('common.user')}</th>
                    <th className="py-2">{t('common.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2 pr-4">{new Date(r.recordedAt).toLocaleString()}</td>
                      <td className="py-2 pr-4">{t(r.readingType === 'HOURS' ? 'maintenance.lifeUnitHours' : 'maintenance.lifeUnitCycles')}</td>
                      <td className="py-2 pr-4">{r.readingValue}</td>
                      <td className="py-2 pr-4">{r.isReset ? t('status.true') : t('status.false')}</td>
                      <td className="py-2 pr-4">{r.recordedBy?.name || '-'}</td>
                      <td className="py-2">{r.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
