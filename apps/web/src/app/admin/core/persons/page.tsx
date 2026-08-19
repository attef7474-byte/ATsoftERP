'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import type { OperationalPerson, PaginationMeta } from '@/lib/admin-types';
import { Button, Input, Card, LoadingState, Pagination } from '@/components/admin/ui';
import { Search, RefreshCw, Users } from 'lucide-react';

const INITIAL_META: PaginationMeta = { page: 1, limit: 10, total: 0, totalPages: 0 };

export default function PersonsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [data, setData] = useState<OperationalPerson[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(INITIAL_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async (page = 1, searchQuery = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/production/operational-people', { params: { page, limit: 10, search: searchQuery || undefined } }) as any;
      setData(res.data.data);
      setMeta(res.data.meta);
    } catch {
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(1, search); }, []);

  const handleSearch = () => fetchData(1, search);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{t('core.persons') || 'Persons'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(meta.page, search)} variant="secondary" size="sm"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Input placeholder={t('grid.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-sm" />
          <Button onClick={handleSearch} variant="secondary" size="sm"><Search className="h-4 w-4" /></Button>
        </div>

        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
        {loading && <LoadingState />}

        {!loading && data.length === 0 && <div className="text-center py-12 text-gray-500">{t('common.noData')}</div>}

        {!loading && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">{t('common.code')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.name')}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('core.personCategory') || 'Category'}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.phone') || 'Phone'}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.email') || 'Email'}</th>
                  <th className="text-left py-3 px-2 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((person) => (
                  <tr
                    key={person.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/core/persons/${person.id}`)}
                  >
                    <td className="py-3 px-2">{person.code}</td>
                    <td className="py-3 px-2 font-medium">{person.name}</td>
                    <td className="py-3 px-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {person.category || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs">{person.phone || '-'}</td>
                    <td className="py-3 px-2 text-xs">{person.email || '-'}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${person.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {person.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data.length > 0 && <div className="mt-4"><Pagination page={meta.page} total={meta.total} totalPages={meta.totalPages} onPageChange={(p) => fetchData(p, search)} /></div>}
      </Card>
    </div>
  );
}
