'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useTranslation } from '../../lib/i18n/use-translation';
import routes from '../../lib/excel-governance-routes.json';
import { useApiErrorHandler } from './error-handler';
import { Button } from './ui';
import { useToast } from './toast-provider';

/**
 * Route-driven read-only Excel action. It never renders template/import UI:
 * every eligible page is backed by a real Prisma model, a seeded read
 * permission and a tenant-scoped audited backend export adapter.
 */
export function GovernanceExcelExportAction({ pathname }: { pathname: string | null }) {
  const { t, locale, dir } = useTranslation();
  const auth = useAuth();
  const handleError = useApiErrorHandler();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const match = routes.find(route => route.route === pathname);

  useEffect(() => {
    setBusy(false);
    inFlight.current = false;
  }, [auth.contextVersion, pathname]);

  if (!match) return null;
  const allowed = auth.isSuperAdmin || !!auth.permissions?.permissions.includes(match.permission);
  if (!allowed || auth.isArchivedContext || !auth.contextReady) return null;

  const download = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const blob = await api.download(`/master-data-excel/${match.entity}/export`, undefined, { params: { locale } });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${match.entity}-export.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(t('reports.exportXlsxDone'), 'success');
    } catch (error) {
      handleError(error);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div dir={dir} className="my-2 flex justify-end">
      <Button variant="secondary" disabled={busy} onClick={download}>{t('common.excel.export')}</Button>
    </div>
  );
}
