'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../../components/admin/error-handler';
import { Button, Input, Textarea, PageHeader, Modal, ConfirmDialog } from '../../../../../components/admin/ui';
import { CmmsStatusBadge } from '../../../../../components/maintenance';
import type { ProductionMeasurementPoint } from '../../../../../lib/admin-types';

const MEASUREMENT_POINT_ROLES = ['INPUT', 'INTERMEDIATE', 'FINAL_OUTPUT', 'WASTE', 'REWORK'];
const MEASUREMENT_POINT_SOURCES = ['MANUAL', 'COUNTER'];
const MEASUREMENT_POINT_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH'];

function roleLabelKey(value: string): string {
  switch (value) {
    case 'INPUT': return 'production.measurementPoints.roleInput';
    case 'INTERMEDIATE': return 'production.measurementPoints.roleIntermediate';
    case 'FINAL_OUTPUT': return 'production.measurementPoints.roleFinalOutput';
    case 'WASTE': return 'production.measurementPoints.roleWaste';
    case 'REWORK': return 'production.measurementPoints.roleRework';
    default: return 'production.measurementPoints.roleInput';
  }
}

function sourceLabelKey(value: string): string {
  switch (value) {
    case 'MANUAL': return 'production.measurementPoints.sourceManual';
    case 'COUNTER': return 'production.measurementPoints.sourceCounter';
    default: return 'production.measurementPoints.sourceManual';
  }
}

function unitLabelKey(value: string): string {
  switch (value) {
    case 'PACK': return 'production.capacityUnit.PACK';
    case 'UNIT': return 'production.capacityUnit.UNIT';
    case 'KG': return 'production.capacityUnit.KG';
    case 'TON': return 'production.capacityUnit.TON';
    case 'LITER': return 'production.capacityUnit.LITER';
    case 'BATCH': return 'production.capacityUnit.BATCH';
    default: return 'production.capacityUnit.UNIT';
  }
}

