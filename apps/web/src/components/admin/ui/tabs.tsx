'use client';
import React from 'react';

/**
 * Shared horizontal tab bar.
 *
 * R4R unifies several maintenance master-data modules onto a single page. Each unified
 * page needs the same accessible tab affordance, so it lives here once instead of being
 * re-implemented per page. Styling uses the same workspace CSS variables as the rest of
 * the admin shell, so the unified pages keep the accepted appearance baseline and work
 * unchanged in RTL and LTR.
 */
export interface TabItem {
  id: string;
  label: string;
  badge?: number;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

export function Tabs({ items, activeId, onChange, ariaLabel }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 border-b border-[var(--ws-border)] mb-4 overflow-x-auto"
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${item.id}`}
            onClick={() => onChange(item.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              isActive
                ? 'text-[var(--ws-primary)] border-[var(--ws-primary)] font-bold'
                : 'text-[var(--ws-slate)] border-transparent hover:text-[var(--ws-primary)]'
            }`}
          >
            {item.label}
            {typeof item.badge === 'number' && (
              <span className="ms-2 text-xs text-[var(--ws-slate)]">({item.badge})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeId: string;
  children: React.ReactNode;
}

export function TabPanel({ id, activeId, children }: TabPanelProps) {
  if (id !== activeId) return null;
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}