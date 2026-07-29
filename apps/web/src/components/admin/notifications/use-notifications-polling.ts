'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useOperationalContext } from '../../../lib/auth-context';

interface UnreadCountResult {
  count: number;
}

export function useNotificationsPolling() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { contextReady, contextVersion } = useOperationalContext();

  const fetchUnread = useCallback(async () => {
    if (!contextReady) return;
    setLoading(true);
    try {
      const json = await api.get<{ data?: UnreadCountResult; count?: number }>(
        '/notifications/unread-count',
      );
      setUnreadCount(json?.data?.count ?? json?.count ?? 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [contextReady, contextVersion]);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  return { unreadCount, loading, refresh: fetchUnread };
}
