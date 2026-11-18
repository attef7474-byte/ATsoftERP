'use client';

import React from 'react';
import { PageHeader } from '../../../../components/admin/ui';
import { ProductionMonitoringPanel } from '../../../../components/factory/production-monitoring-panel';
import { useTranslation } from '../../../../lib/i18n/use-translation';
export default function ProductionMonitoringPage() {
  const {
    t
  } = useTranslation();
  return <div><PageHeader title={t('production.monitoring.title')} /><ProductionMonitoringPanel /></div>;
}
