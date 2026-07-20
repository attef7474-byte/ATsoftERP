'use client';
import React from 'react';
import { NotificationTypeIcon } from './notification-type-icon';
import { NotificationPriorityBadge } from './notification-priority-badge';

export interface NotificationItemData {
  id: string;
  title?: string;
  body?: string;
  type?: string;
  priority?: string;
  read?: boolean;
  createdAt?: string;
  link?: string;
}

interface NotificationItemProps {
  item: NotificationItemData;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationItem({ item, onMarkRead, onDelete }: NotificationItemProps) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${item.read ? 'bg-white' : 'bg-blue-50'}`}>
      <NotificationTypeIcon type={item.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.title && <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>}
          {item.priority && <NotificationPriorityBadge priority={item.priority} />}
        </div>
        {item.body && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.body}</p>}
        {item.createdAt && <p className="text-[10px] text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!item.read && onMarkRead && (
          <button onClick={() => onMarkRead(item.id)} className="p-1 text-xs text-blue-600 hover:text-blue-800" title="Mark read">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(item.id)} className="p-1 text-xs text-gray-400 hover:text-red-600" title="Delete">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
