'use client';
import { useState, useEffect, useCallback } from 'react';

interface UnreadCountResult {
  count: number;
}

export function useNotificationsPolling() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnread = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${baseUrl}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setUnreadCount(json?.data?.count ?? json?.count ?? 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  return { unreadCount, loading, refresh: fetchUnread };
}
