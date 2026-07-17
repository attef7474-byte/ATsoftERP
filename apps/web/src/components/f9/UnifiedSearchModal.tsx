'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useTranslation } from '../../lib/i18n/use-translation';
import { getUnifiedSearchRegistry } from './adapter-registry';
import type { UnifiedSearchEntity } from './adapter-registry';
import type { PaginatedResponse } from '../../lib/admin-types';

interface SearchResult {
  entity: UnifiedSearchEntity;
  items: any[];
  total: number;
}

interface UnifiedSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function UnifiedSearchModal({ open, onClose }: UnifiedSearchModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const registry = useMemo(() => getUnifiedSearchRegistry(), []);
  const allEntityTypes = useMemo(() => registry.map(e => e.entityType), [registry]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setHighlightedIndex(-1);
      setSelectedTypes(new Set(allEntityTypes));
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open, allEntityTypes]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchResults = useCallback(async (q: string, types: Set<string>) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);

    const activeEntities = registry.filter(e => types.has(e.entityType));
    const batchSize = 5;
    const collected: SearchResult[] = [];

    for (let i = 0; i < activeEntities.length; i += batchSize) {
      const batch = activeEntities.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (entity) => {
          const params: Record<string, any> = { page: 1, limit: 5 };
          if (q) params.search = q;
          const res = await api.get<PaginatedResponse<any>>(entity.adapter.endpoint, { params });
          let items = res.data || [];
          if (entity.sanitize) items = items.map(entity.sanitize);
          return { entity, items, total: res.meta?.total || 0 };
        })
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value.items.length > 0) {
          collected.push(r.value);
        }
      }
    }

    collected.sort((a, b) => b.total - a.total);
    setResults(collected);
    setHighlightedIndex(-1);
    setLoading(false);
  }, [registry]);

  useEffect(() => {
    fetchResults(debouncedQuery, selectedTypes);
  }, [debouncedQuery, selectedTypes, fetchResults]);

  const flatItems = useMemo(() => {
    const items: { groupIdx: number; item: any }[] = [];
    results.forEach((group, gi) => {
      group.items.forEach(item => items.push({ groupIdx: gi, item }));
    });
    return items;
  }, [results]);

  const navigateTo = useCallback((item: any, entity: UnifiedSearchEntity) => {
    const route = entity.detailRoute(item);
    if (route) {
      try {
        const key = 'atsoft_recent_searches';
        const raw = localStorage.getItem(key);
        const recent = raw ? JSON.parse(raw) : [];
        recent.unshift({ query: entity.labelKey, entityType: entity.entityType, timestamp: Date.now() });
        localStorage.setItem(key, JSON.stringify(recent.slice(0, 20)));
      } catch { /* ignore */ }
      onClose();
      router.push(route);
    }
  }, [onClose, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && flatItems[highlightedIndex]) {
          const { groupIdx, item } = flatItems[highlightedIndex];
          navigateTo(item, results[groupIdx].entity);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const selectAll = () => setSelectedTypes(new Set(allEntityTypes));
  const deselectAll = () => setSelectedTypes(new Set());

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh]"
      onKeyDown={handleKeyDown}
    >
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[70vh] flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('unifiedSearch.searchPlaceholder')}
              className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center gap-1.5">
          <button onClick={selectAll} className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
            {t('common.all')}
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={deselectAll} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
            {t('common.none')}
          </button>
          <span className="text-gray-300 mx-1">|</span>
          {registry.map((entity) => (
            <button
              key={entity.entityType}
              onClick={() => toggleType(entity.entityType)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                selectedTypes.has(entity.entityType)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {t(entity.labelKey as any)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
          {!loading && (!debouncedQuery || results.length === 0) && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">
                {!debouncedQuery ? t('unifiedSearch.typeToSearch') : t('unifiedSearch.noResults')}
              </p>
            </div>
          )}
          {!loading && results.map((group, gi) => {
            let itemOffset = 0;
            for (let i = 0; i < gi; i++) itemOffset += results[i].items.length;
            return (
              <div key={group.entity.entityType} className="mb-4">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t(group.entity.labelKey as any)}
                </div>
                {group.items.map((item, ii) => {
                  const globalIdx = itemOffset + ii;
                  return (
                    <div
                      key={item.id}
                      onClick={() => navigateTo(item, group.entity)}
                      onMouseEnter={() => setHighlightedIndex(globalIdx)}
                      className={`px-3 py-2 cursor-pointer rounded-lg transition-colors ${
                        highlightedIndex === globalIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {group.entity.adapter.displayLabel(item)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {group.entity.subtitle?.(item) || ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
          <span>{t('unifiedSearch.footerHint')}</span>
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">&uarr;&darr;</kbd> {t('unifiedSearch.navigate')}</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">&crarr;</kbd> {t('unifiedSearch.select')}</span>
            <span><kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> {t('unifiedSearch.close')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
