'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '../../lib/i18n/use-translation';
import { logout, getProfile, UserProfile } from '../../lib/auth';
import type { TranslationNamespace } from '../../lib/i18n/types';
import {
  AdminActionBarProvider,
  useAdminActionBar,
  AdminAction,
  ActionBackIcon,
  ActionRefreshIcon,
  ActionSearchIcon,
} from './admin-action-bar';
import { UnifiedSearchModal } from '../f9/UnifiedSearchModal';
import { NotificationBell } from './notifications/notification-bell';

interface NavChild {
  id: string;
  label: string;
  href: string;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  {
    id: 'dashboard', label: 'navigation.dashboard', href: '/admin/dashboard', icon: 'dashboard',
  },
  {
    id: 'core', label: 'navigation.core', href: '#', icon: 'core', children: [
      { id: 'core-companies', label: 'navigation.companies', href: '/admin/core/companies' },
      { id: 'core-branches', label: 'navigation.branches', href: '/admin/core/branches' },
      { id: 'core-departments', label: 'navigation.departments', href: '/admin/core/departments' },
    ],
  },
  {
    id: 'access', label: 'navigation.accessControl', href: '#', icon: 'access', children: [
      { id: 'access-users', label: 'navigation.users', href: '/admin/access/users' },
      { id: 'access-roles', label: 'navigation.roles', href: '/admin/access/roles' },
      { id: 'access-permissions', label: 'navigation.permissions', href: '/admin/access/permissions' },
    ],
  },
  {
    id: 'inventory', label: 'navigation.inventory', href: '#', icon: 'inventory', children: [
      { id: 'inv-warehouses', label: 'navigation.warehouses', href: '/admin/inventory/warehouses' },
      { id: 'inv-product-categories', label: 'navigation.productCategories', href: '/admin/inventory/product-categories' },
      { id: 'inv-products', label: 'navigation.products', href: '/admin/inventory/products' },
      { id: 'inv-counts', label: 'navigation.inventoryCounts', href: '/admin/inventory/counts' },
      { id: 'inv-movements', label: 'navigation.inventoryMovements', href: '/admin/inventory/movements' },
      { id: 'inv-adjustments', label: 'navigation.inventoryAdjustments', href: '/admin/inventory/adjustments' },
      { id: 'inv-balances', label: 'navigation.inventoryBalances', href: '/admin/inventory/balances' },
      { id: 'inv-locations', label: 'navigation.warehouseLocations', href: '/admin/inventory/locations' },
    ],
  },
  {
    id: 'barcodes', label: 'navigation.barcodes', href: '#', icon: 'barcode',     children: [
      { id: 'barcode-overview', label: 'barcodes.overview.title', href: '/admin/barcodes' },
      { id: 'barcode-generate', label: 'navigation.generate', href: '/admin/barcodes/generate' },
      { id: 'barcode-print', label: 'navigation.print', href: '/admin/barcodes/print' },
      { id: 'barcode-scan', label: 'navigation.scan', href: '/admin/barcodes/scan' },
      { id: 'barcode-preview', label: 'navigation.preview', href: '/admin/barcodes/preview' },
      { id: 'barcode-records', label: 'navigation.records', href: '/admin/barcodes/records' },
      { id: 'barcode-templates', label: 'navigation.templates', href: '/admin/barcodes/templates' },
      { id: 'barcode-product-labels', label: 'navigation.productLabels', href: '/admin/barcodes/product-labels' },
      { id: 'barcode-machine-cards', label: 'navigation.machineCards', href: '/admin/barcodes/machine-cards' },
      { id: 'barcode-scans', label: 'navigation.scans', href: '/admin/barcodes/scans' },
      { id: 'barcode-print-jobs', label: 'navigation.printJobs', href: '/admin/barcodes/print-jobs' },
    ],
  },
  {
    id: 'reports', label: 'navigation.reports', href: '#', icon: 'report', children: [
      { id: 'rpt-mnt-overview', label: 'navigation.maintenanceOverview', href: '/admin/reports/maintenance' },
      { id: 'rpt-mnt-requests', label: 'navigation.maintenanceRequestsReport', href: '/admin/reports/maintenance/requests' },
      { id: 'rpt-mnt-downtime', label: 'navigation.downtimeReport', href: '/admin/reports/maintenance/downtime' },
      { id: 'rpt-mnt-costs', label: 'navigation.maintenanceCostsReport', href: '/admin/reports/maintenance/costs' },
      { id: 'rpt-mnt-schedules', label: 'navigation.maintenanceSchedulesReport', href: '/admin/reports/maintenance/schedules' },
      { id: 'rpt-inv-overview', label: 'navigation.inventoryOverview', href: '/admin/reports/inventory' },
      { id: 'rpt-inv-balances', label: 'navigation.inventoryBalancesReport', href: '/admin/reports/inventory/balances' },
      { id: 'rpt-inv-movements', label: 'navigation.inventoryMovementsReport', href: '/admin/reports/inventory/movements' },
      { id: 'rpt-inv-adjustments', label: 'navigation.inventoryAdjustmentsReport', href: '/admin/reports/inventory/adjustments' },
      { id: 'rpt-inv-count-variance', label: 'navigation.countVarianceReport', href: '/admin/reports/inventory/count-variance' },
      { id: 'rpt-barcode-scans', label: 'navigation.barcodeScansReport', href: '/admin/reports/barcodes/scans' },
      { id: 'rpt-assets', label: 'navigation.assetsReport', href: '/admin/reports/assets' },
      { id: 'rpt-parts', label: 'navigation.partsReport', href: '/admin/reports/parts' },
      { id: 'rpt-partners', label: 'navigation.partnersReport', href: '/admin/reports/partners' },
      { id: 'rpt-attachments', label: 'navigation.attachmentsReport', href: '/admin/reports/attachments' },
      { id: 'rpt-audit', label: 'navigation.auditTrailReport', href: '/admin/reports/audit' },
      { id: 'rpt-user-activity', label: 'navigation.userActivityReport', href: '/admin/reports/user-activity' },
      { id: 'rpt-notifications', label: 'navigation.notificationsReport', href: '/admin/reports/notifications' },
      { id: 'rpt-machine-log', label: 'navigation.machineLogReport', href: '/admin/reports/machine-log' },
      { id: 'rpt-parts-usage', label: 'navigation.partsUsageReport', href: '/admin/reports/parts-usage' },
      { id: 'rpt-upcoming-pm', label: 'navigation.upcomingPreventiveReport', href: '/admin/reports/upcoming-preventive' },
      { id: 'rpt-overdue-pm', label: 'navigation.overduePreventiveReport', href: '/admin/reports/overdue-preventive' },
      { id: 'rpt-low-stock', label: 'navigation.lowStockReport', href: '/admin/reports/low-stock' },
    ],
  },
  {
    id: 'maintenance', label: 'navigation.maintenance', href: '#', icon: 'maintenance', children: [
      { id: 'mnt-machines', label: 'navigation.machines', href: '/admin/maintenance/machines' },
      { id: 'mnt-machine-categories', label: 'navigation.machineCategories', href: '/admin/maintenance/machine-categories' },
      { id: 'mnt-machine-parts', label: 'navigation.machineParts', href: '/admin/maintenance/machine-parts' },
      { id: 'mnt-machine-documents', label: 'navigation.machineDocuments', href: '/admin/maintenance/machine-documents' },
      { id: 'mnt-requests', label: 'navigation.maintenanceRequests', href: '/admin/maintenance/requests' },
      { id: 'mnt-tasks', label: 'navigation.maintenanceTasks', href: '/admin/maintenance/tasks' },
      { id: 'mnt-schedules', label: 'navigation.maintenanceSchedules', href: '/admin/maintenance/schedules' },
      { id: 'mnt-checklist-items', label: 'navigation.checklistItems', href: '/admin/maintenance/checklist-items' },
      { id: 'mnt-downtime-logs', label: 'navigation.downtimeLogs', href: '/admin/maintenance/downtime-logs' },
    ],
  },
  {
    id: 'search', label: 'navigation.search', href: '/admin/search', icon: 'search',
  },
  {
    id: 'alerts', label: 'navigation.alerts', href: '/admin/alerts', icon: 'dashboard',
  },
  {
    id: 'documents', label: 'navigation.documents', href: '#', icon: 'document', children: [
      { id: 'doc-attachments', label: 'navigation.attachments', href: '/admin/documents/attachments' },
    ],
  },
  {
    id: 'system', label: 'navigation.system', href: '#', icon: 'settings', children: [
      { id: 'sys-settings', label: 'navigation.settingsList', href: '/admin/settings' },
      { id: 'sys-company', label: 'navigation.companyProfile', href: '/admin/settings/company' },
      { id: 'sys-language', label: 'navigation.language', href: '/admin/settings/language' },
      { id: 'sys-appearance', label: 'navigation.appearance', href: '/admin/settings/appearance' },
      { id: 'sys-security', label: 'navigation.security', href: '/admin/settings/security' },
      { id: 'sys-numbering', label: 'navigation.numberSequences', href: '/admin/settings/numbering' },
      { id: 'sys-notification-rules', label: 'navigation.notificationRules', href: '/admin/settings/notification-rules' },
      { id: 'sys-audit', label: 'navigation.auditLog', href: '/admin/settings/audit' },
      { id: 'sys-user-activity', label: 'navigation.userActivity', href: '/admin/settings/audit/user-activity' },
      { id: 'sys-login-history', label: 'navigation.loginHistory', href: '/admin/settings/audit/login-history' },
    ],
  },
  {
    id: 'notifications', label: 'navigation.notifications', href: '/admin/notifications', icon: 'notification',
  },
  {
    id: 'messaging', label: 'navigation.messaging', href: '/admin/messaging', icon: 'messaging',
  },
];

