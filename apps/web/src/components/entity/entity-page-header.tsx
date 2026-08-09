'use client';
import React from 'react';

interface EntityPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
}

const defaultIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

export function EntityPageHeader({ title, subtitle, icon, iconBg }: EntityPageHeaderProps) {
  return (
    <div className="relative bg-gradient-to-r from-[var(--ws-soft)] via-[var(--ws-aqua)] to-slate-50 rounded-2xl border border-[var(--ws-border)] px-6 py-5 mb-4" data-form-header>
      <div className="flex items-center gap-4">
        <div className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-md ring-2 ring-white/80 bg-gradient-to-br ${iconBg || 'from-[var(--ws-primary)] to-[var(--ws-cyan)]'}`}>
          {icon ?? defaultIcon}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-[var(--ws-navy)] tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
