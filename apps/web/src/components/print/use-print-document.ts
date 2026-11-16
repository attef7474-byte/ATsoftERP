'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { getOperationalContextKey, type OperationalContext } from '../../lib/operational-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useApiErrorHandler } from '../admin/error-handler';
import { PrintPreparationError, type PrintDocumentModel } from '../../lib/print';
import { openPrintDocument } from './print-runtime';

export function printScopeKey(context: OperationalContext | null, version: number, archived: boolean, userId: string): string {
  return context && userId ? `${userId}:${archived}:${version}:${getOperationalContextKey(context)}` : '';
}

export function usePrintDocument() {
  const { activeContext, archivedContext, isArchivedContext, contextVersion, contextLoading, user } = useAuth();
  const context = isArchivedContext ? archivedContext : activeContext;
  const key = printScopeKey(context, contextVersion, isArchivedContext, user?.id || '');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = useRef({ key, contextLoading }); current.current = { key, contextLoading };
  const busy = useRef(false);
  const [printing, setPrinting] = useState(false);
  const { t, locale } = useTranslation();
  const handleApiError = useApiErrorHandler();

  const print = useCallback(async (
    datasetScope: string,
    prepare: (assertScope: () => void) => Promise<Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'>>,
  ) => {
    if (busy.current) return;
    const assertScope = () => {
      if (!mounted.current || !datasetScope || current.current.contextLoading || current.current.key !== datasetScope) throw new PrintPreparationError('contextChanged');
    };
    busy.current = true; setPrinting(true);
    try {
      assertScope();
      const company = (locale === 'ar' ? context?.companyNameAr : context?.companyNameEn) || context?.companyName || context?.companyCode;
      const branch = (locale === 'ar' ? context?.branchNameAr : context?.branchNameEn) || context?.branchName || context?.branchCode || undefined;
      if (!company) throw new PrintPreparationError('unavailable');
      const model = await prepare(assertScope);
      assertScope();
      await openPrintDocument({ ...model, company, branch, locale, printedBy: user?.name || undefined, printedAt: new Date(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, t, assertScope);
    } catch (error) {
      if (mounted.current) handleApiError(error instanceof PrintPreparationError ? new Error(t(`reports.printDocument.${error.key}`)) : error);
    } finally { busy.current = false; if (mounted.current) setPrinting(false); }
  }, [context, handleApiError, locale, t, user?.name]);
  return { print, printing, scopeKey: key };
}
