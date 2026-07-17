'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

interface RecentSearch {
  query: string;
  entityType: string;
  timestamp: number;
}

const STORAGE_KEY = 'atsoft_recent_searches';
const MAX_ITEMS = 20;

function loadRecent(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecent(searches: RecentSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches.slice(0, MAX_ITEMS)));
  } catch { /* ignore */ }
}

export default function RecentSearchesPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  useEffect(() => { setRecent(loadRecent()); }, []);

  const clearAll = () => {
    saveRecent([]);
    setRecent([]);
  };

  const removeItem = (index: number) => {
    const updated = recent.filter((_, i) => i !== index);
    saveRecent(updated);
    setRecent(updated);
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/search'),
    refresh: () => setRecent(loadRecent()),
    clear: () => clearAll(),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const isRtl = locale === 'ar';

  return (
    <div className="p-6 max-w-4xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('search.recentSearches')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('search.recentDescription')}</p>
      {recent.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">{t('search.noRecentSearches')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {recent.map((item, idx) => (
            <div
              key={`${item.query}-${item.timestamp}-${idx}`}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => router.push(`/admin/search/results?q=${encodeURIComponent(item.query)}`)}
              >
                <div className="text-sm font-medium text-gray-900">{item.query}</div>
                <div className="text-xs text-gray-500">
                  {item.entityType ? t('search.in') + ' ' + item.entityType : ''}
                  <span className="ml-2">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
              >
                {t('search.remove')}
              </button>
            </div>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <div className="mt-6 text-center">
          <button onClick={clearAll} className="text-sm text-red-500 hover:text-red-700 underline">
            {t('search.clearRecent')}
          </button>
        </div>
      )}
    </div>
  );
}
