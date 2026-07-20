'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { useToast } from '../../../components/admin/toast-provider';
import { Button, Card, DataTable, Pagination, PageHeader, LoadingState, EmptyState, Input, Modal, Textarea } from '../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../components/admin/admin-action-bar';
import { useRouter } from 'next/navigation';

interface Conversation {
  id: string;
  title?: string;
  createdByUserId: string;
  lastMessageAt?: string;
  createdAt: string;
  participants: { user: { id: string; name: string; email: string } }[];
  messages: { id: string; body: string; createdAt: string; senderUserId: string }[];
}

export default function MessagingPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', participantUserIds: '' });
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const selectedRecord = useMemo(() => conversations.find(c => c.id === selectedId), [conversations, selectedId]);

  const fetchConversations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get<{ data: Conversation[]; meta: any }>('/messaging/conversations', { params });
      setConversations(res.data || []);
      setMeta(res.meta);
    } catch { showToast(t('errors.loadFailed'), 'error'); } finally { setLoading(false); }
  }, [search, t, showToast]);

  useEffect(() => { fetchConversations(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get<{ data: { id: string; name: string }[] }>('/users', { params: { limit: '200' } });
      setUsers(res.data || []);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!createForm.participantUserIds.trim()) {
      showToast(t('validation.required'), 'error');
      return;
    }
    setSaving(true);
    try {
      const userIds = createForm.participantUserIds.split(',').map(s => s.trim()).filter(Boolean);
      await api.post('/messaging/conversations', { title: createForm.title || undefined, participantUserIds: userIds });
      showToast(t('common.successCreated'), 'success');
      setCreateOpen(false);
      setCreateForm({ title: '', participantUserIds: '' });
      fetchConversations(1);
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); } finally { setSaving(false); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => fetchConversations(meta.page),
    new: () => { fetchUsers(); setCreateOpen(true); },
    open: () => { if (selectedId) router.push(`/admin/messaging/${selectedId}`); },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'new', labelKey: 'common.newItem', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>, onClick: () => exec('new') },
    { id: 'open', labelKey: 'common.view', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>, onClick: () => exec('open'), enabled: !!selectedId },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
  ]);

  const columns = [
    { key: 'title', header: t('common.name'), render: (item: Conversation) => <span className="font-medium">{item.title || `Conversation (${item.participants?.length || 0} participants)`}</span> },
    { key: 'participants', header: t('common.users'), render: (item: Conversation) => <span className="text-xs text-gray-500">{item.participants?.map(p => p.user.name).join(', ') || '-'}</span> },
    { key: 'lastMessageAt', header: t('common.date'), render: (item: Conversation) => item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString() : '-' },
  ];

  return (
    <div>
      <PageHeader title={t('messaging.title')} />
      <div className="flex gap-3 mb-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} className="max-w-xs" />
        <Button variant="secondary" onClick={() => { setSearch(''); fetchConversations(1); }}>{t('common.clearSearch')}</Button>
      </div>
      {loading ? <LoadingState /> : conversations.length === 0 ? <EmptyState message={t('messaging.noConversations')} /> : (
        <Card>
          <DataTable columns={columns} data={conversations} keyExtractor={(item: Conversation) => item.id} selectedKey={selectedId}
            onRowClick={(item: Conversation) => setSelectedId(item.id) } />
          {meta.totalPages > 1 && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchConversations} />}
        </Card>
      )}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('messaging.newConversation')} size="md">
        <div className="space-y-4">
          <Input label={t('messaging.subject')} value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="(optional)" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('messaging.participants')}</label>
            <select multiple className="w-full text-sm border border-gray-300 rounded-md p-2 h-32" value={createForm.participantUserIds.split(',').map(s => s.trim()).filter(Boolean)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                setCreateForm({ ...createForm, participantUserIds: selected.join(',') });
              }}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">{t('messaging.selectParticipantsHint')}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} loading={saving}>{t('common.create')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
