'use client';
import React from 'react';

const colors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export function NotificationPriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const cls = colors[priority] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {priority}
    </span>
  );
}
