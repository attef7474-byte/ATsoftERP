'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { UserProfile } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { sidebarGroups, type SidebarGroup } from './navigation-data';
import { shellIconMap } from './shell-icons';
import { MobileUserSummary } from './user-menu';

export function MobileMenuOverlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[65] bg-black bg-opacity-50" onClick={onClose} aria-hidden />;
}

interface MobileMenuPanelProps {
  isRtl: boolean;
  pathname: string;
  activeGroupId: string | null;
  profile: UserProfile | null;
  onClose: () => void;
}

function MobileGroup({ group, pathname, activeGroupId, t, onClose }: {
  group: SidebarGroup;
  pathname: string;
  activeGroupId: string | null;
  t: (key: string) => string;
  onClose: () => void;
}) {
  // Reopening the drawer remounts this component, so initializing from the active
  // group keeps the relevant section expanded after navigation (matches desktop).
  const [open, setOpen] = useState(() => group.id === activeGroupId);
  const hasChildren = !!(group.children || group.items);

  if (!hasChildren && group.route) {
    const isActive = pathname === group.route;
    return (
      <div className="sidebar-group">
        <Link
          href={group.route}
          className={`sidebar-direct-link${isActive ? ' active' : ''}`}
          onClick={onClose}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="sidebar-group-icon">{shellIconMap[group.icon]}</span>
          <span className="sidebar-group-label">{t(group.labelKey)}</span>
        </Link>
      </div>
    );
  }

  const isActiveGroup = activeGroupId === group.id;

  return (
    <div className="sidebar-group">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`sidebar-group-btn${isActiveGroup ? ' active-group' : ''}`}
        aria-expanded={open}
      >
        <span className="sidebar-group-icon">{shellIconMap[group.icon]}</span>
        <span className="sidebar-group-label">{t(group.labelKey)}</span>
        <svg className={`sidebar-chevron${open ? ' open' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div>
          {group.children?.map((section) => (
            <div key={section.id}>
              <div className="sidebar-section">{t(section.labelKey)}</div>
              {section.items.map((item) => {
                const isItemActive = pathname === item.route;
                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    className={`sidebar-item${isItemActive ? ' active' : ''}`}
                    onClick={onClose}
                    aria-current={isItemActive ? 'page' : undefined}
                  >
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          ))}
          {group.items?.map((item) => {
            const isItemActive = pathname === item.route;
            return (
              <Link
                key={item.id}
                href={item.route}
                className={`sidebar-item${isItemActive ? ' active' : ''}`}
                onClick={onClose}
                aria-current={isItemActive ? 'page' : undefined}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MobileMenuPanel({
  isRtl,
  pathname,
  activeGroupId,
  profile,
  onClose,
}: MobileMenuPanelProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape + move focus into the drawer for keyboard users
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside
      className={`admin-mobile-drawer fixed inset-y-0 z-[70] w-80 max-w-[85vw] flex flex-col ${isRtl ? 'right-0' : 'left-0'}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('workspace.sidebar')}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="admin-mobile-drawer-header shrink-0">
        <span className="truncate">{t('common.appName')}</span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="admin-mobile-drawer-close shrink-0"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="admin-sidebar-inner flex-1" role="navigation" aria-label={t('workspace.sidebar')}>
        {sidebarGroups.map((group) => (
          <MobileGroup
            key={group.id}
            group={group}
            pathname={pathname}
            activeGroupId={activeGroupId}
            t={t}
            onClose={onClose}
          />
        ))}
      </nav>
      <div className="admin-mobile-drawer-footer shrink-0">
        <MobileUserSummary profile={profile} />
      </div>
    </aside>
  );
}
