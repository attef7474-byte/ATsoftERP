'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { LoadingState, ErrorState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

const ENTITY_ROUTES: Record<string, string> = {
  company: '/admin/core/companies',
  branch: '/admin/core/branches',
  department: '/admin/core/departments',
  warehouse: '/admin/inventory/warehouses',
  warehouseLocation: '/admin/inventory/locations',
  product: '/admin/inventory/products',
  machine: '/admin/maintenance/machines',
  user: '/admin/access/users',
  role: '/admin/access/roles',
  maintenanceRequest: '/admin/maintenance/requests',
  inventoryCount: '/admin/inventory/counts',
};

const ENTITY_ICONS: Record<string, string> = {
  company: '🏢', branch: '📍', department: '📁', warehouse: '🏭',
  warehouseLocation: '📦', product: '📋', machine: '⚙️', user: '👤',
  role: '🔑', maintenanceRequest: '🔧', inventoryCount: '📊',
};

export default function SearchEntitiesPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [entities, setEntities] = useState<{ entityType: string; labelKey: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      try {
        const res = await api.get<{ data: { entityType: string; labelKey: string }[] }>('/search/entities');
        setEntities(res.data || []);
      } catch { setError('Failed to load entities'); }
      finally { setLoading(false); }
    };
    fetchEntities();
  }, []);

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/search'),
    refresh: () => window.location.reload(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const isRtl = locale === 'ar';

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="p-6 max-w-4xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('search.entities')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('search.entitiesDescription')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map(entity => (
          <div
            key={entity.entityType}
            onClick={() => router.push(ENTITY_ROUTES[entity.entityType] || '/admin/search')}
            className="p-4 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ENTITY_ICONS[entity.entityType] || '🔍'}</span>
              <div>
                <div className="text-sm font-medium text-gray-900">{t(entity.labelKey as any)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{entity.entityType}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
