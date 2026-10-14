'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { Machine, PaginatedResponse } from '../../../lib/admin-types';
import { Button, Modal } from '../ui';

export interface MachineSelection {
  id: string;
  code?: string;
  name: string;
}

interface MachineMultiSelectProps {
  value: MachineSelection[];
  onChange: (next: MachineSelection[]) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
  description?: string;
}

const labelOf = (m: { code?: string; name: string }) => (m.code ? `[${m.code}] ${m.name}` : m.name);

/**
 * Multi-machine applicability picker for the unified spare-part form.
 *
 * Selection is keyed by machine id, so duplicates can never accumulate, removing one
 * machine never clears the others, and the selection survives paging/searching inside
 * the picker. Rows are rendered as human-readable chips, never raw identifiers.
 */
export function MachineMultiSelect({ value, onChange, disabled, error, label, description }: MachineMultiSelectProps) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Map<string, MachineSelection>>(new Map());
  const [data, setData] = useState<Machine[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestVersion = useRef(0);

  const fetchMachines = useCallback(async (p: number, q: string) => {
    const version = ++requestVersion.current;
    setLoading(true); setFailed(false);
    try {
      const res = await api.get<PaginatedResponse<Machine>>('/maintenance/machines', { params: { page: p, limit: 20, search: q } });
      if (version !== requestVersion.current) return;
      setData(res.data || []);
      setTotalPages(res.meta?.totalPages || 1);
    } catch {
      if (version === requestVersion.current) { setData([]); setFailed(true); }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (modalOpen) {
      setSelected(new Map(value.map((v) => [v.id, v])));
      setSearch('');
      setPage(1);
      fetchMachines(1, '');
    } else {
      requestVersion.current += 1;
    }
  }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (modalOpen) fetchMachines(page, search);
  }, [page, search, fetchMachines, modalOpen]);

  const toggle = (machine: Machine) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(machine.id)) next.delete(machine.id);
      else next.set(machine.id, { id: machine.id, code: machine.code, name: machine.name });
      return next;
    });
  };

  const removeChip = (id: string) => onChange(value.filter((v) => v.id !== id));

  const confirm = () => {
    onChange(Array.from(selected.values()));
    setModalOpen(false);
  };

  const inputId = label ? label.toLowerCase().replace(/\s+/g, '-') : 'machine-applicability';

  return (
    <div className="w-full" data-field="machineIds">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="rounded-lg border border-gray-300 p-2 space-y-2">
        {value.length === 0 ? (
          <p className="text-sm text-gray-400 px-1">{t('maintenance.sparePart.form.noMachines')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {value.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 text-xs">
                {labelOf(m)}
                {!disabled && (
                  <button type="button" onClick={() => removeChip(m.id)} aria-label={t('common.delete')} className="text-blue-500 hover:text-blue-800">
                    &times;
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <Button type="button" variant="secondary" disabled={disabled} onClick={() => setModalOpen(true)}>
          {t('maintenance.sparePart.form.selectMachines')}
        </Button>
      </div>
      {description && !error && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('maintenance.sparePart.form.selectMachines')}>
        <div className="space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder={t('common.search')}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
            {loading && <div className="text-center py-6 text-sm text-gray-500">{t('common.loading')}</div>}
            {failed && <div className="text-center py-6 text-sm text-red-600">{t('errors.loadFailed')}</div>}
            {!loading && !failed && data.length === 0 && <div className="text-center py-6 text-sm text-gray-500">{t('f9.noRecords')}</div>}
            {!loading && !failed && data.map((m) => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m)} className="rounded border-gray-300" />
                <span className="text-sm text-gray-900">[{m.code}] {m.name}</span>
              </label>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">{t('common.previous')}</button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">{t('common.next')}</button>
            </div>
          )}
          <p className="text-xs text-gray-500">{t('maintenance.sparePart.form.selectedMachinesCount', undefined, { count: selected.size })}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button type="button" variant="primary" onClick={confirm}>{t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
