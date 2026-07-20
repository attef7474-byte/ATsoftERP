import 'package:flutter/material.dart';

class AppLocalizations {
  final Locale locale;

  AppLocalizations(this.locale);

  static AppLocalizations of(BuildContext context) =>
      Localizations.of<AppLocalizations>(context, AppLocalizations)!;

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  bool get isArabic => locale.languageCode == 'ar';

  String get appName => 'ATsoft ERP';

  // Common
  String get loading => isArabic ? 'جارٍ التحميل...' : 'Loading...';
  String get saving => isArabic ? 'جارٍ الحفظ...' : 'Saving...';
  String get noData => isArabic ? 'لا توجد بيانات' : 'No data';
  String get search => isArabic ? 'بحث' : 'Search';
  String get refresh => isArabic ? 'تحديث' : 'Refresh';
  String get back => isArabic ? 'رجوع' : 'Back';
  String get save => isArabic ? 'حفظ' : 'Save';
  String get cancel => isArabic ? 'إلغاء' : 'Cancel';
  String get confirm => isArabic ? 'تأكيد' : 'Confirm';
  String get close => isArabic ? 'إغلاق' : 'Close';
  String get edit => isArabic ? 'تعديل' : 'Edit';
  String get create => isArabic ? 'إنشاء' : 'Create';
  String get update => isArabic ? 'تحديث' : 'Update';
  String get delete => isArabic ? 'حذف' : 'Delete';
  String get actions => isArabic ? 'إجراءات' : 'Actions';
  String get status => isArabic ? 'الحالة' : 'Status';
  String get createdAt => isArabic ? 'تاريخ الإنشاء' : 'Created At';
  String get yes => isArabic ? 'نعم' : 'Yes';
  String get no => isArabic ? 'لا' : 'No';
  String get all => isArabic ? 'الكل' : 'All';
  String get serverUnavailable =>
      isArabic ? 'الخادم غير متاح' : 'Server unavailable';
  String get networkError =>
      isArabic ? 'خطأ في الاتصال بالشبكة' : 'Network error';
  String get sessionExpired =>
      isArabic ? 'انتهت الجلسة' : 'Session expired';
  String get permissionDenied =>
      isArabic ? 'صلاحية غير كافية' : 'Permission denied';
  String get notFound => isArabic ? 'غير موجود' : 'Not Found';
  String get errorOccurred => isArabic ? 'حدث خطأ' : 'An error occurred';
  String get id => isArabic ? 'المعرف' : 'ID';
  String get code => isArabic ? 'الكود' : 'Code';
  String get notes => isArabic ? 'ملاحظات' : 'Notes';
  String get name => isArabic ? 'الاسم' : 'Name';
  String get description => isArabic ? 'الوصف' : 'Description';
  String get email => isArabic ? 'البريد الإلكتروني' : 'Email';
  String get phone => isArabic ? 'الهاتف' : 'Phone';
  String get type => isArabic ? 'النوع' : 'Type';
  String get active => isArabic ? 'نشط' : 'Active';
  String get inactive => isArabic ? 'غير نشط' : 'Inactive';
  String get logout => isArabic ? 'تسجيل خروج' : 'Logout';
  String get notifications => isArabic ? 'الإشعارات' : 'Notifications';
  String get language => isArabic ? 'اللغة' : 'Language';
  String get start => isArabic ? 'بدء' : 'Start';
  String get complete => isArabic ? 'إكمال' : 'Complete';
  String get verify => isArabic ? 'تحقق' : 'Verify';
  String get enterBarcode => isArabic ? 'إدخال الباركود' : 'Enter barcode';

  // Auth
  String get login => isArabic ? 'تسجيل الدخول' : 'Login';
  String get loginButton => isArabic ? 'دخول' : 'Sign In';
  String get loggingIn => isArabic ? 'جارٍ تسجيل الدخول...' : 'Signing in...';
  String get welcomeBack =>
      isArabic ? 'مرحباً بعودتك' : 'Welcome back';
  String get password => isArabic ? 'كلمة المرور' : 'Password';
  String get invalidCredentials =>
      isArabic ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials';
  String get changePassword =>
      isArabic ? 'تغيير كلمة المرور' : 'Change Password';
  String get currentPassword =>
      isArabic ? 'كلمة المرور الحالية' : 'Current Password';
  String get newPassword =>
      isArabic ? 'كلمة المرور الجديدة' : 'New Password';
  String get confirmPassword =>
      isArabic ? 'تأكيد كلمة المرور' : 'Confirm Password';

