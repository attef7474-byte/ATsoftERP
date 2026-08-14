'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../../lib/api';
import { unwrapApiData } from '../../lib/form-utils';
import { useOperationalContext } from '../../lib/auth-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import { F9LookupModal } from './F9LookupModal';
import type { LookupAdapter } from './types';

interface F9LookupProps<T extends Record<string, any>> {
  label?: string;
  name?: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onItemSelect?: (item: T) => void;
  adapter: LookupAdapter<T>;
  filters?: Record<string, string>;
  placeholder?: string;
  error?: string;
  description?: string;
  disabled?: boolean;
  clearOnContextChange?: boolean;
  clearOnFilterChange?: boolean;
  bindToActiveContext?: boolean;
}

export function F9Lookup<T extends Record<string, any>>({
  label,
  name,
  id,
  value,
  onChange,
  onItemSelect,
  adapter,
  filters,
  placeholder,
  error,
  description,
  disabled,
  clearOnContextChange = true,
  clearOnFilterChange = true,
  bindToActiveContext = true,
}: F9LookupProps<T>) {
  const { t } = useTranslation();
  const { activeContext, contextVersion } = useOperationalContext();
  const pathname = usePathname();
  const [modalOpen, setModalOpen] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [dataCache, setDataCache] = useState<Map<string, T>>(new Map());
  const contextKey = [
    activeContext?.companyId,
    activeContext?.branchId,
    activeContext?.administrationId,
    activeContext?.departmentId,
  ].filter(Boolean).join(':');
  const filterKey = useMemo(
    () => JSON.stringify(Object.entries(filters ?? {}).sort(([left], [right]) => left.localeCompare(right))),
    [filters],
  );
  const previousContextKeyRef = useRef<string | undefined>(undefined);
  const previousFilterKeyRef = useRef<string | undefined>(undefined);
  const operationalRoute = /^\/admin\/(inventory|maintenance|barcodes|reports)(\/|$)/.test(pathname || '');
  const contextBinding = useMemo(() => {
    if (!operationalRoute || !bindToActiveContext || !adapter.contextField || !activeContext) return null;
    const id = activeContext[adapter.contextField];
    if (!id) return null;

    const nameField = adapter.contextField.replace(/Id$/, 'Name') as
      'companyName' | 'branchName' | 'administrationName' | 'departmentName';
    const codeField = adapter.contextField.replace(/Id$/, 'Code') as
      'companyCode' | 'branchCode' | 'administrationCode' | 'departmentCode';
    return {
      id,
      label: activeContext[codeField]
        ? `[${activeContext[codeField]}] ${activeContext[nameField] || ''}`.trim()
        : activeContext[nameField] || id,
    };
  }, [activeContext, adapter.contextField, bindToActiveContext, operationalRoute]);
  const effectiveDisabled = Boolean(disabled || contextBinding);

  const fetchItem = useCallback(async (id: string) => {
    if (dataCache.has(id)) {
      setDisplayText(adapter.displayLabel(dataCache.get(id)!));
      return;
    }
    try {
      const detailEndpoint = adapter.detailEndpoint ?? adapter.endpoint;
      const res = await api.get<unknown>(`${detailEndpoint}/${id}`);
      const item = unwrapApiData<T>(res);
      if (item) {
        setDataCache((prev) => new Map(prev).set(id, item));
        setDisplayText(adapter.displayLabel(item));
      }
    } catch {
      setDisplayText(id);
    }
  }, [adapter, dataCache]);

  useEffect(() => {
    if (contextBinding) {
      setDisplayText(contextBinding.label);
      if (value !== contextBinding.id) onChange(contextBinding.id);
      return;
    }
    if (value) {
      fetchItem(value);
    } else {
      setDisplayText('');
    }
  }, [contextBinding, value, fetchItem, onChange]);

  useEffect(() => {
    const previous = previousContextKeyRef.current;
    previousContextKeyRef.current = contextKey;
    setDataCache(new Map());

    if (contextBinding && previous && previous !== contextKey) {
      setDisplayText(contextBinding.label);
      onChange(contextBinding.id);
    } else if (clearOnContextChange && previous && previous !== contextKey && value) {
      setDisplayText('');
      onChange('');
    }
  }, [clearOnContextChange, contextBinding, contextKey, contextVersion, onChange, value]);

  useEffect(() => {
    const previous = previousFilterKeyRef.current;
    previousFilterKeyRef.current = filterKey;

    if (!contextBinding && clearOnFilterChange && previous !== undefined && previous !== filterKey && value) {
      setDisplayText('');
      onChange('');
    }
  }, [clearOnFilterChange, contextBinding, filterKey, onChange, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (effectiveDisabled) return;
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
    onItemSelect?.(item);
  };

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const describedBy = [errorId, descriptionId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full" data-field={name}>
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div
        tabIndex={effectiveDisabled ? -1 : 0}
        role="button"
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        onClick={() => { if (!effectiveDisabled) setModalOpen(true); }}
        onKeyDown={handleKeyDown}
        aria-label={label || t('f9.pressToSearch')}
        className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm flex items-center justify-between ${effectiveDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'cursor-pointer'} ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
      >
        <span className={displayText ? 'text-gray-900' : 'text-gray-400'}>
          {displayText || placeholder || t('f9.pressToSearch')}
        </span>
        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      {description && !error && <p id={descriptionId} className="mt-1 text-xs text-gray-500">{description}</p>}
      {error && <p id={errorId} className="mt-1 text-sm text-red-600">{error}</p>}
      {value && !effectiveDisabled && (
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
        contextVersion={contextVersion}
      />
    </div>
  );
}
