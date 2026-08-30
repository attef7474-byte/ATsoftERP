import type { Locale } from '../i18n/types';

/**
 * Authoritative permission display catalogue for ATsofterp.
 *
 * This module is PURE metadata + pure functions. It does not read, write, or
 * enforce any permission. Its only job is to give every assignable permission a
 * deterministic:
 *   - DOMAIN (Level 1 : module/domain group)
 *   - RESOURCE (Level 2 : feature)
 *   - ACTION (Level 3 : permission action) with localized AR/EN labels
 *
 * The internal permission keys (e.g. `maintenance-request:read`) are NEVER
 * renamed or re-embedded into RBAC semantics. This is display/grouping/i18n
 * only. Unknown future permissions fall back safely without ever rendering
 * "وحدة أخرى" / "إجراء آخر" for a KNOWN key.
 */

export interface DomainDef {
  id: string;
  ar: string;
  en: string;
}

export interface ResourceDef {
  ar: string;
  en: string;
  domain: string;
}

export interface ActionDef {
  ar: string;
  en: string;
}

/** Ordered list of canonical top-level domains. */
export const PERMISSION_DOMAINS: DomainDef[] = [
  { id: 'organization', ar: 'التنظيم', en: 'Organization' },
  { id: 'accessControl', ar: 'التحكم بالوصول', en: 'Access Control' },
  { id: 'partners', ar: 'شركاء الأعمال', en: 'Business Partners' },
  { id: 'assets', ar: 'الأصول والمعدات', en: 'Assets' },
  { id: 'maintenance', ar: 'الصيانة', en: 'Maintenance' },
  { id: 'inventory', ar: 'المخزون', en: 'Inventory' },
  { id: 'production', ar: 'الإنتاج', en: 'Production' },
  { id: 'quality', ar: 'الجودة', en: 'Quality' },
  { id: 'barcode', ar: 'الباركود', en: 'Barcode' },
  { id: 'search', ar: 'البحث', en: 'Search' },
  { id: 'reports', ar: 'التقارير والتحليلات', en: 'Reports' },
  { id: 'documents', ar: 'المستندات', en: 'Documents' },
  { id: 'messaging', ar: 'المراسلات', en: 'Messaging' },
  { id: 'system', ar: 'النظام', en: 'System' },
  { id: 'legacy', ar: 'متقدم / توافق قديم', en: 'Advanced / Legacy' },
];

