'use client';
import React from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface EntityDrawerNavProps {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function EntityDrawerNav({ items, activeId, onChange }: EntityDrawerNavProps) {
  return (
    <nav className="w-[100px] shrink-0 border-s border-gray-200 bg-white overflow-y-auto" role="tablist" aria-orientation="vertical">
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`w-full flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors relative ${
              isActive
                ? 'text-teal-700 bg-teal-50/80 font-bold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            {isActive && (
              <span className="absolute inset-s-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-e-full bg-teal-500" />
            )}
            {item.icon && <span className="w-5 h-5">{item.icon}</span>}
            <span className="leading-tight text-center">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
