'use client';
import React from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { PageHeader, Card } from '../../../components/admin/ui';
import Link from 'next/link';

const reportGroups = [
  {
    titleKey: 'navigation.maintenanceReports',
    links: [
      { href: '/admin/reports/operations', labelKey: 'navigation.operationsReport' },
      { href: '/admin/reports/maintenance', labelKey: 'navigation.maintenanceOverview' },
      { href: '/admin/reports/maintenance/kpis', labelKey: 'navigation.maintenanceKpisReport' },
      { href: '/admin/reports/maintenance/requests', labelKey: 'navigation.maintenanceRequestsReport' },
      { href: '/admin/reports/maintenance/downtime', labelKey: 'navigation.downtimeReport' },
      { href: '/admin/reports/maintenance/costs', labelKey: 'navigation.maintenanceCostsReport' },
      { href: '/admin/reports/maintenance/schedules', labelKey: 'navigation.maintenanceSchedulesReport' },
    ],
  },
  {
    titleKey: 'navigation.inventoryReports',
    links: [
      { href: '/admin/reports/inventory', labelKey: 'navigation.inventoryOverview' },
      { href: '/admin/reports/inventory/balances', labelKey: 'navigation.inventoryBalancesReport' },
      { href: '/admin/reports/inventory/movements', labelKey: 'navigation.inventoryMovementsReport' },
      { href: '/admin/reports/inventory/adjustments', labelKey: 'navigation.inventoryAdjustmentsReport' },
      { href: '/admin/reports/inventory/count-variance', labelKey: 'navigation.countVarianceReport' },
    ],
  },
  {
    titleKey: 'navigation.otherReports',
    links: [
      { href: '/admin/reports/parts', labelKey: 'navigation.partsReport' },
      { href: '/admin/reports/parts-usage', labelKey: 'navigation.partsUsageReport' },
      { href: '/admin/reports/assets', labelKey: 'navigation.assetsReport' },
      { href: '/admin/reports/partners', labelKey: 'navigation.partnersReport' },
      { href: '/admin/reports/audit', labelKey: 'navigation.auditTrailReport' },
      { href: '/admin/reports/user-activity', labelKey: 'navigation.userActivityReport' },
      { href: '/admin/reports/low-stock', labelKey: 'navigation.lowStockReport' },
      { href: '/admin/reports/upcoming-preventive', labelKey: 'navigation.upcomingPreventiveReport' },
      { href: '/admin/reports/overdue-preventive', labelKey: 'navigation.overduePreventiveReport' },
      { href: '/admin/reports/barcodes/scans', labelKey: 'navigation.barcodeScansReport' },
    ],
  },
];

export default function ReportsIndexPage() {
  const { t, dir } = useTranslation();

  return (
    <div>
      <PageHeader title={t('navigation.reports')} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
        {reportGroups.map((group) => (
          <Card key={group.titleKey} className="p-4">
            <h3 className="text-lg font-semibold mb-3">{t(group.titleKey)}</h3>
            <ul className="space-y-2" style={{ direction: dir }}>
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-blue-600 hover:underline text-sm block py-1">
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
