'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../toast-provider';
import { api } from '../../../lib/api';
import { NotificationItem, NotificationItemData } from './notification-item';
import { NotificationFilters } from './notification-filters';
import { Button, Pagination, Card, LoadingState, EmptyState } from '../ui';

export function NotificationCenter() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState('');
  const [read, setRead] = useState<string | undefined>(undefined);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (type) params.type = type;
      if (read !== undefined && read !== '') params.read = read;
      const res = await api.get<{ data: NotificationItemData[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        '/notifications/inbox', { params }
      );
      setItems(res.data || []);
      if (res.meta) {
        setTotalPages(res.meta.totalPages);
        setTotal(res.meta.total);
      }
    } catch {
      showToast(t('errors.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, type, read, t, showToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    } catch { showToast(t('errors.updateFailed'), 'error'); }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      showToast(t('common.successUpdated'), 'success');
    } catch { showToast(t('errors.updateFailed'), 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((prev) => prev - 1);
    } catch { showToast(t('errors.deleteFailed'), 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <NotificationFilters type={type} read={read} onTypeChange={(v) => { setType(v); setPage(1); }} onReadChange={(v) => { setRead(v); setPage(1); }} />
        <Button variant="secondary" onClick={handleMarkAllRead}>{t('notifications.markAllRead')}</Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t('notifications.noNotifications')} />
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <NotificationItem key={item.id} item={item} onMarkRead={handleMarkRead} onDelete={handleDelete} />
            ))}
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      )}
    </div>
  );
}