  // Dashboard
  String get dashboard => isArabic ? 'لوحة التحكم' : 'Dashboard';
  String get quickLinks => isArabic ? 'روابط سريعة' : 'Quick Links';
  String get totalMachines =>
      isArabic ? 'إجمالي الآلات' : 'Total Machines';
  String get openRequests =>
      isArabic ? 'الطلبات المفتوحة' : 'Open Requests';
  String get unreadNotifications =>
      isArabic ? 'الإشعارات غير المقروءة' : 'Unread Notifications';
  String get lowStock => isArabic ? 'مخزون منخفض' : 'Low Stock';

  // Navigation
  String get home => isArabic ? 'الرئيسية' : 'Home';
  String get scanner => isArabic ? 'الماسح' : 'Scanner';
  String get machines => isArabic ? 'الآلات' : 'Machines';
  String get maintenance => isArabic ? 'الصيانة' : 'Maintenance';
  String get inventory => isArabic ? 'المخزون' : 'Inventory';
  String get profile => isArabic ? 'الملف الشخصي' : 'Profile';
  String get settings => isArabic ? 'الإعدادات' : 'Settings';
  String get sync => isArabic ? 'المزامنة' : 'Sync';

  // Scanner
  String get scanTitle => isArabic ? 'مسح ضوئي' : 'Scan';
  String get scanBarcode => isArabic ? 'مسح الباركود' : 'Scan Barcode';
  String get scanQR => isArabic ? 'مسح رمز QR' : 'Scan QR Code';
  String get manualEntry => isArabic ? 'إدخال يدوي' : 'Manual Entry';
  String get scanResult =>
      isArabic ? 'نتيجة المسح' : 'Scan Result';
  String get scanning =>
      isArabic ? 'جارٍ المسح...' : 'Scanning...';
  String get scanNotFound =>
      isArabic ? 'لم يتم العثور على العنصر' : 'Item not found';
  String get selectPurpose =>
      isArabic ? 'اختر الغرض من المسح' : 'Select scan purpose';
  String get generalLookup =>
      isArabic ? 'بحث عام' : 'General Lookup';
  String get inventoryCounting =>
      isArabic ? 'جرد المخزون' : 'Inventory Counting';
  String get machineCheck =>
      isArabic ? 'فحص آلة' : 'Machine Check';
  String get partLookup => isArabic ? 'بحث قطعة' : 'Part Lookup';

  // Machines
  String get machineDetail =>
      isArabic ? 'تفاصيل الآلة' : 'Machine Details';
  String get maintenanceLog =>
      isArabic ? 'سجل الصيانة' : 'Maintenance Log';
  String get model => isArabic ? 'الموديل' : 'Model';
  String get serialNumber =>
      isArabic ? 'الرقم التسلسلي' : 'Serial Number';
  String get manufacturer =>
      isArabic ? 'الشركة المصنعة' : 'Manufacturer';
  String get location => isArabic ? 'الموقع' : 'Location';
  String get parts => isArabic ? 'قطع الغيار' : 'Parts';
  String get documents => isArabic ? 'المستندات' : 'Documents';
  String get activity => isArabic ? 'النشاطات' : 'Activity';
  String get downtime => isArabic ? 'التوقف' : 'Downtime';

  // Maintenance
  String get createRequest =>
      isArabic ? 'إنشاء طلب صيانة' : 'Create Request';
  String get requestDetail =>
      isArabic ? 'تفاصيل الطلب' : 'Request Details';
  String get title => isArabic ? 'العنوان' : 'Title';
  String get priority => isArabic ? 'الأولوية' : 'Priority';
  String get low => isArabic ? 'منخفضة' : 'Low';
  String get medium => isArabic ? 'متوسطة' : 'Medium';
  String get high => isArabic ? 'عالية' : 'High';
  String get urgent => isArabic ? 'عاجلة' : 'Urgent';
  String get open => isArabic ? 'مفتوح' : 'Open';
  String get inProgress => isArabic ? 'قيد التنفيذ' : 'In Progress';
  String get completed => isArabic ? 'مكتمل' : 'Completed';
  String get cancelled => isArabic ? 'ملغي' : 'Cancelled';
  String get assign => isArabic ? 'تعيين' : 'Assign';
  String get assignedTo => isArabic ? 'مسند إلى' : 'Assigned To';
  String get correctivetype =>
      isArabic ? 'تصحيحية' : 'Corrective';
  String get preventiveType =>
      isArabic ? 'وقائية' : 'Preventive';
  String get inspectionType =>
      isArabic ? 'فحص' : 'Inspection';

