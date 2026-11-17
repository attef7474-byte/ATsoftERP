'use client';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useApiErrorHandler } from './error-handler';
import { Button, Modal, Select } from './ui';
import { useToast } from './toast-provider';

type Mode = 'CREATE_ONLY' | 'UPDATE_EXISTING' | 'CREATE_AND_UPDATE';
interface Summary { totalRows: number; created: number; updated: number; unchanged: number; failed: number; skipped: number; warnings: number; }
interface Row { row: number; code: string; name: string; action: string; errors: { column: string; code: string }[]; }
interface Preview { token: string; rows: Row[]; summary: Summary; canImport: boolean; warnings: { column: string; code: string }[]; }
const permissionsByEntity = { machines: 'machine', 'machine-components': 'machine-component', 'spare-parts': 'spare-part', products: 'products' };
interface Props { entity: keyof typeof permissionsByEntity; search: string; disabled?: boolean; onImported: () => void; }
export function ExcelMasterDataActions({ entity, search, disabled, onImported }: Props) {
  const { t, locale, dir } = useTranslation(), auth = useAuth(), handleError = useApiErrorHandler(), { showToast } = useToast();
  const can = (action: string) => !auth.isArchivedContext && (auth.isSuperAdmin || !!auth.permissions?.permissions.includes(`${permissionsByEntity[entity]}:${action}`));
  const read = auth.isSuperAdmin || !!auth.permissions?.permissions.includes(`${permissionsByEntity[entity]}:read`);
  const create = can('create'), update = can('update');
  const [open, setOpen] = useState(false), [mode, setMode] = useState<Mode>('CREATE_ONLY'), [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null), [result, setResult] = useState<Summary | null>(null), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false);
  const inFlight = useRef(false), abort = useRef<AbortController | null>(null), generation = useRef(0);
  const shared = entity === 'products' || entity === 'spare-parts';
  const reset = () => { setFile(null); setPreview(null); setResult(null); setConfirmed(false); };
  useEffect(() => { generation.current++; abort.current?.abort(); inFlight.current = false; setBusy(false); setOpen(false); reset(); return () => { generation.current++; abort.current?.abort(); }; }, [auth.contextVersion, entity]);
  const run = async (action: (signal: AbortSignal, current: () => boolean) => Promise<void>) => {
    if (inFlight.current) return;
    const version = generation.current; inFlight.current = true; setBusy(true); abort.current = new AbortController();
    const current = () => version === generation.current;
    try { await action(abort.current.signal, current); } catch (error: any) { if (current() && error?.name !== 'AbortError') handleError(error); }
    finally { if (current()) { inFlight.current = false; setBusy(false); } }
  };
  const download = (blob: Blob, kind: string) => {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `${entity}-${kind}.xlsx`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const path = `/master-data-excel/${entity}`;
  const form = () => { const body = new FormData(); if (file) body.append('file', file); body.append('mode', mode); body.append('locale', locale); return body; };
  const validate = () => run(async (signal, current) => {
    setPreview(null); setConfirmed(false); setResult(null);
    const data = await api.post<Preview>(`${path}/validate`, form(), { signal }); if (current()) setPreview(data);
  });
  const commit = () => run(async (signal, current) => {
    if (!preview?.canImport || !confirmed) return;
    const body = form(); body.append('token', preview.token);
    const data = await api.post<Summary>(`${path}/import`, body, { signal });
    if (current()) { setResult(data); setPreview(null); setConfirmed(false); showToast(t('common.excel.success'), 'success'); onImported(); }
  });
  const modes: Mode[] = [...(create ? ['CREATE_ONLY' as const] : []), ...(update ? ['UPDATE_EXISTING' as const] : []), ...(create && update ? ['CREATE_AND_UPDATE' as const] : [])];
  const unavailable = disabled || busy || !auth.contextReady;
  if (!read) return null;
  return <div dir={dir} className="my-3 flex flex-wrap gap-2">
    <Button variant="secondary" disabled={unavailable} onClick={() => run(async (signal, current) => { const blob = await api.download(`${path}/template`, undefined, { params: { locale }, signal }); if (current()) download(blob, 'template'); })}>{t('common.excel.template')}</Button>
    <Button variant="secondary" disabled={unavailable} onClick={() => run(async (signal, current) => { const blob = await api.download(`${path}/export`, undefined, { params: { locale, search }, signal }); if (current()) download(blob, 'export'); })}>{t('common.excel.export')}</Button>
    {(create || update) && <Button disabled={unavailable} onClick={() => { reset(); setMode(create ? 'CREATE_ONLY' : 'UPDATE_EXISTING'); setOpen(true); }}>{t('common.excel.import')}</Button>}
    <Modal open={open} onClose={() => { if (!busy) { setOpen(false); reset(); } }} title={t('common.excel.import')} size="xl">
      <div dir={dir} className="space-y-4">
        <p className="text-sm">{t('common.excel.policy')}</p>
        {shared && <p role="note" className="rounded bg-amber-50 p-3 text-sm text-amber-900">{t('common.excel.shared')}</p>}
        <Select label={t('common.excel.mode')} value={mode} disabled={busy || !!result} options={modes.map(value => ({ value, label: t(`common.excel.${value}`) }))} onChange={event => { setMode(event.target.value as Mode); setPreview(null); setConfirmed(false); }} />
        <label className="block text-sm">{t('common.excel.file')}<input type="file" accept=".xlsx" disabled={busy || !!result} className="block w-full py-2" onChange={event => { setFile(event.target.files?.[0] || null); setPreview(null); setConfirmed(false); }} /></label>
        <Button disabled={!file || busy || !!result} onClick={validate}>{t('common.excel.validate')}</Button>
        {preview && <section aria-label={t('common.excel.preview')} className="space-y-3">
          <p className="text-sm">{t('common.excel.expires')}</p>
          {preview.rows.length === 0 && <p role="status">{t('common.excel.noRows')}</p>}
          <SummaryView value={preview.summary} />
          {preview.warnings.map((warning, i) => <p key={i} className="text-sm">{warning.column}: {t(warning.code)}</p>)}
          <div className="max-h-80 overflow-auto"><table className="w-full text-start text-sm"><thead><tr>{['row', 'state'].map(key => <th className="p-2 text-start" key={key}>{t(`common.excel.${key}`)}</th>)}<th className="p-2 text-start">{t('common.code')}</th><th className="p-2 text-start">{t('common.name')}</th><th className="p-2 text-start">{t('common.excel.errors')}</th></tr></thead><tbody>
            {preview.rows.map(row => <tr key={row.row} className="border-t"><td className="p-2">{row.row}</td><td className="p-2">{t(`common.excel.${row.action}`)}</td><td className="p-2" dir="ltr">{row.code}</td><td className="p-2">{row.name}</td><td className="p-2">{row.errors.map((error, i) => <p key={i}>{error.column}: {t(error.code)}</p>)}</td></tr>)}
          </tbody></table></div>
          {preview.summary.failed > 0 && <Button variant="secondary" disabled={busy} onClick={() => run(async (signal, current) => { const blob = await api.download(`${path}/errors`, form(), { signal }); if (current()) download(blob, 'errors'); })}>{t('common.excel.errors')}</Button>}
          {preview.canImport && <><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{t('common.excel.confirmText')}</label><Button disabled={busy || !confirmed} onClick={commit}>{t('common.excel.confirm')}</Button></>}
        </section>}
        {result && <section role="status"><h3>{t('common.excel.success')}</h3><SummaryView value={result} /></section>}
        <Button variant="secondary" disabled={busy} onClick={() => { setOpen(false); reset(); }}>{t('common.excel.cancel')}</Button>
      </div>
    </Modal>
  </div>;
}
function SummaryView({ value }: { value: Summary }) {
  const { t } = useTranslation();
  return <dl className="flex flex-wrap gap-4 text-sm">{(['totalRows', 'created', 'updated', 'unchanged', 'skipped', 'warnings', 'failed'] as const).map(key => <div key={key}><dt>{t(`common.excel.${key}`)}</dt><dd>{value[key]}</dd></div>)}</dl>;
}
