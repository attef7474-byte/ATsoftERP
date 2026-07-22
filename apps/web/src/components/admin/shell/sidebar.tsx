'use client';

import React from 'react';
import Link from 'next/link';
import type { TranslationNamespace } from '../../../lib/i18n/types';
import { MessageButton } from './message-button';
import { navItems, type NavItem } from './navigation-data';
import { shellIconMap } from './shell-icons';

type Translate = (key: string, namespace?: TranslationNamespace) => string;

interface NavigationItemsProps {
  items: NavItem[];
  pathname: string;
  t: Translate;
  onNavigate: () => void;
  expandedSections?: Record<string, boolean>;
  onToggleSection?: (id: string) => void;
}

export function NavigationItems({
  items,
  pathname,
  t,
  onNavigate,
  expandedSections,
  onToggleSection,
}: NavigationItemsProps): React.ReactNode {
  const isExpanded = (id: string) => expandedSections?.[id] ?? false;

  return items.map((item) => (
    <div key={item.id}>
      {item.children ? (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => onToggleSection?.(item.id)}
            className="flex items-center w-full px-3 py-2.5 text-sm font-bold text-gray-800 uppercase tracking-wider hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            {item.icon && <span className="shrink-0 mr-2.5 text-blue-600">{shellIconMap[item.icon]}</span>}
            <span className="flex-1 text-left">{t(item.label)}</span>
            <svg
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isExpanded(item.id) ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {isExpanded(item.id) && (
            <div className="space-y-0.5 mt-1 ml-6 border-l-2 border-blue-100 pl-3">
              {item.children.map((child) => (
                <Link
                  key={child.id}
                  href={child.href}
                  className={`flex items-center px-3 py-1.5 text-xs rounded-md transition-colors ${
                    pathname === child.href ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                  onClick={onNavigate}
                >
                  {child.label && t(child.label)}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : item.id === 'messaging' && item.icon ? (
        <MessageButton
          href={item.href}
          label={t(item.label)}
          icon={shellIconMap[item.icon]}
          active={pathname === item.href}
          onNavigate={onNavigate}
        />
      ) : (
        <Link
          href={item.href}
          className={`flex items-center px-3 py-2.5 text-sm font-bold text-gray-800 uppercase tracking-wider rounded-md transition-colors mb-1 ${
            pathname === item.href ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100 hover:text-gray-900'
          }`}
          onClick={onNavigate}
        >
          {item.icon && <span className="shrink-0 mr-2.5 text-blue-600">{shellIconMap[item.icon]}</span>}
          <span>{t(item.label)}</span>
        </Link>
      )}
    </div>
  ));
}

interface SidebarProps {
  collapsed: boolean;
  pathname: string;
  t: Translate;
  expandedSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  onCollapsedIconClick: (id: string) => void;
  onNavigate: () => void;
}

export function Sidebar({
  collapsed,
  pathname,
  t,
  expandedSections,
  onToggleSection,
  onCollapsedIconClick,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className={`admin-sidebar hidden lg:flex ${collapsed ? 'admin-sidebar-collapsed' : ''}`}>
      {collapsed ? (
        <nav className="admin-sidebar-icons">
          {navItems.filter((item) => item.icon).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onCollapsedIconClick(item.id)}
              className="sidebar-icon-btn"
              title={t(item.label)}
            >
              {shellIconMap[item.icon!]}
            </button>
          ))}
        </nav>
      ) : (
        <nav className="admin-sidebar-inner">
          <NavigationItems
            items={navItems}
            pathname={pathname}
            t={t}
            onNavigate={onNavigate}
            expandedSections={expandedSections}
            onToggleSection={onToggleSection}
          />
        </nav>
      )}
    </aside>
  );
}
