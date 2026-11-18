'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { resolveApiErrorMessage } from './error-utils';
import { useTranslation } from './i18n/use-translation';
import { ProductionMonitoringResponse } from './production-monitoring';
export const MONITORING_REFRESH_MS = 5000;
export function useProductionMonitoring(allowed: boolean, contextVersion: number, scope?: {
  productionLineId?: string;
  machineId?: string;
}) {
  const {
    t
  } = useTranslation();
  const [data, setData] = useState<ProductionMonitoringResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    setData(null);
    setError('');
  }, [allowed, contextVersion, scope?.productionLineId, scope?.machineId]);
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let pending: {
      generation: number;
      controller: AbortController;
    } | null = null;
    setLoading(false);
    if (!allowed) return;
    const refresh = async () => {
      if (disposed || pending || document.hidden) return;
      const request = {
        generation: ++generation,
        controller: new AbortController()
      };
      pending = request;
      setLoading(true);
      try {
        const response = await api.get<ProductionMonitoringResponse>('/reports/production/monitoring', {
          signal: request.controller.signal,
          params: scope
        });
        if (disposed || request.generation !== generation) return;
        setData(response);
        setError('');
      } catch (err: any) {
        if (disposed || request.generation !== generation || request.controller.signal.aborted) return;
        setError(resolveApiErrorMessage(t, err?.messageKey) || t('production.monitoring.refreshFailed'));
      } finally {
        if (!disposed && request.generation === generation) {
          pending = null;
          setLoading(false);
        }
      }
    };
    refreshRef.current = refresh;
    const visibility = () => {
      if (document.hidden) {
        generation += 1;
        pending?.controller.abort();
        pending = null;
        setLoading(false);
      } else if (autoRefresh) void refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    void refresh();
    const timer = autoRefresh ? setInterval(() => {
      void refresh();
    }, MONITORING_REFRESH_MS) : undefined;
    return () => {
      disposed = true;
      generation += 1;
      pending?.controller.abort();
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      refreshRef.current = async () => {};
    };
  }, [allowed, contextVersion, autoRefresh, t, scope?.productionLineId, scope?.machineId]);
  const refresh = useCallback(() => refreshRef.current(), []);
  return {
    data,
    error,
    loading,
    autoRefresh,
    setAutoRefresh,
    refresh
  };
}