  // Inventory
  String get inventoryCounts =>
      isArabic ? 'جرد المخزون' : 'Inventory Counts';
  String get countDetail =>
      isArabic ? 'تفاصيل الجرد' : 'Count Details';
  String get countLines => isArabic ? 'بنود الجرد' : 'Count Lines';
  String get systemQty =>
      isArabic ? 'الكمية النظامية' : 'System Qty';
  String get countedQty =>
      isArabic ? 'الكمية المعدودة' : 'Counted Qty';
  String get difference => isArabic ? 'الفرق' : 'Difference';
  String get warehouse => isArabic ? 'المستودع' : 'Warehouse';
  String get countInProgress =>
      isArabic ? 'جاري الجرد' : 'Count In Progress';
  String get draft => isArabic ? 'مسودة' : 'Draft';

  // Products
  String get productDetail =>
      isArabic ? 'تفاصيل المنتج' : 'Product Details';
  String get unit => isArabic ? 'الوحدة' : 'Unit';
  String get barcode => isArabic ? 'الباركود' : 'Barcode';
  String get minStockLabel =>
      isArabic ? 'الحد الأدنى للمخزون' : 'Min Stock';
  String get maxStockLabel =>
      isArabic ? 'الحد الأقصى للمخزون' : 'Max Stock';
  String get productBalances =>
      isArabic ? 'أرصدة المنتج' : 'Product Balances';

  // Notifications
  String get inbox => isArabic ? 'الوارد' : 'Inbox';
  String get markAllRead =>
      isArabic ? 'تحديد الكل كمقروء' : 'Mark All Read';
  String get noNotifications =>
      isArabic ? 'لا توجد إشعارات' : 'No notifications';

  // Sync
  String get syncQueue => isArabic ? 'قائمة المزامنة' : 'Sync Queue';
  String get syncAll => isArabic ? 'مزامنة الكل' : 'Sync All';
  String get syncing => isArabic ? 'جارٍ المزامنة...' : 'Syncing...';
  String get pending => isArabic ? 'قيد الانتظار' : 'Pending';
  String get failed => isArabic ? 'فشل' : 'Failed';
  String get synced => isArabic ? 'تمت المزامنة' : 'Synced';
  String get lastSync => isArabic ? 'آخر مزامنة' : 'Last Sync';
  String get offlineInfo =>
      isArabic ? 'سيتم مزامنة العمليات عند توفر الاتصال' : 'Operations will sync when online';
  String get retry => isArabic ? 'إعادة المحاولة' : 'Retry';
  String get clearSynced =>
      isArabic ? 'مسح المزامنة' : 'Clear Synced';

  // Profile
  String get profileTitle =>
      isArabic ? 'الملف الشخصي' : 'Profile';
  String get myProfile => isArabic ? 'بياناتي' : 'My Profile';
  String get myPermissions =>
      isArabic ? 'صلاحياتي' : 'My Permissions';
  String get roles => isArabic ? 'الأدوار' : 'Roles';

  // Settings
  String get settingsTitle =>
      isArabic ? 'الإعدادات' : 'Settings';
  String get appearance => isArabic ? 'المظهر' : 'Appearance';
  String get darkMode => isArabic ? 'الوضع الليلي' : 'Dark Mode';
  String get languageSetting =>
      isArabic ? 'إعدادات اللغة' : 'Language Settings';
  String get about => isArabic ? 'حول' : 'About';
  String get version => isArabic ? 'الإصدار' : 'Version';

  String get ok => isArabic ? 'موافق' : 'OK';
  String get submit => isArabic ? 'إرسال' : 'Submit';

  String get resend => isArabic ? 'إعادة إرسال' : 'Resend';
  String get notAvailable =>
      isArabic ? 'غير متاح' : 'N/A';
  String get noInternet =>
      isArabic ? 'لا يوجد اتصال بالإنترنت' : 'No internet connection';
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      locale.languageCode == 'en' || locale.languageCode == 'ar';

  @override
  Future<AppLocalizations> load(Locale locale) =>
      SynchronousFuture<AppLocalizations>(AppLocalizations(locale));

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
