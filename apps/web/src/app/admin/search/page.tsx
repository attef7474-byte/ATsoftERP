'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../components/admin/admin-action-bar';

interface SearchResult {
  id: string; entityType: string; code: string; title: string;
  subtitle: string; description: string; status: string; route: string; metadata: Record<string, any>;
}

interface SearchGroup {
  entityType: string; labelKey: string; items: SearchResult[]; total: number;
}

const ENTITY_LABEL_KEYS: Record<string, string> = {
  company: 'core.companies', branch: 'core.branches', department: 'core.departments',
  warehouse: 'inventory.warehouses', warehouseLocation: 'inventory.locations.title',
  product: 'inventory.products', machine: 'maintenance.machines', user: 'access.users',
  role: 'access.roles', maintenanceRequest: 'maintenance.maintenanceRequests',
  inventoryCount: 'inventoryCounting.counts',
};

export default function SearchPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  const entityTypes = Object.keys(ENTITY_LABEL_KEYS);

  useEffect(() => {
    setSelectedTypes(new Set(entityTypes));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    const fetchResults = async () => {
      setLoading(true); setError('');
      try {
        const res = await api.get<{ data: SearchGroup[] }>('/search', {
          params: { q: debouncedQuery, types: Array.from(selectedTypes).join(','), page: 1, limit: 10 },
        });
        setResults(res.data || []);
      } catch (err: any) {
        setError(err?.message || 'Search failed');
      } finally { setLoading(false); }
    };
    fetchResults();
  }, [debouncedQuery, selectedTypes]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin'),
    refresh: () => setDebouncedQuery(query + ' '),
    clear: () => { setQuery(''); setDebouncedQuery(''); setResults([]); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const isRtl = locale === 'ar';

  return (
    <div className="p-6 max-w-5xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('search.title')}</h1>
      <div className="relative mb-4">
        <svg className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 ${isRtl ? 'right-3' : 'left-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          className={`block w-full rounded-lg border border-gray-300 ${isRtl ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="text-xs font-medium text-gray-500 mr-1">{t('search.entityFilter')}:</span>
        {entityTypes.map(type => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${selectedTypes.has(type) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            {t(ENTITY_LABEL_KEYS[type] as any)}
          </button>
        ))}
      </div>
      <div className="min-h-[300px]">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        )}
        {error && <div className="text-center py-8 text-red-500 text-sm">{error}</div>}
        {!loading && !error && (!debouncedQuery || results.length === 0) && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">{!debouncedQuery ? t('search.typeToSearch') : t('search.noResults')}</p>
          </div>
        )}
        {!loading && !error && results.map(group => (
          <div key={group.entityType} className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
              {t(ENTITY_LABEL_KEYS[group.entityType] as any)} ({group.total})
            </h2>
            <div className="space-y-1">
              {group.items.map(item => (
                <div
                  key={item.id}
                  onClick={() => router.push(item.route)}
                  className="px-3 py-2.5 cursor-pointer rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-200"
                >
                  <div className="text-sm font-medium text-gray-900">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.subtitle}{item.description ? ` — ${item.description}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
