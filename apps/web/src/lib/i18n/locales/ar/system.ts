import type { LocaleTranslations } from '../../types';

const system: Pick<LocaleTranslations, 'alerts'> = {
    alerts: {
        title: '\u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a',
        type: '\u0627\u0644\u0646\u0648\u0639',
        severity: '\u0627\u0644\u0623\u0647\u0645\u064a\u0629',
        status: '\u0627\u0644\u062d\u0627\u0644\u0629',
        description: '\u0627\u0644\u0648\u0635\u0641',
        noAlerts: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0646\u0628\u064a\u0647\u0627\u062a',
        loadingAlerts: '\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a...',
        CRITICAL_REQUEST: '\u0637\u0644\u0628 \u062d\u0631\u062c',
        DOWNTIME: '\u062a\u0639\u0637\u0644',
        LOW_STOCK: '\u0645\u062e\u0632\u0648\u0646 \u0645\u0646\u062e\u0641\u0636',
        UNDER_MAINTENANCE: '\u062a\u062d\u062a \u0627\u0644\u0635\u064a\u0627\u0646\u0629',
    }
};

export default system;
