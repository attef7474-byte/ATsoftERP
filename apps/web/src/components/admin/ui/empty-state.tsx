'use client';

import React from 'react';

export function EmptyState({ message, action }: { message?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16">
      <p className="text-gray-500 mb-4">{message || 'No data available'}</p>
      {action}
    </div>
  );
}
