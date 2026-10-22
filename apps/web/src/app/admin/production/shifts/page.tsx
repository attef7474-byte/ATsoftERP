'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuthorizedTabs, resolveActiveTab } from '../../../../lib/use-authorized-tabs';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { ShiftsPanel } from '../../../../components/factory/unified-production/shifts-panel';
import { ShiftTemplatesPanel } from '../../../../components/factory/unified-production/shift-templates-panel';
import { ShiftCalendarsPanel } from '../../../../components/factory/unified-production/shift-calendars-panel';
import { ShiftAssignmentsPanel } from '../../../../components/factory/unified-production/shift-assignments-panel';
import { OperationalAssignmentsPanel } from '../../../../components/factory/unified-production/operational-assignments-panel';
import { ShiftHandoversPanel } from '../../../../components/factory/unified-production/shift-handovers-panel';

type UnifiedTab = 'shifts' | 'templates' | 'calendars' | 'assignments' | 'operational-assignments' | 'handovers';

const TAB_ORDER = ['shifts', 'templates', 'calendars', 'assignments', 'operational-assignments', 'handovers'] as const;
const TAB_PERMISSIONS: Record<UnifiedTab, string> = {
  shifts: 'production-shift:read',
  templates: 'production-shift-template:read',
  calendars: 'production-shift-calendar:read',
  assignments: 'production-shift-assignment:read',
  'operational-assignments': 'production-operational-assignment:read',
  handovers: 'shift-handover:read',
};
const TAB_LABELS: Record<UnifiedTab, string> = {
  shifts: 'production.shifts',
  templates: 'production.shiftTemplates',
  calendars: 'production.shiftCalendars',
  assignments: 'production.shiftAssignments',
  'operational-assignments': 'production.operationalAssignments',
  handovers: 'production.shiftHandovers.label',
};

/**
 * Unified Shifts workspace.
 *
 * Shifts and everything that depends on them (weekly templates, calendars, personnel and
 * operational assignments, handovers) are one daily operating concern, so they share one
 * workspace instead of six competing sidebar screens. The former standalone routes are kept
 * as redirect stubs so bookmarks and old links keep working. Tabs the operator is not
 * authorized for are hidden and never become the landing tab.
 */
export default function ProductionShiftsWorkspacePage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loading, forbidden, visibleTabs, isVisible } = useAuthorizedTabs<UnifiedTab>({
    order: TAB_ORDER,
    permissions: TAB_PERMISSIONS,
  });

  const requested = searchParams?.get('tab');
  const [tab, setTab] = useState<UnifiedTab>('shifts');

  useEffect(() => {
    setTab(resolveActiveTab<UnifiedTab>(requested, visibleTabs, 'shifts'));
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    if (!isVisible(next)) return;
    setTab(next as UnifiedTab);
    router.replace(`/admin/production/shifts?tab=${next}`);
  }, [isVisible, router]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('production.shiftsWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (forbidden || !visibleTabs.includes(tab)) {
    return (
      <div>
        <PageHeader title={t('production.shiftsWorkspace')} />
        <p className="text-sm text-gray-500">{forbidden ? t('errors.forbidden') : t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('production.shiftsWorkspace')} />

      <Tabs
        ariaLabel={t('production.shiftsWorkspace')}
        activeId={tab}
        onChange={selectTab}
        items={visibleTabs.map((id) => ({ id, label: t(TAB_LABELS[id]) }))}
      />

      <TabPanel id="shifts" activeId={tab}><ShiftsPanel /></TabPanel>
      <TabPanel id="templates" activeId={tab}><ShiftTemplatesPanel /></TabPanel>
      <TabPanel id="calendars" activeId={tab}><ShiftCalendarsPanel /></TabPanel>
      <TabPanel id="assignments" activeId={tab}><ShiftAssignmentsPanel /></TabPanel>
      <TabPanel id="operational-assignments" activeId={tab}><OperationalAssignmentsPanel /></TabPanel>
      <TabPanel id="handovers" activeId={tab}><ShiftHandoversPanel /></TabPanel>
    </div>
  );
}
