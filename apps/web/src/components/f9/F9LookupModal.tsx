'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../lib/i18n/use-translation';
import type { PaginatedResponse } from '../../lib/admin-types';
import type { LookupAdapter } from './types';

interface F9LookupModalProps<T extends Record<string, any>> {
  open: boolean;
  onClose: () => void;
  onSelect: (item: T) => void;
  adapter: LookupAdapter<T>;
  filters?: Record<string, string>;
}

export function F9LookupModal<T extends Record<string, any>>({ open, onClose, onSelect, adapter, filters }: F9LookupModalProps<T>) {
  const { t } = useTranslation();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: p, limit: 10 };
      if (q) params.search = q;
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      }
      const res = await api.get<PaginatedResponse<T>>(adapter.endpoint, { params });
      setData(res.data || []);
      setTotalPages(res.meta?.totalPages || 1);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [adapter.endpoint, filters]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setPage(1);
      setHighlightedIndex(-1);
      fetchData(1, '');
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open, fetchData]);

  useEffect(() => {
    setPage(1);
    setHighlightedIndex(-1);
    fetchData(1, search);
  }, [search, fetchData]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, data.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && data[highlightedIndex]) {
          onSelect(data[highlightedIndex]);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('f9.search')}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
          {!loading && data.length === 0 && (
            <p className="text-center py-8 text-sm text-gray-500">{t('f9.noRecords')}</p>
          )}
          {!loading && data.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {adapter.columns.map((col) => (
                    <th key={col.key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((item, idx) => (
                  <tr
                    key={item.id ?? idx}
                    onClick={() => { onSelect(item); onClose(); }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`cursor-pointer transition-colors ${highlightedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {adapter.columns.map((col) => (
                      <td key={col.key} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {col.render ? col.render(item) : String(item[col.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-600">{t('f9.page')} {page} {t('f9.of')} {totalPages}</div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); fetchData(page - 1, search); }}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.previous')}
              </button>
              <button
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); fetchData(page + 1, search); }}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
