'use client';
import React, { useEffect, useRef, useCallback } from 'react';

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
}: EntityDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

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

  if (!open) return null;

  const isRtl = dir === 'rtl';

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-[70] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="complementary"
        aria-label={title}
        className={`fixed top-0 bottom-0 z-[75] bg-white shadow-xl flex flex-col
          ${isRtl ? 'left-0 rounded-e-2xl' : 'right-0 rounded-s-2xl'}
          w-[92vw] sm:w-[45vw] md:w-[36vw] min-w-[320px] max-w-[540px]
        `}
        style={{
          // In RTL: drawer is on the left, sidebar is on the right
          // In LTR: drawer is on the right, sidebar is on the left
          // Leave space for the 280px sidebar
          [isRtl ? 'left' : 'right']: '0',
          [isRtl ? 'right' : 'left']: 'auto',
        }}
      >
        {/* Drawer header */}
        <div className="shrink-0 bg-gradient-to-r from-teal-50/80 to-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900 truncate">{title}</h3>
                {statusBadge && <span className="shrink-0">{statusBadge}</span>}
              </div>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
            className={`w-[100px] shrink-0 overflow-y-auto bg-gray-50/50 border-e border-gray-200 ${
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
                      ? 'text-teal-700 bg-teal-50 font-bold'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  {isActive && (
                    <span
                      className={`absolute top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-teal-500 ${
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
          <div className="flex-1 overflow-y-auto p-4" role="tabpanel">
            {activeContent || (
              <p className="text-sm text-gray-400 text-center py-8">No content</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
