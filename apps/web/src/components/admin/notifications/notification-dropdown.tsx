'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { api } from '../../../lib/api';
import { NotificationItem, NotificationItemData } from './notification-item';

interface NotificationDropdownProps {
  onClose: () => void;
  onViewAll: () => void;
}

export function NotificationDropdown({ onClose, onViewAll }: NotificationDropdownProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: NotificationItemData[] }>('/notifications/inbox', { params: { limit: '5', page: '1' } });
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const handleMarkRead = async (id: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    } catch { /* ignore */ } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(true);
    try {
      await api.delete(`/notifications/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* ignore */ } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await api.post('/notifications/mark-all-read');
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    } catch { /* ignore */ } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">{t('notifications.title')}</h3>
        <button onClick={handleMarkAllRead} disabled={actionLoading} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
          {t('notifications.markAllRead')}
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">{t('notifications.noNotifications')}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((item) => (
              <NotificationItem key={item.id} item={item} onMarkRead={handleMarkRead} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-gray-100 p-2">
        <button onClick={onViewAll} className="w-full text-center text-xs text-blue-600 hover:text-blue-800 py-1.5 font-medium">
          {t('common.viewAll')}
        </button>
      </div>
    </div>
  );
}
