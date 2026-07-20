'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { Button, Card, PageHeader, LoadingState } from '../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon } from '../../../../components/admin/admin-action-bar';

interface Message {
  id: string;
  body: string;
  createdAt: string;
  isSystem: boolean;
  sender: { id: string; name: string; email: string; avatar?: string };
}

interface Participant {
  user: { id: string; name: string; email: string; avatar?: string };
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const conversationId = params.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [conversationTitle, setConversationTitle] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);

  const fetchMessages = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Message[]; meta: any }>(`/messaging/conversations/${conversationId}/messages`, { params: { page: String(p), limit: '50' } });
      if (p === 1) {
        setMessages(res.data || []);
      } else {
        setMessages((prev) => [...(res.data || []), ...prev]);
      }
      setMeta({ page: res.meta?.page || p, totalPages: res.meta?.totalPages || 1 });
    } catch { showToast(t('errors.loadFailed'), 'error'); } finally { setLoading(false); }
  }, [conversationId, t, showToast]);

  const fetchConversation = useCallback(async () => {
    try {
      const res = await api.get<any>(`/messaging/conversations/${conversationId}`);
      setConversationTitle(res.title || '');
    } catch { /* ignore */ }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    fetchConversation();
    api.post(`/messaging/conversations/${conversationId}/read`).catch(() => {});
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      try { setCurrentUserId(JSON.parse(stored).id); } catch { /* ignore */ }
    }
    const id = setInterval(() => { fetchMessages(1); }, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const msg = await api.post<Message>('/messaging/messages', { conversationId, body: newMessage.trim() });
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
    } catch (err: any) { showToast(err?.message || t('errors.createFailed'), 'error'); } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const { exec } = useStableHandlers({
    back: () => router.push('/admin/messaging'),
    refresh: () => fetchMessages(1),
    loadMore: () => { if (page < meta.totalPages) { const next = page + 1; setPage(next); fetchMessages(next); } },
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    ...(page < meta.totalPages ? [{ id: 'loadMore', labelKey: 'common.loadMore', icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>, onClick: () => exec('loadMore') }] : []),
  ]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={conversationTitle || t('messaging.conversation')} />
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && page === 1 ? <LoadingState /> : messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">{t('messaging.noMessages')}</div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender?.id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${msg.isSystem ? 'bg-gray-100 text-gray-500 italic text-center w-full' : isMe ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    {!msg.isSystem && !isMe && <p className="text-xs font-medium mb-0.5 opacity-75">{msg.sender?.name}</p>}
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p className={`text-[10px] mt-0.5 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>{new Date(msg.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-gray-200 p-3 flex gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('messaging.typeMessage')}
            className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={2}
          />
          <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()}>{t('messaging.send')}</Button>
        </div>
      </Card>
    </div>
  );
}
