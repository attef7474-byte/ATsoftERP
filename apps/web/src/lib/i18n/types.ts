export type Locale = 'en' | 'ar';

export type TranslationNamespace =
  | 'common'
  | 'auth'
  | 'dashboard'
  | 'navigation'
  | 'actions'
  | 'status'
  | 'validation'
  | 'errors'
  | 'core'
  | 'access'
  | 'inventory'
  | 'maintenance'
  | 'cmms'
  | 'f9'
  | 'inventoryCounting'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'barcodes'
  | 'workspace'
  | 'settings'
  | 'notifications'
  | 'profile'
  | 'details'
  | 'inventoryCountWorkflow'
  | 'maintenanceWorkflow'
  | 'unifiedSearch'
  | 'complexForms'
  | 'reports'
  | 'alerts'
  | 'companyProfile'
  | 'languageSettings'
  | 'appearanceSettings'
  | 'securitySettings'
  | 'notificationRules'
  | 'attachments'
  | 'userActivity'
  | 'loginHistory'
  | 'maintenanceDashboard'
  | 'preventiveMaintenance'
  | 'downtimeAnalysis';

export type TranslationValue = string | { [key: string]: TranslationValue };
export type Translations = Record<string, TranslationValue>;
export type LocaleTranslations = Record<TranslationNamespace, Translations>;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, ns?: TranslationNamespace) => string;
  dir: 'ltr' | 'rtl';
}
