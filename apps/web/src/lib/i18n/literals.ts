import { Locale } from './types';
import en from './locales/en';
import ar from './locales/ar';

const allTranslations = { en, ar };

function getNestedValue(source: unknown, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
  return typeof value === 'string' ? value : undefined;
}

function toCamelCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\s-]+(.)?/g, (_, char: string | undefined) => char ? char.toUpperCase() : '');
}

function translateFromNamespaces(value: string, locale: Locale, namespaces: string[]): string | undefined {
  const translations = allTranslations[locale] as Record<string, unknown>;
  const candidates = Array.from(new Set([
    value,
    value.toUpperCase(),
    value.toLowerCase(),
    toCamelCase(value),
  ]));

  for (const namespace of namespaces) {
    const namespaceData = translations[namespace];
    for (const candidate of candidates) {
      const translated = getNestedValue(namespaceData, candidate);
      if (translated) return translated;
    }
  }
  return undefined;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function translateStatus(status: string, locale: Locale): string {
  if (!status) return '-';
  return translateFromNamespaces(status, locale, ['status']) || humanize(status);
}

export function translateEnum(value: string, locale: Locale, ns?: string): string {
  if (!value) return '-';
  const namespaces = ns
    ? [ns, 'status', 'actions']
    : ['status', 'actions', 'maintenance', 'inventoryCounting', 'inventory', 'barcodes'];
  return translateFromNamespaces(value, locale, namespaces) || humanize(value);
}

export function translateAuditAction(value: string, locale: Locale): string {
  if (!value) return '-';
  return translateFromNamespaces(value, locale, ['actions', 'status']) || humanize(value);
}

export function translateMaintenanceType(value: string, locale: Locale): string {
  return translateEnum(value, locale, 'maintenance');
}

export function translatePriority(value: string, locale: Locale): string {
  return translateStatus(value, locale);
}

export function translateBarcodeType(value: string, locale: Locale): string {
  return translateEnum(value, locale, 'barcodes');
}

export function translateEntityType(value: string, locale: Locale): string {
  if (!value) return '-';
  return translateFromNamespaces(value, locale, ['status', 'barcodes', 'maintenance', 'inventory']) || humanize(value);
}

export function translateUnit(value: string, locale: Locale): string {
  if (!value) return '';
  if (value === '%') return value;
  return translateFromNamespaces(value, locale, ['common']) || humanize(value);
}

export function translateMovementType(value: string, locale: Locale): string {
  if (!value) return '-';
  return translateFromNamespaces(value, locale, ['status', 'inventoryCounting', 'inventory']) || humanize(value);
}

export function translatePermissionKey(key: string, locale: Locale): string {
  if (!key) return '-';
  const parts = key.split(/[.:/]/).filter(Boolean);
  const actionRaw = parts.pop() || '';
  const moduleRaw = parts.join(' ');
  const normalize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const moduleKey = normalize(moduleRaw);
  const actionKey = normalize(actionRaw);
  const moduleAr: Record<string, string> = {
    administration: 'الإدارة', attachment: 'المرفقات', 'audit log': 'سجل التدقيق', inventory: 'المخزون', maintenance: 'الصيانة', production: 'الإنتاج', quality: 'الجودة', organization: 'التنظيم', role: 'الأدوار', user: 'المستخدمون', appearance: 'المظهر', 'settings appearance': 'المظهر',
    'barcode label': 'ملصقات الباركود', 'barcode scan': 'مسح الباركود', 'barcode template': 'قوالب الباركود', branch: 'الفروع', 'business partner': 'شريك الأعمال', 'business partner address': 'عناوين شركاء الأعمال', 'business partner bank account': 'حسابات بنكية لشركاء الأعمال', 'business partner contact': 'جهات اتصال شركاء الأعمال', 'business partner group': 'مجموعات شركاء الأعمال', company: 'الشركات', 'component spare part': 'قطع غيار المكونات', 'cost center': 'مراكز التكلفة', department: 'الأقسام', 'downtime log': 'سجل التوقفات', 'downtime rca': 'تحليل أسباب التوقف', 'installed parts': 'القطع المركبة', 'inventory physical count': 'الجرد الفعلي للمخزون', 'inventory reports': 'تقارير المخزون'
  };
  const moduleEn: Record<string, string> = {
    administration: 'Administration', attachment: 'Attachments', 'audit log': 'Audit Log', inventory: 'Inventory', maintenance: 'Maintenance', production: 'Production', quality: 'Quality', organization: 'Organization', role: 'Roles', user: 'Users',
    'barcode label': 'Barcode Labels', 'barcode scan': 'Barcode Scans', 'barcode template': 'Barcode Templates', branch: 'Branches', 'business partner': 'Business Partners', 'business partner address': 'Business Partner Addresses', 'business partner bank account': 'Business Partner Bank Accounts', 'business partner contact': 'Business Partner Contacts', 'business partner group': 'Business Partner Groups', company: 'Companies', 'component spare part': 'Component Spare Parts', 'cost center': 'Cost Centers', department: 'Departments', 'downtime log': 'Downtime Logs', 'downtime rca': 'Downtime RCA', 'installed parts': 'Installed Parts', 'inventory physical count': 'Inventory Physical Counts', 'inventory reports': 'Inventory Reports'
  };
  const actionAr: Record<string, string> = { create: 'إنشاء', read: 'عرض', manage: 'إدارة', view: 'عرض', update: 'تحديث', edit: 'تعديل', delete: 'حذف', activate: 'تفعيل', deactivate: 'تعطيل', assign: 'تعيين', approve: 'اعتماد', reject: 'رفض', cancel: 'إلغاء', complete: 'إكمال', close: 'إغلاق', block: 'حظر', unblock: 'إلغاء الحظر', analysis: 'تحليل', classify: 'تصنيف', current: 'الحالي', 'end downtime': 'إنهاء التوقف', enddowntime: 'إنهاء التوقف', 'start downtime': 'بدء التوقف', startdowntime: 'بدء التوقف', 'log summary': 'ملخص السجل', logsummary: 'ملخص السجل', bymachine: 'حسب الآلة', 'by machine': 'حسب الآلة', 'by location': 'حسب الموقع', 'by product': 'حسب المنتج', balances: 'الأرصدة', 'change type': 'تغيير النوع', changetype: 'تغيير النوع', 'enter line': 'إدخال السطر', post: 'ترحيل', 'update status': 'تحديث الحالة', updatestatus: 'تحديث الحالة', status: 'الحالة', readall: 'عرض الكل' };
  const actionEn: Record<string, string> = { create: 'Create', read: 'View', view: 'View', update: 'Update', edit: 'Edit', delete: 'Delete', activate: 'Activate', deactivate: 'Deactivate', assign: 'Assign', approve: 'Approve', reject: 'Reject', cancel: 'Cancel', complete: 'Complete', close: 'Close', block: 'Block', unblock: 'Unblock', analysis: 'Analysis', classify: 'Classify', current: 'Current', enddowntime: 'End Downtime', startdowntime: 'Start Downtime', logsummary: 'Log Summary', bymachine: 'By Machine', 'by machine': 'By Machine', 'by location': 'By Location', 'by product': 'By Product', balances: 'Balances', changetype: 'Change Type', 'enter line': 'Enter Line', post: 'Post', updatestatus: 'Update Status', status: 'Status', readall: 'View All' };
  const humanize = (value: string) => value.split(' ').map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
  const moduleLabel = locale === 'ar' ? (moduleAr[moduleKey] || 'وحدة أخرى') : (moduleEn[moduleKey] || humanize(moduleKey));
  const actionLabel = locale === 'ar' ? (actionAr[actionKey] || 'إجراء آخر') : (actionEn[actionKey] || humanize(actionKey));
  return moduleLabel ? moduleLabel + ' — ' + actionLabel : actionLabel;
}

export function formatDateTime(date: string | Date | null | undefined, locale: Locale): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

export function formatDate(date: string | Date | null | undefined, locale: Locale): string {
  return formatDateTime(date, locale);
}