function IconDashboard() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>); }
function IconCore() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>); }
function IconAccess() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>); }
function IconInventory() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>); }
function IconMaintenance() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>); }

function IconBarcode() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>); }
function IconReport() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>); }

function IconSettings() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>); }

function IconNotification() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>); }

function IconDocument() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>); }
function IconSearch() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>); }
function IconMessaging() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>); }

const iconMap: Record<string, React.ReactNode> = {
  dashboard: React.createElement(IconDashboard),
  core: React.createElement(IconCore),
  access: React.createElement(IconAccess),
  inventory: React.createElement(IconInventory),
  maintenance: React.createElement(IconMaintenance),
  barcode: React.createElement(IconBarcode),
  report: React.createElement(IconReport),
  settings: React.createElement(IconSettings),
  notification: React.createElement(IconNotification),
  document: React.createElement(IconDocument),
  search: React.createElement(IconSearch),
  messaging: React.createElement(IconMessaging),
};

function getPageTitle(pathname: string): string {
  if (pathname === '/admin/dashboard') return 'dashboard.title';
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];

  // Detect if the last segment looks like a UUID (detail page)
  const isId = /^[0-9a-fA-F-]{36}$/.test(last) || /^\d+$/.test(last);
  if (isId && segments.length >= 2) {
    const parent = segments[segments.length - 2];
    const detailMapping: Record<string, string> = {
      companies: 'details.company.title',
      branches: 'details.branch.title',
      departments: 'details.department.title',
      users: 'details.user.title',
      products: 'details.product.title',
      machines: 'details.machine.title',
      requests: 'details.maintenanceRequest.title',
      counts: 'details.inventoryCount.title',
      movements: 'details.inventoryMovement.title',
      adjustments: 'details.inventoryAdjustment.title',
      records: 'barcodes.records.detail',
      scans: 'barcodes.scan.title',
      'print-jobs': 'barcodes.printJobs.detail',
    };
    if (detailMapping[parent]) return detailMapping[parent];
  }

  const mapping: Record<string, string> = {
    companies: 'core.companies',
    branches: 'core.branches',
    departments: 'core.departments',
    users: 'access.users',
    roles: 'access.roles',
    permissions: 'access.permissions',
    warehouses: 'inventory.warehouses',
    'product-categories': 'inventory.productCategories',
    products: 'inventory.products',
    counts: 'inventoryCounting.counts',
    movements: 'inventoryCounting.movements',
    adjustments: 'inventoryCounting.adjustments',
    balances: 'inventoryCounting.balances',
    machines: 'maintenance.machines',
    'machine-categories': 'maintenance.machineCategories',
    'machine-parts': 'maintenance.machineParts',
    'machine-documents': 'maintenance.machineDocuments',
    requests: 'maintenance.maintenanceRequests',
    tasks: 'maintenance.maintenanceTasks',
    schedules: 'maintenance.maintenanceSchedules',
    'checklist-items': 'maintenance.checklistItems',
    'downtime-logs': 'maintenance.downtimeLogs',
    locations: 'inventory.locations.title',
    records: 'barcodes.records.title',
    templates: 'barcodes.templates.title',
    preview: 'barcodes.scanLabel',
    'product-labels': 'barcodes.productLabels.title',
    'machine-cards': 'barcodes.machineCards.title',
    scans: 'barcodes.scanHistory',
    'print-jobs': 'barcodes.printJobs.title',
    generate: 'barcodes.generate.title',
    print: 'barcodes.print.title',
    scan: 'barcodes.scan.title',
    settings: 'settings.title',
    numbering: 'settings.numbering.title',
    audit: 'settings.audit.title',
    search: 'search.title',
    notifications: 'notifications.title',
    profile: 'profile.title',
    password: 'profile.changePasswordTitle',
  };
  const nsKey = mapping[last];
  if (nsKey) return nsKey;
  return 'dashboard.title';
}

