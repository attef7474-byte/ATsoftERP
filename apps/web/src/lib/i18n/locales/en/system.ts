import type { LocaleTranslations } from '../../types';

const system: Pick<LocaleTranslations, 'alerts'> = {
    alerts: {
        title: 'Alerts',
        type: 'Type',
        severity: 'Severity',
        status: 'Status',
        description: 'Description',
        noAlerts: 'No alerts found',
        loadingAlerts: 'Loading alerts...',
        CRITICAL_REQUEST: 'Critical Request',
        DOWNTIME: 'Downtime',
        LOW_STOCK: 'Low Stock',
        UNDER_MAINTENANCE: 'Under Maintenance',
    }
};

export default system;
