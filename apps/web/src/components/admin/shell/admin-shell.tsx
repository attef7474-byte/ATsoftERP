'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logout, getProfile, type UserProfile } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { AdminActionBarProvider, useAdminActionBar } from '../admin-action-bar';
import { UnifiedSearchModal } from '../../f9/UnifiedSearchModal';
import { Breadcrumb } from './breadcrumb';
import { useF9Shortcut } from './f9-shortcut';
import { MobileMenuOverlay, MobileMenuPanel } from './mobile-menu';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { visible: actionBarVisible, actions } = useAdminActionBar();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clock, setClock] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const isRtl = locale === 'ar';

  const toggleSearch = useCallback(() => {
    setSearchOpen((previous) => !previous);
  }, []);
  useF9Shortcut(toggleSearch);

  const toggleSection = (id: string) => {
    setExpandedSections((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const onCollapsedIconClick = (id: string) => {
    setSidebarCollapsed(false);
    setExpandedSections((previous) => ({ ...previous, [id]: true }));
  };

  useEffect(() => {
    getProfile().then((nextProfile) => {
      if (nextProfile) setProfile(nextProfile);
    });
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US'));
    tick();
    const timerId = setInterval(tick, 30000);
    return () => clearInterval(timerId);
  }, [locale]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleLanguage = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  };

  const toggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(true);
    } else {
      setSidebarCollapsed((previous) => !previous);
    }
  };

  return (
    <div
      className="admin-workspace-shell"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        '--app-actionbar-active-height': actionBarVisible ? 'var(--app-actionbar-height)' : '0px',
        '--app-sidebar-collapsed': sidebarCollapsed ? '56px' : 'var(--app-sidebar-width)',
      } as React.CSSProperties}
    >
      {sidebarOpen && <MobileMenuOverlay onClose={() => setSidebarOpen(false)} />}

      <TopBar
        profile={profile}
        isRtl={isRtl}
        onToggleSidebar={toggleSidebar}
        onOpenSearch={() => setSearchOpen(true)}
        onToggleLanguage={toggleLanguage}
        onLogout={handleLogout}
      />

      <section className={`admin-actionbar ${actionBarVisible ? '' : 'admin-actionbar-hidden'}`}>
        {actionBarVisible && (
          <>
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`admin-action-btn ${action.variant === 'danger' ? 'text-red-600' : action.variant === 'primary' ? 'text-blue-700' : ''}`}
                onClick={action.onClick}
                disabled={action.enabled === false}
                title={action.tooltipKey ? t(action.tooltipKey) : t(action.labelKey)}
              >
                {action.icon}
                <span className="hidden sm:inline">{t(action.labelKey)}</span>
              </button>
            ))}
          </>
        )}
      </section>

      {sidebarOpen && (
        <MobileMenuPanel
          isRtl={isRtl}
          pathname={pathname}
          profile={profile}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        pathname={pathname}
        t={t}
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
        onCollapsedIconClick={onCollapsedIconClick}
        onNavigate={() => setSidebarOpen(false)}
      />

      <main className="admin-main">
        <div className="admin-main-inner">{children}</div>
      </main>

      <footer className="admin-statusbar">
        <Breadcrumb pathname={pathname} />
        <span className="text-gray-400">|</span>
        <span>{t('common.operationNo')}: —</span>
        <span className="text-gray-400">|</span>
        <span>{t('common.status')}: —</span>
        <span className="text-gray-400 hidden md:inline">|</span>
        <span className="hidden md:inline">{t('common.createdBy')}: —</span>
        <span className="text-gray-400 hidden md:inline">|</span>
        <span className="hidden md:inline">{t('common.updatedBy')}: —</span>
        <div className="flex-1" />
        <span>{clock}</span>
      </footer>

      <UnifiedSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminActionBarProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminActionBarProvider>
  );
}
