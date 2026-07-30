'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { TranslationNamespace } from '../../../lib/i18n/types';
import { MessageButton } from './message-button';
import { sidebarGroups, routeGroupMap, type SidebarGroup } from './navigation-data';
import { shellIconMap } from './shell-icons';

type Translate = (key: string, namespace?: TranslationNamespace) => string;

interface SidebarProps {
  collapsed: boolean;
  pathname: string;
  t: Translate;
  openGroup: string | null;
  onToggleGroup: (id: string) => void;
  onCollapsedIconClick: (id: string) => void;
  onNavigate: () => void;
}

/** Determine which group id owns a given pathname */
export function getActiveGroupId(pathname: string): string | null {
  for (const [prefix, groupId] of Object.entries(routeGroupMap)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return groupId;
    }
  }
  return null;
}

function GroupSection({ group, pathname, t, onNavigate }: {
  group: SidebarGroup;
  pathname: string;
  t: Translate;
  onNavigate: () => void;
}) {
  const renderItems = (items: { id: string; labelKey: string; route: string }[]) =>
    items.map((item) => {
      const isActive = pathname === item.route;
      return (
        <Link
          key={item.id}
          href={item.route}
          className={`sidebar-item${isActive ? ' active' : ''}`}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
        >
          {t(item.labelKey)}
        </Link>
      );
    });

  if (group.route) {
    // Direct link (no children)
    const isActive = pathname === group.route;
    return (
      <Link
        href={group.route}
        className={`sidebar-direct-link${isActive ? ' active' : ''}`}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="sidebar-group-icon">{shellIconMap[group.icon]}</span>
        <span className="sidebar-group-label">{t(group.labelKey)}</span>
      </Link>
    );
  }

  if (group.items) {
    // Flat children items
    return (
      <div>
        {renderItems(group.items)}
      </div>
    );
  }

  if (group.children) {
    // Sections with items
    return (
      <div>
        {group.children.map((section) => (
          <div key={section.id}>
            <div className="sidebar-section">{t(section.labelKey)}</div>
            {renderItems(section.items)}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function Sidebar({
  collapsed,
  pathname,
  t,
  openGroup,
  onToggleGroup,
  onCollapsedIconClick,
  onNavigate,
}: SidebarProps) {
  const activeGroupId = useMemo(() => getActiveGroupId(pathname), [pathname]);

  return (
    <aside className={`admin-sidebar hidden lg:flex${collapsed ? ' admin-sidebar-collapsed' : ''}`}>
      {collapsed ? (
        <nav className="admin-sidebar-icons">
          {sidebarGroups.map((group) => {
            const isActive = activeGroupId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onCollapsedIconClick(group.id)}
                className={`sidebar-icon-btn${isActive ? ' active' : ''}`}
                title={t(group.labelKey)}
                aria-label={t(group.labelKey)}
              >
                {shellIconMap[group.icon]}
              </button>
            );
          })}
        </nav>
      ) : (
        <nav className="admin-sidebar-inner" role="navigation" aria-label={t('workspace.sidebar')}>
          {/* Logo area */}
          <div className="sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            {t('common.appName')}
          </div>

          {/* Groups */}
          {sidebarGroups.map((group) => {
            const hasChildren = !!(group.children || group.items);
            const isActive = activeGroupId === group.id;
            const isOpen = openGroup === group.id;

            if (!hasChildren && !group.route) return null;

            if (!hasChildren && group.route) {
              // Direct link
              return (
                <div key={group.id} className="sidebar-group">
                  <GroupSection group={group} pathname={pathname} t={t} onNavigate={onNavigate} />
                </div>
              );
            }

            // Expandable group
            return (
              <div key={group.id} className="sidebar-group">
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.id)}
                  className={`sidebar-group-btn${isActive ? ' active-group' : ''}`}
                  aria-expanded={isOpen}
                >
                  <span className="sidebar-group-icon">{shellIconMap[group.icon]}</span>
                  <span className="sidebar-group-label">{t(group.labelKey)}</span>
                  <svg className={`sidebar-chevron${isOpen ? ' open' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
                {isOpen && (
                  <div>
                    <GroupSection group={group} pathname={pathname} t={t} onNavigate={onNavigate} />
                  </div>
                )}
              </div>
            );
          })}

          {/* MessageButton at bottom */}
          {(() => {
            const msg = sidebarGroups.find(g => g.id === 'messaging');
            return msg ? (
              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                <MessageButton
                  href={msg.route || '#'}
                  label={t(msg.labelKey)}
                  icon={shellIconMap[msg.icon]}
                  active={pathname === msg.route}
                  onNavigate={onNavigate}
                />
              </div>
            ) : null;
          })()}
        </nav>
      )}
    </aside>
  );
}
