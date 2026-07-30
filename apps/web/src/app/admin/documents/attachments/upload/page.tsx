'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Card, PageHeader } from '../../../../../components/admin/ui';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon } from '../../../../../components/admin/admin-action-bar';

export default function UploadAttachmentPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [entityName, setEntityName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) { setFile(e.target.files[0]); setValidationErrors(prev => ({ ...prev, file: '' })); }
  };

  const handleUpload = async () => {
    const errors: Record<string, string> = {};
    if (!file) errors.file = t('attachments.noFileSelected');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file!);
      if (entityName) formData.append('entityName', entityName);
      if (entityId) formData.append('entityId', entityId);
      if (description) formData.append('description', description);
      await api.post('/attachments', formData);
      showToast(t('attachments.uploadSuccess'), 'success');
      router.push('/admin/documents/attachments');
    } catch (err: any) {
      handleApiError(err);
    } finally { setUploading(false); }
  };

  const { exec } = useStableHandlers({ back: () => router.back() });
  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
  ]);

  return (
    <div>
      <PageHeader title={t('attachments.uploadTitle')} />
      <Card className="max-w-lg">
        <div className="space-y-4 p-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400" onClick={() => fileInputRef.current?.click()}>
            {file ? <p className="text-sm font-medium">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p> : <p className="text-sm text-gray-500">{t('attachments.dropFile')}</p>}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            {validationErrors.file && <p className="text-red-500 text-sm mt-1">{validationErrors.file}</p>}
          </div>
          <Input label={t('attachments.entityName')} value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="e.g. machine, product" />
          <Input label={t('attachments.entityId')} value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          <Input label={t('attachments.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => router.back()}>{t('actions.cancel')}</Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!file}>{t('attachments.upload')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
