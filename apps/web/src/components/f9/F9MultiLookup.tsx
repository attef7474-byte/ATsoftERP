'use client';
import React, { useState, useEffect } from 'react';
import { useOperationalContext } from '../../lib/auth-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import { F9LookupModal } from './F9LookupModal';
import type { LookupAdapter } from './types';

export interface MultiLookupItem {
  id: string;
  label: string;
}

interface F9MultiLookupProps<T extends Record<string, any>> {
  label?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  adapter: LookupAdapter<T>;
  filters?: Record<string, string>;
  items?: MultiLookupItem[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  description?: string;
}

export function F9MultiLookup<T extends Record<string, any>>({
  label,
  value,
  onChange,
  adapter,
  filters,
  items,
  placeholder,
  error,
  disabled,
  description,
}: F9MultiLookupProps<T>) {
  const { t } = useTranslation();
  const { contextVersion } = useOperationalContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [cache, setCache] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!items || items.length === 0) return;
    setCache((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const it of items) {
        if (!next.has(it.id)) {
          next.set(it.id, it.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const labelFor = (id: string) => cache.get(id) ?? id;

  const toggle = (item: T) => {
    const id = String(item.id);
    setCache((prev) => new Map(prev).set(id, adapter.displayLabel(item)));
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  const inputId = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <button
        type="button"
        id={inputId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-describedby={descriptionId}
        onClick={() => { if (!disabled) setModalOpen(true); }}
        className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm flex items-center justify-between ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'cursor-pointer'} ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
      >
        <span className={value.length ? 'text-gray-900' : 'text-gray-400'}>
          {value.length ? `${value.length} ${t('f9.selected')}` : (placeholder || t('f9.pressToSearch'))}
        </span>
        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      {description && <p id={descriptionId} className="mt-1 text-xs text-gray-500">{description}</p>}
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {value.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
              <span>{labelFor(id)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`${t('f9.clear')} ${labelFor(id)}`}
                  className="text-gray-500 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <F9LookupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={() => {}}
        onToggle={toggle}
        multiSelect
        selectedIds={value}
        adapter={adapter}
        filters={filters}
        contextVersion={contextVersion}
      />
    </div>
  );
}
