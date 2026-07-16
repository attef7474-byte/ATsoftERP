'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Machine } from '../../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, LoadingState, ErrorState, Button } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionPrintIcon } from '../../../../../../components/admin/admin-action-bar';

export default function MachineQRPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [machine, setMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Machine>(`/maintenance/machines/${id}`);
      setMachine(res);
    } catch (err: any) { setError(err?.message || t('errors.loadFailed')); }
    finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = () => { window.print(); };

  const handleGenerateQR = async () => {
    if (!machine) return;
    try {
      await api.post('/barcodes/entities/machines', { entityId: machine.id, entityType: 'machine', entityCode: machine.code, entityName: machine.name });
      showToast(t('common.successCreated'), 'success');
      fetchData();
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchData(),
    print: () => handlePrint(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'print', labelKey: 'maintenanceWorkflow.printQR', icon: <ActionPrintIcon />, onClick: () => exec('print') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">{t('maintenanceWorkflow.machineQR')}</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">{t('maintenanceWorkflow.machineQRDescription')}</p>

          {machine && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white border rounded-lg">
                {machine.qrCode ? (
                  <img src={machine.qrCode} alt={`QR for ${machine.name}`} className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                    {t('common.noData')}
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-lg font-semibold">{machine.name}</p>
                <p className="text-sm text-gray-500">{machine.code}</p>
                {machine.serialNumber && <p className="text-sm text-gray-500">{t('maintenance.serialNumber')}: {machine.serialNumber}</p>}
                {machine.model && <p className="text-sm text-gray-500">{t('maintenance.model')}: {machine.model}</p>}
                {machine.location && <p className="text-sm text-gray-500">{t('maintenance.notes')}: {machine.location}</p>}
              </div>

              {!machine.qrCode && (
                <Button onClick={handleGenerateQR}>{t('barcodes.generateLabel') || t('common.generate')}</Button>
              )}

              <div className="text-xs text-gray-400 mt-4">
                <p>{t('barcodes.scanInstruction') || t('maintenanceWorkflow.machineQRDescription')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
