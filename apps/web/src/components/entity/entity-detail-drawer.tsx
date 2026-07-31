'use client';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DrawerSection {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface EntityDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  statusBadge?: React.ReactNode;
  sections: DrawerSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  navItems: { id: string; label: string; icon?: React.ReactNode }[];
  dir: 'ltr' | 'rtl';
  closeLabel?: string;
}

export function EntityDetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  statusBadge,
  sections,
  activeSection,
  onSectionChange,
  navItems,
  dir,
  closeLabel = 'Close panel',
}: EntityDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, handleEsc]);

  const activeContent = sections.find((s) => s.id === activeSection)?.content;

  if (!open || !mounted) return null;

  const isRtl = dir === 'rtl';

  return createPortal(
    (<>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-[#071A2F]/25 backdrop-blur-[1px] z-[80] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — modern side panel: bottom offset + rounded corners */}
      <div
        ref={drawerRef}
        role="complementary"
        aria-label={title}
        className={`fixed top-0 bottom-5 z-[90] bg-white shadow-2xl shadow-[#071A2F]/20 flex flex-col
          ${isRtl ? 'left-0' : 'right-0'}
          w-[94vw] sm:w-[48vw] md:w-[34vw] min-w-[360px] max-w-[560px]
          rounded-b-[18px] border-s border-[var(--ws-border)]
        `}
        style={{
          // In RTL: drawer is on the left, sidebar is on the right
          // In LTR: drawer is on the right, sidebar is on the left
          [isRtl ? 'left' : 'right']: '0',
          [isRtl ? 'right' : 'left']: 'auto',
        }}
      >
        {/* Drawer header */}
        <div className="shrink-0 bg-gradient-to-r from-[var(--ws-soft)] via-white to-white border-b border-[var(--ws-border)] px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[var(--ws-navy)] truncate">{title}</h3>
                {statusBadge && <span className="shrink-0">{statusBadge}</span>}
              </div>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
              className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-xl bg-white border border-[var(--ws-border)] shadow-sm text-[var(--ws-slate)] hover:text-[var(--ws-primary)] hover:border-[var(--ws-accent)] hover:bg-[var(--ws-soft)] transition-all duration-150"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Drawer body: nav + content side by side */}
        <div className="flex flex-1 overflow-hidden">
          {/* Vertical nav rail */}
          <nav
            role="tablist"
            aria-orientation="vertical"
            className={`w-[100px] shrink-0 overflow-y-auto bg-[var(--ws-bg)] border-e border-[var(--ws-border)] ${
              isRtl ? 'order-last border-r' : 'order-first border-l'
            }`}
          >
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors relative ${
                    isActive
                      ? 'text-[var(--ws-primary)] bg-[var(--ws-soft)] font-bold'
                      : 'text-[var(--ws-slate)] hover:bg-white hover:text-[var(--ws-primary)]'
                  }`}
                >
                  {isActive && (
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-[var(--ws-accent)] ${
                        isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                      }`}
                    />
                  )}
                  {item.icon && <span className="w-5 h-5">{item.icon}</span>}
                  <span className="leading-tight text-center">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Section content */}
          <div className="flex-1 overflow-y-auto p-4 bg-[var(--ws-bg)]/40" role="tabpanel">
            {activeContent || (
              <p className="text-sm text-gray-400 text-center py-8">No content</p>
            )}
          </div>
        </div>
      </div>
    </>),
    document.body,
  );
}
