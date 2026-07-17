'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Button, Input, Select, Textarea, Card, CardContent, PageHeader } from '../../../../../components/admin/ui';
import { useRegisterAdminActions } from '../../../../../components/admin/admin-action-bar';

const SYMBOLOGIES = ['QR_CODE', 'CODE128', 'DATA_MATRIX', 'EAN13'];
const ENTITY_TYPES = ['', 'PRODUCT', 'MACHINE', 'MACHINE_PART', 'WAREHOUSE', 'WAREHOUSE_LOCATION', 'INVENTORY_COUNT', 'MAINTENANCE_REQUEST', 'MAINTENANCE_TASK'];

export default function BarcodeTemplateNewPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [symbology, setSymbology] = useState('QR_CODE');
  const [entityType, setEntityType] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [templateData, setTemplateData] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!code.trim()) errs.code = t('common.required');
    if (!name.trim()) errs.name = t('common.required');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await api.post<{ data: { id: string } }>('/barcodes/templates', {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        symbology,
        entityType: entityType || undefined,
        widthMm: widthMm ? Number(widthMm) : undefined,
        heightMm: heightMm ? Number(heightMm) : undefined,
        templateData: templateData.trim() || undefined,
      });
      showToast(t('common.successCreated'), 'success');
      router.push(`/admin/barcodes/templates/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.message || t('errors.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  useRegisterAdminActions([
    {
      id: 'save', labelKey: 'common.save',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
      onClick: handleSave, enabled: !saving,
    },
    {
      id: 'cancel', labelKey: 'common.cancel',
      icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
      onClick: () => router.push('/admin/barcodes/templates'),
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t('barcodes.templates.newTitle')} actions={
        <Button variant="secondary" onClick={() => router.push('/admin/barcodes/templates')}>{t('common.backToList')}</Button>
      } />
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('barcodes.templateCode')} value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} required />
            <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
            <Input label={t('common.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select label={t('barcodes.symbology')} value={symbology} onChange={(e) => setSymbology(e.target.value)}
              options={SYMBOLOGIES.map((s) => ({ value: s, label: s }))} />
            <Select label={t('barcodes.entityType')} value={entityType} onChange={(e) => setEntityType(e.target.value)}
              options={ENTITY_TYPES.map((et) => ({ value: et, label: et || t('common.none') }))} placeholder={t('common.select')} />
            <Input label={`${t('barcodes.widthMm')} (mm)`} type="number" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} />
            <Input label={`${t('barcodes.heightMm')} (mm)`} type="number" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} />
          </div>
          <div className="mt-4">
            <Textarea label={t('barcodes.templateData')} value={templateData} onChange={(e) => setTemplateData(e.target.value)} rows={6} />
          </div>
          <div className="flex gap-3 mt-6">
            <Button onClick={handleSave} loading={saving}>{t('common.save')}</Button>
            <Button variant="secondary" onClick={() => router.push('/admin/barcodes/templates')}>{t('common.cancel')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
