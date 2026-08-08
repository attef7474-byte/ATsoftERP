'use client';
import React from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, action, children, className = '' }: ChartCardProps) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