const M: Record<string, ResourceDef> = {
  // --- Organization ---
  company: { domain: 'organization', ar: 'الشركات', en: 'Companies' },
  branch: { domain: 'organization', ar: 'الفروع', en: 'Branches' },
  administration: { domain: 'organization', ar: 'الإدارات', en: 'Administrations' },
  department: { domain: 'organization', ar: 'الأقسام', en: 'Departments' },
  'organizational-unit': { domain: 'legacy', ar: 'الوحدات التنظيمية', en: 'Organizational Units' },
  'operation-type': { domain: 'organization', ar: 'أنواع العمليات', en: 'Operation Types' },
  'payment-term': { domain: 'organization', ar: 'شروط الدفع', en: 'Payment Terms' },
  'cost-center': { domain: 'organization', ar: 'مراكز التكلفة', en: 'Cost Centers' },
  'operational-cost-center': { domain: 'organization', ar: 'مراكز التكلفة التشغيلية', en: 'Operational Cost Centers' },
  // --- Access Control ---
  user: { domain: 'accessControl', ar: 'المستخدمون', en: 'Users' },
  role: { domain: 'accessControl', ar: 'الأدوار', en: 'Roles' },
  permission: { domain: 'accessControl', ar: 'الصلاحيات', en: 'Permissions' },
  'audit-log': { domain: 'accessControl', ar: 'سجل التدقيق', en: 'Audit Log' },
  // --- Business Partners ---
  'business-partner': { domain: 'partners', ar: 'شركاء الأعمال', en: 'Business Partners' },
  'business-partner-address': { domain: 'partners', ar: 'عناوين شركاء الأعمال', en: 'Business Partner Addresses' },
  'business-partner-bank-account': { domain: 'partners', ar: 'الحسابات البنكية لشركاء الأعمال', en: 'Business Partner Bank Accounts' },
  'business-partner-contact': { domain: 'partners', ar: 'جهات اتصال شركاء الأعمال', en: 'Business Partner Contacts' },
  'business-partner-group': { domain: 'partners', ar: 'مجموعات شركاء الأعمال', en: 'Business Partner Groups' },
  // --- Assets ---
  machine: { domain: 'assets', ar: 'الماكينات', en: 'Machines' },
  'machine-category': { domain: 'assets', ar: 'تصنيفات الماكينات', en: 'Machine Categories' },
  'machine-component': { domain: 'assets', ar: 'مكونات الماكينات', en: 'Machine Components' },
  'machine-document': { domain: 'assets', ar: 'مستندات الماكينات', en: 'Machine Documents' },
  'machine-part': { domain: 'assets', ar: 'قطع غيار الماكينات', en: 'Machine Parts' },
  'machine-responsibility': { domain: 'maintenance', ar: 'مسؤوليات الماكينات', en: 'Machine Responsibilities' },
  'machine-spare-part': { domain: 'assets', ar: 'قطع الغيار للماكينات', en: 'Machine Spare Parts' },
  'component-spare-part': { domain: 'assets', ar: 'قطع غيار المكونات', en: 'Component Spare Parts' },
  'installed-parts': { domain: 'assets', ar: 'القطع المركبة', en: 'Installed Parts' },
  'spare-part': { domain: 'assets', ar: 'قطع الغيار', en: 'Spare Parts' },
  'spare-part-conditions': { domain: 'assets', ar: 'حالات قطع الغيار', en: 'Spare Part Conditions' },
  'preventive-spare-part-plan': { domain: 'assets', ar: 'خطط قطع الغيار الوقائية', en: 'Preventive Spare Part Plans' },
  // --- Maintenance ---
  'maintenance-request': { domain: 'maintenance', ar: 'طلبات الصيانة', en: 'Maintenance Requests' },
  'maintenance-request.activity': { domain: 'maintenance', ar: 'طلبات الصيانة - النشاط', en: 'Maintenance Request Activity' },
  'maintenance-request.attachments': { domain: 'maintenance', ar: 'طلبات الصيانة - المرفقات', en: 'Maintenance Request Attachments' },
  'maintenance-request.checklist': { domain: 'maintenance', ar: 'طلبات الصيانة - قوائم الفحص', en: 'Maintenance Request Checklist' },
  'maintenance-request-assignment': { domain: 'maintenance', ar: 'تخصيص طلبات الصيانة', en: 'Maintenance Request Assignments' },
  'maintenance-request-cost': { domain: 'maintenance', ar: 'تكاليف طلبات الصيانة', en: 'Maintenance Request Costs' },
  'maintenance-request-part': { domain: 'maintenance', ar: 'قطع غيار طلبات الصيانة', en: 'Maintenance Request Parts' },
  'maintenance-request-parts': { domain: 'maintenance', ar: 'قطع غيار طلبات الصيانة (الطلبات)', en: 'Maintenance Request Part Requests' },
  'maintenance-request-required-part': { domain: 'maintenance', ar: 'قطع الغيار المطلوبة لطلبات الصيانة', en: 'Maintenance Request Required Parts' },
  'maintenance-task': { domain: 'maintenance', ar: 'مهام الصيانة', en: 'Maintenance Tasks' },
  'maintenance-schedule': { domain: 'maintenance', ar: 'جداول الصيانة', en: 'Maintenance Schedules' },
  'maintenance-checklist': { domain: 'maintenance', ar: 'قوائم الفحص', en: 'Maintenance Checklists' },
  'maintenance-checklist-execution': { domain: 'maintenance', ar: 'تنفيذ قوائم الفحص', en: 'Maintenance Checklist Execution' },
  'maintenance-work-order': { domain: 'maintenance', ar: 'أوامر العمل', en: 'Maintenance Work Orders' },
  'maintenance-work-order-cost': { domain: 'maintenance', ar: 'تكاليف أوامر العمل', en: 'Maintenance Work Order Costs' },
  'maintenance-work-order-part': { domain: 'maintenance', ar: 'قطع غيار أوامر العمل', en: 'Maintenance Work Order Parts' },
  'maintenance-bom': { domain: 'maintenance', ar: 'قوائم مكونات الصيانة', en: 'Maintenance BOM' },
  'maintenance-calendar': { domain: 'maintenance', ar: 'تقويم الصيانة', en: 'Maintenance Calendar' },
  'maintenance-dashboard': { domain: 'maintenance', ar: 'لوحة تحكم الصيانة', en: 'Maintenance Dashboard' },
  'maintenance-part-accountability': { domain: 'maintenance', ar: 'مساءلة قطع الغيار', en: 'Maintenance Part Accountability' },
  'maintenance-personnel': { domain: 'maintenance', ar: 'أفراد الصيانة', en: 'Maintenance Personnel' },
  'maintenance-planning': { domain: 'maintenance', ar: 'تخطيط الصيانة', en: 'Maintenance Planning' },
  'maintenance-reliability': { domain: 'maintenance', ar: 'موثوقية الصيانة', en: 'Maintenance Reliability' },
  'maintenance-stock-issue': { domain: 'maintenance', ar: 'صرف مخزون الصيانة', en: 'Maintenance Stock Issue' },
  'maintenance-workload': { domain: 'maintenance', ar: 'عبء عمل الصيانة', en: 'Maintenance Workload' },
  'downtime-log': { domain: 'maintenance', ar: 'سجل التوقفات', en: 'Downtime Log' },
  'downtime-rca': { domain: 'maintenance', ar: 'تحليل أسباب التوقف', en: 'Downtime RCA' },
  'preventive-maintenance': { domain: 'maintenance', ar: 'الصيانة الوقائية', en: 'Preventive Maintenance' },
  'repair-actions': { domain: 'maintenance', ar: 'إجراءات الإصلاح', en: 'Repair Actions' },
  'repair-orders': { domain: 'maintenance', ar: 'أوامر الإصلاح', en: 'Repair Orders' },
  'operational-reliability': { domain: 'maintenance', ar: 'الموثوقية التشغيلية', en: 'Operational Reliability' },
  // --- Inventory ---
  inventory: { domain: 'inventory', ar: 'المخزون العام', en: 'General Inventory' },
  'inventory-adjustment': { domain: 'inventory', ar: 'تسويات المخزون', en: 'Inventory Adjustments' },
  'inventory-balance': { domain: 'inventory', ar: 'أرصدة المخزون', en: 'Inventory Balances' },
  'inventory-count': { domain: 'inventory', ar: 'جولات الجرد', en: 'Inventory Counts' },
  'inventory-count-line': { domain: 'inventory', ar: 'بنود الجرد', en: 'Inventory Count Lines' },
  'inventory-ledger': { domain: 'inventory', ar: 'دفتر المخزون', en: 'Inventory Ledger' },
  'inventory-movement': { domain: 'inventory', ar: 'حركات المخزون', en: 'Inventory Movements' },
  'inventory-reconciliation': { domain: 'inventory', ar: 'مطابقة المخزون', en: 'Inventory Reconciliation' },
  'inventory-stock-transfer': { domain: 'inventory', ar: 'تحويلات المخزون', en: 'Inventory Stock Transfers' },
  'inventory.audit': { domain: 'inventory', ar: 'تدقيق المخزون', en: 'Inventory Audit' },
  'inventory.governance': { domain: 'inventory', ar: 'حوكمة المخزون', en: 'Inventory Governance' },
  'inventory.lock': { domain: 'inventory', ar: 'إقفال المخزون', en: 'Inventory Lock' },
  'inventory.opening-balance': { domain: 'inventory', ar: 'الأرصدة الافتتاحية', en: 'Inventory Opening Balances' },
  'inventory.operational-receipt': { domain: 'inventory', ar: 'الإيصالات التشغيلية', en: 'Inventory Operational Receipts' },
  'inventory.physical-count': { domain: 'inventory', ar: 'الجرد الفعلي', en: 'Inventory Physical Count' },
  'inventory.reports': { domain: 'inventory', ar: 'تقارير المخزون', en: 'Inventory Reports' },
  'inventory.stock-adjustment': { domain: 'inventory', ar: 'تسويات المخزون (التشغيلية)', en: 'Inventory Stock Adjustments' },
  'inventory.stock-transfer': { domain: 'inventory', ar: 'تحويلات المخزون (التشغيلية)', en: 'Inventory Stock Transfers' },
  warehouse: { domain: 'inventory', ar: 'المستودعات', en: 'Warehouses' },
  'warehouse-location': { domain: 'inventory', ar: 'مواقع المستودعات', en: 'Warehouse Locations' },
  product: { domain: 'inventory', ar: 'المنتجات', en: 'Products' },
  'product-category': { domain: 'inventory', ar: 'تصنيفات المنتجات', en: 'Product Categories' },
  // --- Production ---
  'production-analytics': { domain: 'production', ar: 'تحليلات الإنتاج', en: 'Production Analytics' },
  'production-capacity-standard': { domain: 'production', ar: 'معايير الطاقة الإنتاجية', en: 'Production Capacity Standards' },
  'production-cost-calculation': { domain: 'production', ar: 'حسابات تكاليف الإنتاج', en: 'Production Cost Calculations' },
  'production-cost-rate': { domain: 'production', ar: 'معدلات تكاليف الإنتاج', en: 'Production Cost Rates' },
  'production-cost-snapshot': { domain: 'production', ar: 'لقطات تكاليف الإنتاج', en: 'Production Cost Snapshots' },
  'production-cost-transaction': { domain: 'production', ar: 'معاملات تكاليف الإنتاج', en: 'Production Cost Transactions' },
  'production-downtime': { domain: 'production', ar: 'توقفات الإنتاج', en: 'Production Downtime' },
  'production-finished-goods-receipt': { domain: 'production', ar: 'استلام البضائع التامة', en: 'Finished Goods Receipts' },
  'production-inspection': { domain: 'production', ar: 'فحص الإنتاج', en: 'Production Inspections' },
  'production-line': { domain: 'production', ar: 'خطوط الإنتاج', en: 'Production Lines' },
  'production-loss': { domain: 'production', ar: 'فقد الإنتاج', en: 'Production Loss' },
  'production-loss-reason': { domain: 'production', ar: 'أسباب فقد الإنتاج', en: 'Production Loss Reasons' },
  'production-material-consumption': { domain: 'production', ar: 'استهلاك المواد', en: 'Production Material Consumption' },
  'production-material-document': { domain: 'production', ar: 'مستندات المواد', en: 'Production Material Documents' },
  'production-material-requirement': { domain: 'production', ar: 'متطلبات المواد', en: 'Production Material Requirements' },
  'production-measurement-point': { domain: 'production', ar: 'نقاط القياس', en: 'Production Measurement Points' },
  'production-ncr': { domain: 'production', ar: 'عدم المطابقة (NCR)', en: 'Production NCR' },
  'production-operational-assignment': { domain: 'production', ar: 'التخصيصات التشغيلية', en: 'Production Operational Assignments' },
  'production-order': { domain: 'production', ar: 'أوامر الإنتاج', en: 'Production Orders' },
  'production-output': { domain: 'production', ar: 'مخرجات الإنتاج', en: 'Production Output' },
  'production-performance-target': { domain: 'production', ar: 'أهداف الأداء', en: 'Production Performance Targets' },
  'production-product': { domain: 'production', ar: 'منتجات الإنتاج', en: 'Production Products' },
  'production-quality-plan': { domain: 'production', ar: 'خطط الجودة', en: 'Production Quality Plans' },
  'production-run': { domain: 'production', ar: 'دورات الإنتاج', en: 'Production Runs' },
  'production-shift': { domain: 'production', ar: 'الورديات', en: 'Production Shifts' },
  'production-shift-assignment': { domain: 'production', ar: 'تخصيصات الورديات', en: 'Production Shift Assignments' },
  'production-shift-calendar': { domain: 'production', ar: 'تقويم الورديات', en: 'Production Shift Calendars' },
  'production-shift-template': { domain: 'production', ar: 'قوالب الورديات', en: 'Production Shift Templates' },
  'production-traceability': { domain: 'production', ar: 'تتبع الإنتاج', en: 'Production Traceability' },
  'production-unit': { domain: 'production', ar: 'وحدات الإنتاج', en: 'Production Units' },
  // --- Quality ---
  'quality-characteristic': { domain: 'quality', ar: 'خصائص الجودة', en: 'Quality Characteristics' },
  'quality-disposition': { domain: 'quality', ar: 'قرارات الجودة', en: 'Quality Dispositions' },
  'quality-sampling-point': { domain: 'quality', ar: 'نقاط أخذ العينات', en: 'Quality Sampling Points' },
  // --- Barcode ---
  'barcode-label': { domain: 'barcode', ar: 'ملصقات الباركود', en: 'Barcode Labels' },
  'barcode-scan': { domain: 'barcode', ar: 'مسح الباركود', en: 'Barcode Scans' },
  'barcode-template': { domain: 'barcode', ar: 'قوالب الباركود', en: 'Barcode Templates' },
  // --- Search ---
  search: { domain: 'search', ar: 'البحث العام', en: 'General Search' },
  'search.entities': { domain: 'search', ar: 'البحث - الكيانات', en: 'Search Entities' },
  'search.global': { domain: 'search', ar: 'البحث - الشامل', en: 'Global Search' },
  'search.recent': { domain: 'search', ar: 'البحث - الأخير', en: 'Recent Searches' },
  // --- Reports ---
  'reports.maintenance': { domain: 'reports', ar: 'تقارير الصيانة', en: 'Maintenance Reports' },
  'reports.inventory': { domain: 'reports', ar: 'تقارير المخزون', en: 'Inventory Reports' },
  'reports.barcodes': { domain: 'reports', ar: 'تقارير الباركود', en: 'Barcode Reports' },
  'reports.operations': { domain: 'reports', ar: 'تقارير العمليات', en: 'Operations Reports' },
  // --- Documents ---
  attachment: { domain: 'documents', ar: 'المرفقات', en: 'Attachments' },
  // --- Messaging ---
  messaging: { domain: 'messaging', ar: 'المراسلات', en: 'Messaging' },
  // --- System ---
  'system-setting': { domain: 'system', ar: 'إعدادات النظام', en: 'System Settings' },
  'settings.appearance': { domain: 'system', ar: 'المظهر', en: 'Appearance' },
  numbering: { domain: 'system', ar: 'الترقيم', en: 'Numbering' },
  'number-sequence': { domain: 'system', ar: 'التسلسلات الرقمية', en: 'Number Sequences' },
  notification: { domain: 'system', ar: 'الإشعارات', en: 'Notifications' },
};

