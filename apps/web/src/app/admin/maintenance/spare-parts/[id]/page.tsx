'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { api } from '../../../../../lib/api';
import { Card, CardContent, CardHeader, PageHeader, LoadingState, ErrorState, StatusBadge } from '../../../../../components/admin/ui';
import type { SparePart } from '../../../../../lib/admin-types';
import { formatExpectedLifeValue } from '../../../../../lib/maintenance/expected-life-display';

export default function SparePartDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const [item, setItem] = useState<SparePart | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchItem = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<SparePart>(`/maintenance/spare-parts/${params.id}`);
      setItem(res);
    } catch (e: any) {
      showToast(e.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [params.id, showToast]);

  useEffect(() => { fetchItem(); }, [fetchItem]);

  if (loading) return <LoadingState />;
  if (!item) return <ErrorState message={t('common.notFound')} />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={item.name} subtitle={`[${item.code}]`} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.category')}</h3></CardHeader><CardContent>{item.category || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.specification')}</h3></CardHeader><CardContent>{item.specification || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.unit')}</h3></CardHeader><CardContent>{item.unit || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.manufacturer')}</h3></CardHeader><CardContent>{item.manufacturer || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.model')}</h3></CardHeader><CardContent>{item.model || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.partNumber')}</h3></CardHeader><CardContent>{item.partNumber || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.barcode')}</h3></CardHeader><CardContent>{item.barcode || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.minRecommendedStock')}</h3></CardHeader><CardContent>{item.minRecommendedStock ?? '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.maxRecommendedStock')}</h3></CardHeader><CardContent>{item.maxRecommendedStock ?? '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.reorderPoint')}</h3></CardHeader><CardContent>{item.reorderPoint ?? '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.isCritical')}</h3></CardHeader><CardContent>{item.isCritical ? t('common.yes') : t('common.no')}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('common.description')}</h3></CardHeader><CardContent>{item.description || '-'}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.section.standardLife')}</h3></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs">{t('maintenance.standardExpectedLife')}</p>
            <p className="font-medium" data-testid="spare-part-standard-life">{formatExpectedLifeValue(t, item.defaultExpectedLifeValue, item.defaultExpectedLifeUnit)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t('maintenance.standardWarningThreshold')}</p>
            <p className="font-medium">{item.defaultWarningThresholdPercent ?? t('maintenance.lifeNotDefined')}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">{t('maintenance.lifeInherited')}</p>
            <p className="text-xs text-gray-500">{t('maintenance.sparePart.form.standardLifeHint')}</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.technicalClassification')}</h3></CardHeader><CardContent>{item.technicalClassification || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.usageType')}</h3></CardHeader><CardContent>{item.usageType || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.nature')}</h3></CardHeader><CardContent>{item.nature || '-'}</CardContent></Card>
        <Card><CardHeader><h3 className="text-sm font-medium">{t('maintenance.sparePart.form.importance')}</h3></CardHeader><CardContent>{item.importance || '-'}</CardContent></Card>
      </div>
    </div>
  );
}
