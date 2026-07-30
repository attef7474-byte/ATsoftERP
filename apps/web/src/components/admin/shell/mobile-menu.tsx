'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { UserProfile } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { sidebarGroups, type SidebarGroup } from './navigation-data';
import { shellIconMap } from './shell-icons';
import { MobileUserSummary } from './user-menu';

export function MobileMenuOverlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] bg-black bg-opacity-50" onClick={onClose} />;
}

interface MobileMenuPanelProps {
  isRtl: boolean;
  pathname: string;
  profile: UserProfile | null;
  onClose: () => void;
}

function MobileGroup({ group, pathname, t, onClose }: {
  group: SidebarGroup;
  pathname: string;
  t: (key: string) => string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!(group.children || group.items);

  if (!hasChildren && group.route) {
    return (
      <Link
        href={group.route}
        className={`flex items-center px-3 py-2.5 text-sm rounded-md ${pathname === group.route ? 'bg-teal-50 text-teal-700 font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
        onClick={onClose}
      >
        <span className="w-5 h-5 mr-2 flex-shrink-0">{shellIconMap[group.icon]}</span>
        {t(group.labelKey)}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center w-full px-3 py-2.5 text-sm font-bold text-gray-800 rounded-md hover:bg-gray-100"
      >
        <span className="w-5 h-5 mr-2 flex-shrink-0">{shellIconMap[group.icon]}</span>
        <span className="flex-1 text-left">{t(group.labelKey)}</span>
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="ml-7 space-y-0.5 mt-1">
          {group.children?.map((section) => (
            <div key={section.id}>
              <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">{t(section.labelKey)}</div>
              {section.items.map((item) => (
                <Link key={item.id} href={item.route}
                  className={`flex items-center px-3 py-1.5 text-xs rounded-md ${pathname === item.route ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                  onClick={onClose}>
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          ))}
          {group.items?.map((item) => (
            <Link key={item.id} href={item.route}
              className={`flex items-center px-3 py-1.5 text-xs rounded-md ${pathname === item.route ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              onClick={onClose}>
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileMenuPanel({
  isRtl,
  pathname,
  profile,
  onClose,
}: MobileMenuPanelProps) {
  const { t } = useTranslation();

  return (
    <aside
      className={`fixed inset-y-0 z-[65] w-72 bg-white shadow-xl flex flex-col ${isRtl ? 'right-0' : 'left-0'}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between h-[56px] px-4 border-b shrink-0">
        <span className="text-base font-bold text-gray-800">{t('common.appName')}</span>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {sidebarGroups.map((group) => (
          <MobileGroup key={group.id} group={group} pathname={pathname} t={t} onClose={onClose} />
        ))}
      </nav>
      <div className="border-t px-4 py-3 shrink-0">
        <MobileUserSummary profile={profile} />
      </div>
    </aside>
  );
}
