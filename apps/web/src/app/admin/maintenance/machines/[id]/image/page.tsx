'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { useTranslation } from '../../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../../components/admin/toast-provider';
import { Button, Card, CardContent, CardHeader, LoadingState, ErrorState } from '../../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../../../components/admin/admin-action-bar';
import type { Machine } from '../../../../../../lib/admin-types';

export default function MachineImagePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ data: Machine }>(`/maintenance/machines/${id}`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      await api.patch(`/maintenance/machines/${id}/image`, formData);
      showToast(t('common.successUpdated'), 'success');
      setSelectedFile(null);
      setPreview(null);
      fetchData();
    } catch (err: any) {
      showToast(err?.message || t('errors.updateFailed'), 'error');
    } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.push(`/admin/maintenance/machines/${id}`),
    refresh: () => fetchData(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold text-gray-900">{t('inventory.products')} Image</h3></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">[{data.code}] {data.name}</p>

          <div className="flex flex-col items-center mb-6">
            {preview ? (
              <img src={preview} alt="Preview" className="w-48 h-48 object-cover rounded-lg border border-gray-200" />
            ) : data.image ? (
              <img src={data.image} alt={data.name} className="w-48 h-48 object-cover rounded-lg border border-gray-200" />
            ) : (
              <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                <span className="text-sm text-gray-400">{t('common.noData')}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            <div className="flex justify-end gap-3">
              {selectedFile && (
                <Button variant="secondary" onClick={() => { setSelectedFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  {t('actions.cancel')}
                </Button>
              )}
              <Button onClick={handleUpload} loading={saving} disabled={!selectedFile}>
                {t('actions.save')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
