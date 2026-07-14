'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { api } from '../../../lib/api';
import { PageHeader, Card, CardContent, LoadingState, ErrorState } from '../../../components/admin/ui';

interface StatCard {
  label: string;
  href: string;
  count: number | null;
  error: boolean;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<StatCard[]>([
    { label: t('dashboard.companies'), href: '/admin/core/companies', count: null, error: false },
    { label: t('dashboard.branches'), href: '/admin/core/branches', count: null, error: false },
    { label: t('dashboard.departments'), href: '/admin/core/departments', count: null, error: false },
    { label: t('dashboard.users'), href: '/admin/access/users', count: null, error: false },
    { label: t('dashboard.roles'), href: '/admin/access/roles', count: null, error: false },
    { label: t('dashboard.permissions'), href: '/admin/access/permissions', count: null, error: false },
    { label: t('dashboard.warehouses'), href: '/admin/inventory/warehouses', count: null, error: false },
    { label: t('dashboard.productCategories'), href: '/admin/inventory/product-categories', count: null, error: false },
    { label: t('dashboard.products'), href: '/admin/inventory/products', count: null, error: false },
    { label: t('dashboard.machineCategories'), href: '/admin/maintenance/machine-categories', count: null, error: false },
    { label: t('dashboard.machines'), href: '/admin/maintenance/machines', count: null, error: false },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoints = [
      '/companies', '/branches', '/departments', '/users',
      '/roles', '/permissions', '/inventory/warehouses',
      '/product-categories', '/products',
      '/maintenance/machine-categories', '/maintenance/machines',
    ];

    Promise.allSettled(
      endpoints.map((ep) =>
        api.get<{ meta: { total: number } }>(ep, { params: { limit: '1', page: '1' } })
          .then((res) => res.meta.total)
          .catch(() => null),
      ),
    ).then((results) => {
      setStats((prev) =>
        prev.map((s, i) => ({
          ...s,
          count: results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<number>).value : null,
          error: results[i].status === 'rejected',
        })),
      );
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.welcome')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent>
                <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.error ? 'text-gray-400' : 'text-gray-900'}`}>
                  {stat.error ? t('dashboard.unavailable') : (stat.count ?? '-')}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
