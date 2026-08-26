'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { AdminActionBarProvider, useAdminActionBar } from '../admin-action-bar';
import { UnifiedSearchModal } from '../../f9/UnifiedSearchModal';
import { useAppearance } from '../theme/appearance-provider';
import { Breadcrumb } from './breadcrumb';
import { useF9Shortcut } from './f9-shortcut';
import { MobileMenuOverlay, MobileMenuPanel } from './mobile-menu';
import { Sidebar, getActiveGroupId } from './sidebar';
import { TopBar } from './top-bar';

// Single JS breakpoint. Matches globals.css `@media (max-width: 1023px)` (which hides
// the desktop sidebar for widths strictly below 1024px) and Tailwind `lg:` (>=1024px).
const MOBILE_BREAKPOINT = 1024;

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useTranslation();
  const { user: profile, logout } = useAuth();
  const pathname = usePathname();
  const { visible: actionBarVisible, actions } = useAdminActionBar();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const isRtl = locale === 'ar';
  const { settings: appearanceSettings, loading: appearanceLoading } = useAppearance();

  // Sidebar theme settings (loaded from data-attrs on mount)
  const [sidebarBg, setSidebarBg] = useState('navy');
  const [sidebarAccent, setSidebarAccent] = useState('teal');
  const [sidebarDensity, setSidebarDensity] = useState('default');
  const [sidebarFont, setSidebarFont] = useState('normal');
  const [appearanceSynced, setAppearanceSynced] = useState(false);

  const toggleSearch = useCallback(() => {
    setSearchOpen((previous) => !previous);
  }, []);
  useF9Shortcut(toggleSearch);

  // Auto-collapse accordion: only one group open at a time
  const toggleGroup = useCallback((id: string) => {
    setOpenGroup((prev) => (prev === id ? null : id));
  }, []);

  // When navigating, auto-open the correct group
  const activeGroupId = useMemo(() => getActiveGroupId(pathname), [pathname]);

  // Sync openGroup with activeGroupId on route changes
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroup(activeGroupId);
    }
  }, [activeGroupId]);

  // On collapsed icon click: expand sidebar + open that group
  const onCollapsedIconClick = useCallback((id: string) => {
    setSidebarCollapsed(false);
    setOpenGroup(id);
  }, []);

  // Load sidebar theme settings from localStorage (synced from Appearance page)
  useEffect(() => {
    const bg = localStorage.getItem('sidebar-background-mode') || 'navy';
    const accent = localStorage.getItem('sidebar-accent-color') || 'teal';
    const density = localStorage.getItem('sidebar-density') || 'default';
    const font = localStorage.getItem('sidebar-font-size') || 'normal';
    setSidebarBg(bg);
    setSidebarAccent(accent);
    setSidebarDensity(density);
    setSidebarFont(font);
  }, []);

  // Server state is authoritative once appearance settings load
  useEffect(() => {
    if (!appearanceLoading && !appearanceSynced) {
      setSidebarBg(appearanceSettings.sidebarBg);
      setSidebarAccent(appearanceSettings.sidebarAccent);
      setSidebarDensity(appearanceSettings.sidebarDensity);
      setSidebarFont(appearanceSettings.sidebarFont);
      setSidebarCollapsed(appearanceSettings.sidebarCollapsed);
      setAppearanceSynced(true);
    }
  }, [appearanceLoading, appearanceSettings, appearanceSynced]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US'));
    tick();
    const timerId = setInterval(tick, 30000);
    return () => clearInterval(timerId);
  }, [locale]);

  const handleLogout = () => { void logout(); };
  const toggleLanguage = () => { setLocale(locale === 'ar' ? 'en' : 'ar'); };

  const toggleSidebar = () => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setSidebarOpen(true);
    } else {
      setSidebarCollapsed((previous) => !previous);
    }
  };

  // When the window grows back to desktop width, dismiss the mobile drawer so no
  // stale overlay/drawer remains on top of the desktop sidebar.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Combine sidebar theme data-attrs
  const sidebarDataAttrs = {
    'data-sidebar-bg': sidebarBg,
    'data-sidebar-accent': sidebarAccent,
    'data-sidebar-density': sidebarDensity,
    'data-sidebar-font': sidebarFont,
  } as Record<string, string>;

  return (
    <div
      className="admin-workspace-shell"
      dir={isRtl ? 'rtl' : 'ltr'}
      {...sidebarDataAttrs}
      style={{
        '--app-actionbar-active-height': actionBarVisible ? 'var(--app-actionbar-height)' : '0px',
        '--app-sidebar-collapsed': sidebarCollapsed ? '72px' : 'var(--app-sidebar-width)',
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

      <section className={`admin-actionbar ${actionBarVisible || actions.length > 0 ? '' : 'admin-actionbar-hidden'}`}>
        {(actionBarVisible || actions.length > 0) && actions.map((action) => (
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
      </section>

      {sidebarOpen && (
        <MobileMenuPanel
          isRtl={isRtl}
          pathname={pathname}
          activeGroupId={activeGroupId}
          profile={profile}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        pathname={pathname}
        t={t}
        openGroup={openGroup}
        onToggleGroup={toggleGroup}
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
