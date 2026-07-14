'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../lib/i18n/use-translation';
import { F9LookupModal } from './F9LookupModal';
import type { LookupAdapter } from './types';

interface F9LookupProps<T extends Record<string, any>> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  adapter: LookupAdapter<T>;
  filters?: Record<string, string>;
  placeholder?: string;
  error?: string;
}

export function F9Lookup<T extends Record<string, any>>({ label, value, onChange, adapter, filters, placeholder, error }: F9LookupProps<T>) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [dataCache, setDataCache] = useState<Map<string, T>>(new Map());

  const fetchItem = useCallback(async (id: string) => {
    if (dataCache.has(id)) {
      setDisplayText(adapter.displayLabel(dataCache.get(id)!));
      return;
    }
    try {
      const res = await api.get<{ data: T }>(`${adapter.endpoint}/${id}`);
      const item = res.data;
      if (item) {
        setDataCache((prev) => new Map(prev).set(id, item));
        setDisplayText(adapter.displayLabel(item));
      }
    } catch {
      setDisplayText(id);
    }
  }, [adapter, dataCache]);

  useEffect(() => {
    if (value) {
      fetchItem(value);
    } else {
      setDisplayText('');
    }
  }, [value, fetchItem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F9' || (e.key === ' ' && e.ctrlKey)) {
      e.preventDefault();
      setModalOpen(true);
    }
    if (e.key === 'Enter' && !modalOpen) {
      setModalOpen(true);
    }
  };

  const handleSelect = (item: T) => {
    const id = String(item.id);
    setDataCache((prev) => new Map(prev).set(id, item));
    setDisplayText(adapter.displayLabel(item));
    onChange(id);
  };

  const inputId = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined;

  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div
        tabIndex={0}
        role="button"
        id={inputId}
        onClick={() => setModalOpen(true)}
        onKeyDown={handleKeyDown}
        className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm cursor-pointer flex items-center justify-between ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
      >
        <span className={displayText ? 'text-gray-900' : 'text-gray-400'}>
          {displayText || placeholder || t('f9.pressToSearch')}
        </span>
        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); setDisplayText(''); }}
          className="mt-1 text-xs text-red-500 hover:text-red-700"
        >
          {t('f9.clear')}
        </button>
      )}
      <F9LookupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
        adapter={adapter}
        filters={filters}
      />
    </div>
  );
}
