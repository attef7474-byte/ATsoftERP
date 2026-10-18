'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useAuth } from '../../../../lib/auth-context';
import { PageHeader, Tabs, TabPanel } from '../../../../components/admin/ui';
import { ShiftsPanel } from '../../../../components/factory/unified-production/shifts-panel';
import { ShiftTemplatesPanel } from '../../../../components/factory/unified-production/shift-templates-panel';
import { ShiftCalendarsPanel } from '../../../../components/factory/unified-production/shift-calendars-panel';
import { ShiftAssignmentsPanel } from '../../../../components/factory/unified-production/shift-assignments-panel';
import { OperationalAssignmentsPanel } from '../../../../components/factory/unified-production/operational-assignments-panel';
import { ShiftHandoversPanel } from '../../../../components/factory/unified-production/shift-handovers-panel';

type UnifiedTab = 'shifts' | 'templates' | 'calendars' | 'assignments' | 'operational-assignments' | 'handovers';

interface TabDef {
  id: UnifiedTab;
  labelKey: string;
  permission: string;
}

/**
 * Unified Shifts workspace.
 *
 * Shifts and everything that depends on them (weekly templates, calendars, personnel and
 * operational assignments, handovers) are one daily operating concern, so they share one
 * workspace instead of six competing sidebar screens. The former standalone routes are kept
 * as redirect stubs so bookmarks and old links keep working.
 */
export default function ProductionShiftsWorkspacePage() {
  const { t } = useTranslation();
  const { permissions, isSuperAdmin } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabDefs = useMemo<TabDef[]>(() => [
    { id: 'shifts', labelKey: 'production.shifts', permission: 'production-shift:read' },
    { id: 'templates', labelKey: 'production.shiftTemplates', permission: 'production-shift-template:read' },
    { id: 'calendars', labelKey: 'production.shiftCalendars', permission: 'production-shift-calendar:read' },
    { id: 'assignments', labelKey: 'production.shiftAssignments', permission: 'production-shift-assignment:read' },
    { id: 'operational-assignments', labelKey: 'production.operationalAssignments', permission: 'production-operational-assignment:read' },
    { id: 'handovers', labelKey: 'production.shiftHandovers', permission: 'shift-handover:read' },
  ], []);

  const can = useCallback(
    (permission: string) => isSuperAdmin || (permissions?.permissions?.includes(permission) ?? false),
    [isSuperAdmin, permissions],
  );

  const visibleTabs = useMemo(() => tabDefs.filter((d) => can(d.permission)), [tabDefs, can]);

  const requested = searchParams?.get('tab') as UnifiedTab | null;
  const [tab, setTab] = useState<UnifiedTab | null>(null);

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const requestedAllowed = requested && visibleTabs.some((d) => d.id === requested);
    setTab(requestedAllowed ? (requested as UnifiedTab) : visibleTabs[0].id);
  }, [requested, visibleTabs]);

  const selectTab = useCallback((next: string) => {
    setTab(next as UnifiedTab);
    router.replace(`/admin/production/shifts?tab=${next}`);
  }, [router]);

  if (!permissions) {
    return (
      <div>
        <PageHeader title={t('production.shiftsWorkspace')} />
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div>
        <PageHeader title={t('production.shiftsWorkspace')} />
        <p className="text-sm text-gray-500">{t('errors.forbidden')}</p>
      </div>
    );
  }

  const activeTab = tab && visibleTabs.some((d) => d.id === tab) ? tab : visibleTabs[0].id;

  return (
    <div>
      <PageHeader title={t('production.shiftsWorkspace')} />

      <Tabs
        ariaLabel={t('production.shiftsWorkspace')}
        activeId={activeTab}
        onChange={selectTab}
        items={visibleTabs.map((d) => ({ id: d.id, label: t(d.labelKey) }))}
      />

      <TabPanel id="shifts" activeId={activeTab}><ShiftsPanel /></TabPanel>
      <TabPanel id="templates" activeId={activeTab}><ShiftTemplatesPanel /></TabPanel>
      <TabPanel id="calendars" activeId={activeTab}><ShiftCalendarsPanel /></TabPanel>
      <TabPanel id="assignments" activeId={activeTab}><ShiftAssignmentsPanel /></TabPanel>
      <TabPanel id="operational-assignments" activeId={activeTab}><OperationalAssignmentsPanel /></TabPanel>
      <TabPanel id="handovers" activeId={activeTab}><ShiftHandoversPanel /></TabPanel>
    </div>
  );
}
