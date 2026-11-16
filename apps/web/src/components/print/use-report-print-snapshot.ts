'use client';
import { useCallback, useState } from 'react';
import { usePrintDocument } from './use-print-document';
import { PrintPreparationError, type PrintDocumentModel } from '../../lib/print';

export type ReportPrintParams = Record<string, string | number | boolean | undefined>;
export interface ReportPrintSnapshot<Data> {
  data: Data;
  params: ReportPrintParams;
  labels: Record<string, string>;
  scopeKey: string;
}
export type PreparedReportPrint = Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'>;

/** Capture only successful screen loads; callers keep their existing API/error flow. */
export function useReportPrintSnapshot<Data>() {
  const { print, printing, scopeKey } = usePrintDocument();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<ReportPrintSnapshot<Data> | null>(null);
  const rememberLookup = useCallback((key: string, item: { name?: string; code?: string }) => {
    setLabels(previous => ({ ...previous, [key]: item.name || item.code || '' }));
  }, []);
  const capture = useCallback((data: Data, params: ReportPrintParams) => {
    setSnapshot({ data, params: { ...params }, labels: { ...labels }, scopeKey });
  }, [labels, scopeKey]);
  const invalidate = useCallback(() => setSnapshot(null), []);
  const printSnapshot = useCallback((available: boolean, prepare: (snapshot: ReportPrintSnapshot<Data>, assertScope: () => void) => Promise<PreparedReportPrint>) =>
    print(snapshot?.scopeKey || '', async assertScope => {
      if (!available || !snapshot) throw new PrintPreparationError('unavailable');
      return prepare(snapshot, assertScope);
    }), [print, snapshot]);
  return { scopeKey, capture, invalidate, rememberLookup, printSnapshot, printing, canPrint: !!snapshot && snapshot.scopeKey === scopeKey && !printing };
}