export default function ProductionMeasurementPointDetailPage() {
  const { t, dir } = useTranslation();
  const params = useParams();
  const id = String(params?.id || '');
  const router = useRouter();
  const { permissions, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();

  const can = useCallback(
    (action: string) => isSuperAdmin || Boolean(permissions?.permissions.includes('production-measurement-point:' + action)),
    [isSuperAdmin, permissions],
  );

  const [point, setPoint] = useState<ProductionMeasurementPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    effectiveFrom: '',
    effectiveTo: '',
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [statusModal, setStatusModal] = useState<{ action: 'activate' | 'deactivate' } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const fetchPoint = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ProductionMeasurementPoint>('/production/measurement-points/' + id);
      setPoint(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (id) fetchPoint();
  }, [id, fetchPoint]);

  const startEdit = () => {
    if (!point) return;
    setForm({
      name: point.name,
      description: point.notes || '',
      effectiveFrom: point.effectiveFrom ? point.effectiveFrom.slice(0, 10) : '',
      effectiveTo: point.effectiveTo ? point.effectiveTo.slice(0, 10) : '',
    });
    setValidationErrors({});
    setEditing(true);
  };

  const handleSave = async () => {
    if (!point) return;
    const errors: Record<string, string> = {};
    if (!form.name) errors.name = t('validation.required');
    if (!form.effectiveFrom) errors.effectiveFrom = t('validation.required');
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      await api.patch('/production/measurement-points/' + point.id, {
        name: form.name,
        notes: form.description || null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      });
      showToast(t('common.successUpdated'), 'success');
      setEditing(false);
      await fetchPoint();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!point || !statusModal) return;
    setSaving(true);
    try {
      await api.post('/production/measurement-points/' + point.id + '/' + statusModal.action, {});
      showToast(
        statusModal.action === 'activate' ? t('common.successActivated') : t('common.successDeactivated'),
        'success',
      );
      setStatusModal(null);
      await fetchPoint();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!point) return;
    setSaving(true);
    try {
      await api.delete('/production/measurement-points/' + point.id);
      showToast(t('common.successDeleted'), 'success');
      setConfirmDeleteOpen(false);
      router.push('/admin/production/measurement-points');
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const isDraft = point?.status === 'DRAFT';
  const isActive = point?.status === 'ACTIVE';

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.measurementPoints.title')} />
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (error || !point) {
    return (
      <div>
        <PageHeader title={t('production.measurementPoints.title')} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">{error || t('common.notFound')}</div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => router.push('/admin/production/measurement-points')}>
            {t('common.backToList')}
          </Button>
        </div>
      </div>
    );
  }

  const infoCell = (label: string, value: string | number | null | undefined, opts?: { dir?: string }) => (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900" dir={opts?.dir || dir}>
        {value ?? '-'}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title={point.code + ' - ' + point.name} subtitle={t('production.measurementPoints.title')} />
        <div className="flex flex-wrap gap-2">
          {isDraft && can('update') && (
            <Button variant="secondary" onClick={startEdit}>
              {t('actions.edit')}
            </Button>
          )}
          {!isActive && can('activate') && (
            <Button onClick={() => setStatusModal({ action: 'activate' })}>{t('common.activate')}</Button>
          )}
          {isActive && can('deactivate') && (
            <Button variant="secondary" onClick={() => setStatusModal({ action: 'deactivate' })}>
              {t('common.deactivate')}
            </Button>
          )}
          {isDraft && can('delete') && (
            <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
              {t('common.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => router.push('/admin/production/measurement-points')}>
            {t('common.backToList')}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <CmmsStatusBadge status={point.status} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {infoCell(t('common.code'), point.code)}
        {infoCell(t('common.name'), point.name)}
        {infoCell(t('common.description'), point.notes)}
        {infoCell(t('production.line'), point.productionLine?.name)}
        {infoCell(t('production.machine'), point.machine?.name)}
        {infoCell(t('production.measurementPoints.machineComponent'), point.machineComponent?.name)}
        {infoCell(t('production.measurementPoints.productionUnit'), point.productionUnit?.name)}
        {infoCell(t('production.measurementPoints.role'), t(roleLabelKey(point.role)))}
        {infoCell(t('production.measurementPoints.source'), t(sourceLabelKey(point.source)))}
        {infoCell(t('production.measurementPoints.unit'), t(unitLabelKey(point.unit)))}
        {infoCell(t('production.measurementPoints.isAuthoritativeFinal'), point.isAuthoritativeFinal ? t('common.yes') : t('common.no'))}
        {infoCell(t('production.measurementPoints.counterModulus'), point.counterModulus != null ? String(point.counterModulus) : null)}
        {infoCell(t('production.measurementPoints.effectiveFrom'), point.effectiveFrom ? new Date(point.effectiveFrom).toLocaleDateString() : null)}
        {infoCell(t('production.measurementPoints.effectiveTo'), point.effectiveTo ? new Date(point.effectiveTo).toLocaleDateString() : null)}
        {infoCell(t('common.status'), point.status)}
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={t('production.measurementPoints.editPoint')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Input
              label={t('common.name')}
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setValidationErrors((prev) => ({ ...prev, name: '' }));
              }}
              required
            />
            {validationErrors.name && <p className="mt-1 text-sm text-red-500">{validationErrors.name}</p>}
          </div>
          <Textarea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={t('production.measurementPoints.effectiveFrom')}
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => {
                  setForm({ ...form, effectiveFrom: e.target.value });
                  setValidationErrors((prev) => ({ ...prev, effectiveFrom: '' }));
                }}
                required
              />
              {validationErrors.effectiveFrom && <p className="mt-1 text-sm text-red-500">{validationErrors.effectiveFrom}</p>}
            </div>
            <div>
              <Input
                label={t('production.measurementPoints.effectiveTo')}
                type="date"
                value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {t('actions.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(statusModal)}
        onClose={() => setStatusModal(null)}
        onConfirm={handleStatusChange}
        title={statusModal?.action === 'activate' ? t('common.confirmActivateTitle') : t('common.confirmDeactivateTitle')}
        message={statusModal?.action === 'activate' ? t('common.confirmActivateMessage') : t('common.confirmDeactivateMessage')}
        variant="danger"
        loading={saving}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('common.confirmDeleteMessage')}
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
