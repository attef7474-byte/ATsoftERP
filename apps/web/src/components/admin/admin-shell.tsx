'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '../../lib/i18n/use-translation';
import { logout, getProfile, UserProfile } from '../../lib/auth';

interface NavItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'navigation.dashboard', href: '/admin/dashboard', icon: 'dashboard',
  },
  {
    label: 'navigation.coreManagement', href: '#', icon: 'core', children: [
      { label: 'navigation.companies', href: '/admin/core/companies' },
      { label: 'navigation.branches', href: '/admin/core/branches' },
      { label: 'navigation.departments', href: '/admin/core/departments' },
    ],
  },
  {
    label: 'navigation.accessControl', href: '#', icon: 'access', children: [
      { label: 'navigation.users', href: '/admin/access/users' },
      { label: 'navigation.roles', href: '/admin/access/roles' },
      { label: 'navigation.permissions', href: '/admin/access/permissions' },
    ],
  },
  {
    label: 'navigation.inventory', href: '#', icon: 'inventory', children: [
      { label: 'navigation.warehouses', href: '/admin/inventory/warehouses' },
      { label: 'navigation.productCategories', href: '/admin/inventory/product-categories' },
      { label: 'navigation.products', href: '/admin/inventory/products' },
      { label: 'navigation.inventoryCounts', href: '/admin/inventory/counts' },
      { label: 'navigation.inventoryMovements', href: '/admin/inventory/movements' },
      { label: 'navigation.inventoryAdjustments', href: '/admin/inventory/adjustments' },
      { label: 'navigation.inventoryBalances', href: '/admin/inventory/balances' },
    ],
  },
  {
    label: 'navigation.maintenance', href: '#', icon: 'maintenance', children: [
      { label: 'navigation.machines', href: '/admin/maintenance/machines' },
      { label: 'navigation.machineCategories', href: '/admin/maintenance/machine-categories' },
      { label: 'navigation.machineParts', href: '/admin/maintenance/machine-parts' },
      { label: 'navigation.machineDocuments', href: '/admin/maintenance/machine-documents' },
      { label: 'navigation.maintenanceRequests', href: '/admin/maintenance/requests' },
      { label: 'navigation.maintenanceTasks', href: '/admin/maintenance/tasks' },
      { label: 'navigation.maintenanceSchedules', href: '/admin/maintenance/schedules' },
      { label: 'navigation.checklistItems', href: '/admin/maintenance/checklist-items' },
      { label: 'navigation.downtimeLogs', href: '/admin/maintenance/downtime-logs' },
    ],
  },
];

function IconDashboard() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>); }
function IconCore() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>); }
function IconAccess() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>); }
function IconInventory() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>); }
function IconMaintenance() { return (<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>); }

const iconMap: Record<string, React.ReactNode> = {
  dashboard: React.createElement(IconDashboard),
  core: React.createElement(IconCore),
  access: React.createElement(IconAccess),
  inventory: React.createElement(IconInventory),
  maintenance: React.createElement(IconMaintenance),
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile().then((p) => { if (p) setProfile(p); });
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleLanguage = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    setLocale(newLocale);
  };

  return (
    <div className="min-h-screen bg-gray-100" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <span className="text-lg font-bold text-gray-800">ATsoft ERP</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700 lg:hidden"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="px-4 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {navItems.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <div className="mb-2">
                  <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 uppercase tracking-wider">
                    {item.icon && iconMap[item.icon]}
                    <span className="ml-2">{t(item.label)}</span>
                  </div>
                  <div className="ml-4 space-y-1 mt-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                          pathname === child.href
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        {child.label && t(child.label)}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors mb-1 ${
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.icon && iconMap[item.icon]}
                  <span className="ml-2">{t(item.label)}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white shadow-sm border-b">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 lg:hidden"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1" />
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleLanguage}
                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors"
              >
                {locale === 'ar' ? 'English' : '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'}
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-700">{profile?.name || t('common.loading')}</p>
                  <p className="text-xs text-gray-500">{profile?.email || ''}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
              >
                {t('common.logout')}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
