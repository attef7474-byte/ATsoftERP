'use client';

import { useEffect, useRef, useState } from 'react';

export interface DrawerSectionData<T> {
  /** Items fetched for the current entity. Cleared immediately when the entity changes (no stale data). */
  data: T[];
  /** True while a fetch is in flight. */
  loading: boolean;
  /** True when a fetch finished (success or error) for the current entity. */
  loaded: boolean;
  /** Raw error when the last fetch failed (null on success/loading). */
  error: unknown;
}

/**
 * Fetches a related-data section for the entity detail drawer.
 *
 * Guarantees:
 * - data is cleared the moment `entityId` changes (no stale rows from the previous entity)
 * - out-of-order responses are discarded (race-safe)
 * - `loaded` distinguishes "fetched and genuinely empty" from "not yet fetched",
 *   so pages never render a false empty state before the request resolves
 */
export function useDrawerSectionData<T>(
  entityId: string | null | undefined,
  fetcher: (id: string) => Promise<T[]>,
): DrawerSectionData<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!entityId) {
      setData([]);
      setLoading(false);
      setLoaded(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setData([]);
    setLoading(true);
    setLoaded(false);
    setError(null);

    fetcherRef.current(entityId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoaded(true);
      })
      .catch((thrown) => {
        if (cancelled) return;
        setError(thrown);
        setData([]);
        setLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  return { data, loading, loaded, error };
}