/** Action-key → localized label; covers the full action inventory. */
const A: Record<string, ActionDef> = {
  create: { ar: 'إنشاء', en: 'Create' },
  read: { ar: 'عرض', en: 'View' },
  view: { ar: 'عرض', en: 'View' },
  update: { ar: 'تحديث', en: 'Update' },
  delete: { ar: 'حذف', en: 'Delete' },
  manage: { ar: 'إدارة', en: 'Manage' },
  activate: { ar: 'تفعيل', en: 'Activate' },
  deactivate: { ar: 'تعطيل', en: 'Deactivate' },
  block: { ar: 'حظر', en: 'Block' },
  unblock: { ar: 'إلغاء الحظر', en: 'Unblock' },
  approve: { ar: 'اعتماد', en: 'Approve' },
  reject: { ar: 'رفض', en: 'Reject' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  complete: { ar: 'إكمال', en: 'Complete' },
  close: { ar: 'إغلاق', en: 'Close' },
  assign: { ar: 'تعيين', en: 'Assign' },
  accept: { ar: 'قبول', en: 'Accept' },
  reopen: { ar: 'إعادة فتح', en: 'Reopen' },
  start: { ar: 'بدء', en: 'Start' },
  end: { ar: 'إنهاء', en: 'End' },
  pause: { ar: 'إيقاف مؤقت', en: 'Pause' },
  resume: { ar: 'استئناف', en: 'Resume' },
  abort: { ar: 'إلغاء', en: 'Abort' },
  plan: { ar: 'تخطيط', en: 'Plan' },
  post: { ar: 'ترحيل', en: 'Post' },
  submit: { ar: 'إرسال', en: 'Submit' },
  print: { ar: 'طباعة', en: 'Print' },
  export: { ar: 'تصدير', en: 'Export' },
  download: { ar: 'تنزيل', en: 'Download' },
  attach: { ar: 'إرفاق', en: 'Attach' },
  generate: { ar: 'إنشاء', en: 'Generate' },
  classify: { ar: 'تصنيف', en: 'Classify' },
  analysis: { ar: 'تحليل', en: 'Analysis' },
  record: { ar: 'تسجيل', en: 'Record' },
  correct: { ar: 'تصحيح', en: 'Correct' },
  transition: { ar: 'انتقال الحالة', en: 'Transition' },
  workflow: { ar: 'سير العمل', en: 'Workflow' },
  reserve: { ar: 'حجز', en: 'Reserve' },
  request: { ar: 'طلب', en: 'Request' },
  use: { ar: 'استخدام', en: 'Use' },
  return: { ar: 'إرجاع', en: 'Return' },
  scrap: { ar: 'خردة', en: 'Scrap' },
  supersede: { ar: 'استبدال', en: 'Supersede' },
  freeze: { ar: 'تجميد', en: 'Freeze' },
  review: { ar: 'مراجعة', en: 'Review' },
  finalize: { ar: 'إنهاء', en: 'Finalize' },
  link: { ar: 'ربط', en: 'Link' },
  reverse: { ar: 'عكس', en: 'Reverse' },
  history: { ar: 'السجل', en: 'History' },
  execute: { ar: 'تنفيذ', en: 'Execute' },
  verify: { ar: 'تحقق', en: 'Verify' },
  count: { ar: 'عدّ', en: 'Count' },
  release: { ar: 'إصدار', en: 'Release' },
  archive: { ar: 'أرشفة', en: 'Archive' },
  resolve: { ar: 'حل', en: 'Resolve' },
  suspend: { ar: 'تعليق', en: 'Suspend' },
  reactivate: { ar: 'إعادة تفعيل', en: 'Reactivate' },
  prepare: { ar: 'تجهيز', en: 'Prepare' },
  invalidate: { ar: 'إبطال', en: 'Invalidate' },
  override: { ar: 'تجاوز', en: 'Override' },
  recalculate: { ar: 'إعادة حساب', en: 'Recalculate' },
  'generate-adjustment': { ar: 'إنشاء تسوية', en: 'Generate Adjustment' },
  'generate-request': { ar: 'إنشاء طلب', en: 'Generate Request' },
  'generate-due-tasks': { ar: 'إنشاء المهام المستحقة', en: 'Generate Due Tasks' },
  'delete-draft': { ar: 'حذف المسودة', en: 'Delete Draft' },
  'enter-line': { ar: 'إدخال السطر', en: 'Enter Line' },
  'reset-password': { ar: 'إعادة تعيين كلمة المرور', en: 'Reset Password' },
  'change-type': { ar: 'تغيير النوع', en: 'Change Type' },
  'update-status': { ar: 'تحديث الحالة', en: 'Update Status' },
  'update-image': { ar: 'تحديث الصورة', en: 'Update Image' },
  'update-location': { ar: 'تحديث الموقع', en: 'Update Location' },
  'update-manufacturer': { ar: 'تحديث المُصنّع', en: 'Update Manufacturer' },
  'update-warranty': { ar: 'تحديث الضمان', en: 'Update Warranty' },
  'link-machine': { ar: 'ربط بالماكينة', en: 'Link Machine' },
  'unlink-machine': { ar: 'إلغاء ربط الماكينة', en: 'Unlink Machine' },
  'start-downtime': { ar: 'بدء التوقف', en: 'Start Downtime' },
  'end-downtime': { ar: 'إنهاء التوقف', en: 'End Downtime' },
  current: { ar: 'الحالي', en: 'Current' },
  'log-summary': { ar: 'ملخص السجل', en: 'Log Summary' },
  'by-machine': { ar: 'حسب الماكينة', en: 'By Machine' },
  'by-request': { ar: 'حسب الطلب', en: 'By Request' },
  'issue-parts': { ar: 'صرف قطع الغيار', en: 'Issue Parts' },
  'report-used': { ar: 'الإبلاغ عن الاستخدام', en: 'Report Used' },
  'my-tasks': { ar: 'مهامي', en: 'My Tasks' },
  overdue: { ar: 'المتأخرة', en: 'Overdue' },
  'overdue-tasks': { ar: 'المهام المتأخرة', en: 'Overdue Tasks' },
  upcoming: { ar: 'القادمة', en: 'Upcoming' },
  'upcoming-pm': { ar: 'الصيانة الوقائية القادمة', en: 'Upcoming PM' },
  summary: { ar: 'ملخص', en: 'Summary' },
  calendar: { ar: 'التقويم', en: 'Calendar' },
  readiness: { ar: 'جاهزية', en: 'Readiness' },
  'recent-activity': { ar: 'النشاط الأخير', en: 'Recent Activity' },
  'open-requests': { ar: 'الطلبات المفتوحة', en: 'Open Requests' },
  'current-downtime': { ar: 'التوقف الحالي', en: 'Current Downtime' },
  'cost-summary': { ar: 'ملخص التكاليف', en: 'Cost Summary' },
  'parts-usage': { ar: 'استخدام القطع', en: 'Parts Usage' },
  'accountability-kpis': { ar: 'مؤشرات المساءلة', en: 'Accountability KPIs' },
  'execution-history': { ar: 'سجل التنفيذ', en: 'Execution History' },
  machines: { ar: 'الماكينات', en: 'Machines' },
  ledger: { ar: 'دفتر الأستاذ', en: 'Ledger' },
  reconciliation: { ar: 'المطابقة', en: 'Reconciliation' },
  'permissions-view': { ar: 'عرض الصلاحيات', en: 'View Permissions' },
  balances: { ar: 'الأرصدة', en: 'Balances' },
  'by-location': { ar: 'حسب الموقع', en: 'By Location' },
  'by-product': { ar: 'حسب المنتج', en: 'By Product' },
  'by-warehouse': { ar: 'حسب المستودع', en: 'By Warehouse' },
  'dashboard-cards': { ar: 'بطاقات لوحة التحكم', en: 'Dashboard Cards' },
  exceptions: { ar: 'الاستثناءات', en: 'Exceptions' },
  movements: { ar: 'الحركات', en: 'Movements' },
  'movement-types': { ar: 'أنواع الحركات', en: 'Movement Types' },
  'negative-balances': { ar: 'الأرصدة السالبة', en: 'Negative Balances' },
  'reconciliation-differences': { ar: 'فروقات المطابقة', en: 'Reconciliation Differences' },
  'stock-card': { ar: 'بطاقة المخزون', en: 'Stock Card' },
  'top-moving-items': { ar: 'العناصر الأكثر حركة', en: 'Top Moving Items' },
  traceability: { ar: 'التتبع', en: 'Traceability' },
  checklist: { ar: 'قائمة الفحص', en: 'Checklist' },
  'checklist-manage': { ar: 'إدارة قائمة الفحص', en: 'Manage Checklist' },
  'checklist-view': { ar: 'عرض قائمة الفحص', en: 'View Checklist' },
  'activity-view': { ar: 'عرض النشاط', en: 'View Activity' },
  'attachments-view': { ar: 'عرض المرفقات', en: 'View Attachments' },
  'create-checklist': { ar: 'إنشاء قائمة فحص', en: 'Create Checklist' },
  'create-emergency': { ar: 'طلب طارئ', en: 'Create Emergency' },
  reschedule: { ar: 'إعادة الجدولة', en: 'Reschedule' },
  send: { ar: 'إرسال', en: 'Send' },
  'link-maintenance': { ar: 'ربط بالصيانة', en: 'Link Maintenance' },
  // dotted compound action aliases (compact form used in real keys)
  'activity.view': { ar: 'عرض النشاط', en: 'View Activity' },
  'attachments.view': { ar: 'عرض المرفقات', en: 'View Attachments' },
  'checklist.manage': { ar: 'إدارة قائمة الفحص', en: 'Manage Checklist' },
  'checklist.view': { ar: 'عرض قائمة الفحص', en: 'View Checklist' },
};

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function normalizeResource(resource: string): string {
  return resource
    .replace(/[:/]/g, '.')
    .replace(/_/g, '-')
    .toLowerCase();
}

/**
 * Split a permission key into its resource and action parts following the real
 * key grammar:
 *   - `resource:action`     (colon separates; dots may appear in either side)
 *   - `resource/action`
 *   - `resource.action`     (no colon: the LAST dot segment is the action)
 * Examples:
 *   `inventory.physical-count:post`        → resource `inventory.physical-count`, action `post`
 *   `maintenance-request:activity.view`    → resource `maintenance-request`, action `activity.view`
 *   `settings.appearance.manage`           → resource `settings.appearance`, action `manage`
 */
export function splitPermissionKey(key: string): { resource: string | null; action: string | null } {
  if (!key) return { resource: null, action: null };
  const lastSep = Math.max(key.lastIndexOf(':'), key.lastIndexOf('/'));
  if (lastSep !== -1) {
    return {
      resource: normalizeResource(key.slice(0, lastSep)),
      action: key.slice(lastSep + 1),
    };
  }
  const parts = key.split('.');
  if (parts.length <= 1) return { resource: parts[0] || null, action: null };
  const action = parts[parts.length - 1];
  const resource = normalizeResource(parts.slice(0, -1).join('.'));
  return { resource, action };
}

export function getResourceDef(key: string): ResourceDef | null {
  const { resource } = splitPermissionKey(key);
  return resource ? M[resource] || null : null;
}

export function getActionDef(key: string): ActionDef | null {
  const { action } = splitPermissionKey(key);
  if (!action) return null;
  const raw = A[action];
  if (raw) return raw;
  const norm = normalizeKey(action);
  return A[norm] || null;
}

export function getDomainLabel(domainId: string, locale: Locale): string {
  const d = PERMISSION_DOMAINS.find((x) => x.id === domainId);
  if (!d) return locale === 'ar' ? 'أخرى' : 'Other';
  return locale === 'ar' ? d.ar : d.en;
}

export function getDomainForResource(resource: string): string {
  const label = M[normalizeResource(resource)];
  return label ? label.domain : 'legacy';
}

/** English human label for a resource (used for search + display). */
export function getResourceLabel(key: string, locale: Locale): string {
  const def = getResourceDef(key);
  if (!def) return locale === 'ar' ? 'وحدة أخرى' : 'Other Module';
  return locale === 'ar' ? def.ar : def.en;
}

export function getActionLabel(key: string, locale: Locale): string {
  const def = getActionDef(key);
  if (!def) return locale === 'ar' ? 'إجراء آخر' : 'Other Action';
  return locale === 'ar' ? def.ar : def.en;
}

export function isKnownResource(resource: string): boolean {
  return Boolean(M[normalizeResource(resource)]);
}

export interface TreePermission {
  id: string;
  key: string;
  resource: string;
  action: string;
  actionAr: string;
  actionEn: string;
  checked: boolean;
}

export interface TreeResource {
  key: string;
  ar: string;
  en: string;
  permissions: TreePermission[];
  checked: boolean;
  someChecked: boolean;
}

export interface TreeDomain {
  id: string;
  ar: string;
  en: string;
  resources: TreeResource[];
}

export interface CatalogueInput {
  id: string;
  key: string;
  checked: boolean;
}

/**
 * Build the authoritative three-level tree (domain → resource → action) from a
 * flat list of permission units. Selection is derived from the input `checked`
 * flag and is never duplicated.
 */
export function buildPermissionTree(units: CatalogueInput[]): TreeDomain[] {
  const domainIndex = new Map<string, TreeDomain>();
  for (const d of PERMISSION_DOMAINS) domainIndex.set(d.id, { id: d.id, ar: d.ar, en: d.en, resources: [] });

  const resourceBuckets = new Map<string, TreeResource>();

  const ensureResource = (resource: string): TreeResource => {
    let r = resourceBuckets.get(resource);
    if (r) return r;
    const label = M[normalizeResource(resource)];
    const domainId = label ? label.domain : 'legacy';
    r = {
      key: resource,
      ar: label ? label.ar : resource,
      en: label ? label.en : resource,
      permissions: [],
      checked: false,
      someChecked: false,
    };
    resourceBuckets.set(resource, r);
    domainIndex.get(domainId)!.resources.push(r);
    return r;
  };

  for (const unit of units) {
    const res = splitPermissionKey(unit.key);
    const actionDef = getActionDef(unit.key);
    if (!res.resource || !actionDef || !res.action) continue;
    const r = ensureResource(res.resource);
    r.permissions.push({
      id: unit.id,
      key: unit.key,
      resource: res.resource,
      action: res.action,
      actionAr: actionDef.ar,
      actionEn: actionDef.en,
      checked: unit.checked,
    });
  }

  const result: TreeDomain[] = [];
  for (const domain of domainIndex.values()) {
    if (domain.resources.length === 0) continue;
    for (const r of domain.resources) {
      const total = r.permissions.length;
      const selected = r.permissions.filter((p) => p.checked).length;
      r.checked = total > 0 && selected === total;
      r.someChecked = selected > 0 && selected < total;
    }
    result.push(domain);
  }
  return result;
}

/** All action keys known to the catalogue (normalized). */
export function knownActionKeys(): string[] {
  return Object.keys(A);
}

/** All resource keys known to the catalogue. */
export function knownResourceKeys(): string[] {
  return Object.keys(M);
}

export { M as __RESOURCE_LABELS, A as __ACTION_LABELS };