/* ===== Inner shell that consumes action bar context ===== */
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

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onCollapsedIconClick = (id: string) => {
    setSidebarCollapsed(false);
    setExpandedSections((prev) => ({ ...prev, [id]: true }));
  };

  useEffect(() => {
    getProfile().then((p) => { if (p) setProfile(p); });
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US'));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [locale]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'F9') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
        return;
      }
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !isInput) {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const pageTitleKey = useMemo(() => getPageTitle(pathname), [pathname]);

  return (
    <div
      className="admin-workspace-shell"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        '--app-actionbar-active-height': actionBarVisible ? 'var(--app-actionbar-height)' : '0px',
        '--app-sidebar-collapsed': sidebarCollapsed ? '56px' : 'var(--app-sidebar-width)',
      } as React.CSSProperties}
    >
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* === 1. Top Application Bar === */}
      <header className="admin-topbar">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="admin-hamburger">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-base font-bold text-gray-800 whitespace-nowrap">
            {t('common.appName')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setSearchOpen(true)} className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors" title={t('common.search') + ' (F9)'}>
            <ActionSearchIcon />
          </button>
          <NotificationBell />
          <button onClick={toggleLanguage} className="px-2.5 py-1 text-xs border rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap">
            {isRtl ? 'English' : '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'}
          </button>
          <Link href="/admin/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{profile?.name || t('common.loading')}</p>
              <p className="text-xs text-gray-500 truncate max-w-[120px]">{profile?.email || t('common.user')}</p>
            </div>
          </Link>
          <button onClick={handleLogout} className="px-2.5 py-1 text-xs text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap">
            {t('common.logout')}
          </button>
        </div>
      </header>

      {/* === 2. Action / Command Toolbar (context-driven) === */}
      <section className={`admin-actionbar ${actionBarVisible ? '' : 'admin-actionbar-hidden'}`}>
        {actionBarVisible && (
          <>
            {actions.map((action) => (
              <button
                key={action.id}
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

      {/* === 3. Sidebar Navigation === */}
      {sidebarOpen && (
        <aside className={`fixed inset-y-0 z-[65] w-64 bg-white shadow-xl flex flex-col ${isRtl ? 'right-0' : 'left-0'}`} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between h-[56px] px-4 border-b shrink-0">
            <span className="text-base font-bold text-gray-800">{t('common.appName')}</span>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-700 p-1">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {renderNavItems(navItems, pathname, t, iconMap, () => setSidebarOpen(false), expandedSections, toggleSection)}
          </nav>
          <div className="border-t px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-sm font-medium text-gray-700 truncate">{profile?.name || t('common.loading')}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.email || ''}</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      <aside className={`admin-sidebar hidden lg:flex ${sidebarCollapsed ? 'admin-sidebar-collapsed' : ''}`}>
        {sidebarCollapsed ? (
          <nav className="admin-sidebar-icons">
            {navItems.filter((item) => item.icon).map((item) => (
              <button
                key={item.id}
                onClick={() => onCollapsedIconClick(item.id)}
                className="sidebar-icon-btn"
                title={t(item.label)}
              >
                {iconMap[item.icon!]}
              </button>
            ))}
          </nav>
        ) : (
          <nav className="admin-sidebar-inner">
            {renderNavItems(navItems, pathname, t, iconMap, () => setSidebarOpen(false), expandedSections, toggleSection)}
          </nav>
        )}
      </aside>

      {/* === 4. Main Workspace === */}
      <main className="admin-main">
        <div className="admin-main-inner">{children}</div>
      </main>

      {/* === 5. Bottom Status / Metadata Bar === */}
      <footer className="admin-statusbar">
        <span className="font-medium">{t(pageTitleKey)}</span>
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

function renderNavItems(
  items: NavItem[],
  pathname: string,
  t: (key: string, ns?: TranslationNamespace) => string,
  iconMap: Record<string, React.ReactNode>,
  onNavigate: () => void,
  expandedSections?: Record<string, boolean>,
  onToggleSection?: (id: string) => void,
): React.ReactNode {
  const isExpanded = (id: string) => expandedSections?.[id] ?? false;

  return items.map((item) => (
    <div key={item.id}>
      {item.children ? (
        <div className="mb-2">
          <button
            onClick={() => onToggleSection?.(item.id)}
            className="flex items-center w-full px-3 py-2.5 text-sm font-bold text-gray-800 uppercase tracking-wider hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            {item.icon && <span className="shrink-0 mr-2.5 text-blue-600">{iconMap[item.icon]}</span>}
            <span className="flex-1 text-left">{t(item.label)}</span>
            <svg
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isExpanded(item.id) ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
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
      ) : (
        <Link
          href={item.href}
          className={`flex items-center px-3 py-2.5 text-sm font-bold text-gray-800 uppercase tracking-wider rounded-md transition-colors mb-1 ${
            pathname === item.href ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100 hover:text-gray-900'
          }`}
          onClick={onNavigate}
        >
          {item.icon && <span className="shrink-0 mr-2.5 text-blue-600">{iconMap[item.icon]}</span>}
          <span>{t(item.label)}</span>
        </Link>
      )}
    </div>
  ));
}
