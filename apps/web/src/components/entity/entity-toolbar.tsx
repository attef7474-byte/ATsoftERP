'use client';
import React, { useState } from 'react';

interface ToolbarButton {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

interface EntityToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  buttons: ToolbarButton[];
  children?: React.ReactNode;
}

const variantClass: Record<string, string> = {
  primary: 'bg-teal-700 hover:bg-teal-800 text-white shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm',
  danger: 'bg-white hover:bg-red-50 text-red-600 border border-red-300 shadow-sm',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
};

function ToolbarBtn({ btn }: { btn: ToolbarButton }) {
  return (
    <button
      onClick={btn.onClick}
      disabled={btn.disabled}
      className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-medium transition-all duration-150
        ${variantClass[btn.variant ?? 'secondary']}
        ${btn.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {btn.loading ? (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        btn.icon
      )}
      {btn.label}
    </button>
  );
}

export function EntityToolbar({ searchPlaceholder, searchValue, onSearchChange, buttons, children }: EntityToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryBtn = buttons.find((b) => b.variant === 'primary');
  const mainButtons = buttons.filter((b) => b.variant !== 'primary' && b.id !== 'more');
  const moreButtons = buttons.filter((b) => b.id === 'more' || (b.id !== primaryBtn?.id && !mainButtons.includes(b)));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        {onSearchChange && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg className="absolute inset-y-0 start-0 w-4 h-4 my-auto ms-3 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder || 'Search...'}
              className="w-full h-10 ps-9 pe-3 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
            />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {primaryBtn && <ToolbarBtn btn={primaryBtn} />}
          {mainButtons.map((btn) => (
            <ToolbarBtn key={btn.id} btn={btn} />
          ))}

          {/* More dropdown */}
          {moreButtons.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition"
                aria-label="More"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                  <div className="absolute end-0 top-full mt-1 z-20 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                    {moreButtons.map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => { btn.onClick(); setMoreOpen(false); }}
                        disabled={btn.disabled}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition
                          ${btn.variant === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
                          ${btn.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                      >
                        {btn.icon}
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
