'use client';
import React from 'react';

interface ChartEmptyStateProps {
  message?: string;
}

export function ChartEmptyState({ message = 'No data available' }: ChartEmptyStateProps) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-600 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
