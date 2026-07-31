export type MessageKey = string;

export interface LocalizedMessage {
  messageKey: string;
  ar: string;
  en: string;
}

const messages: Record<string, { ar: string; en: string }> = {
  'common.badRequest': { ar: 'طلب غير صالح', en: 'Bad request' },
  'common.unauthorized': { ar: 'غير مصرح', en: 'Unauthorized' },
  'common.forbidden': { ar: 'وصول ممنوع', en: 'Forbidden' },
  'common.notFound': { ar: 'غير موجود', en: 'Not found' },
  'common.conflict': { ar: 'تعارض في البيانات', en: 'Conflict' },
  'common.internalError': { ar: 'خطأ داخلي في الخادم', en: 'Internal server error' },
  'common.validationFailed': { ar: 'فشل التحقق من صحة البيانات', en: 'Validation failed' },

  'auth.invalidCredentials': { ar: 'بيانات الدخول غير صحيحة', en: 'Invalid credentials' },
  'auth.userInactive': { ar: 'الحساب غير نشط', en: 'Account is inactive' },
  'auth.tokenMissing': { ar: 'رمز التوثيق مفقود', en: 'Token is missing' },
  'auth.tokenInvalid': { ar: 'رمز التوثيق غير صالح أو منتهي الصلاحية', en: 'Invalid or expired token' },
  'auth.userNotFound': { ar: 'المستخدم غير موجود أو غير نشط', en: 'User not found or inactive' },
  'auth.noUserFound': { ar: 'لا يوجد مستخدم', en: 'No user found' },
  'auth.insufficientPermissions': { ar: 'صلاحيات غير كافية', en: 'Insufficient permissions' },
  'auth.loggedOut': { ar: 'تم تسجيل الخروج بنجاح', en: 'Logged out successfully' },

  'validation.required': { ar: 'هذا الحقل مطلوب', en: 'This field is required' },
  'validation.invalidEnum': { ar: 'قيمة غير صالحة للتعداد', en: 'Invalid enum value' },
  'validation.invalidQuantity': { ar: 'الكمية غير صالحة', en: 'Invalid quantity' },
  'validation.invalidDate': { ar: 'التاريخ غير صالح', en: 'Invalid date' },
  'validation.invalidId': { ar: 'المعرف غير صالح', en: 'Invalid ID' },
  'validation.invalidValue': { ar: 'قيمة الحقل غير صالحة', en: 'Invalid field value' },
  'validation.invalidNumber': { ar: 'القيمة يجب أن تكون رقماً صالحاً', en: 'Value must be a valid number' },
  'validation.invalidEmail': { ar: 'البريد الإلكتروني غير صالح', en: 'Invalid email address' },
  'validation.invalidFormat': { ar: 'صيغة الحقل غير صالحة', en: 'Invalid field format' },
  'validation.unknownField': { ar: 'حقل غير معروف', en: 'Unknown field' },
  'validation.tooShort': { ar: 'القيمة أقصر من الحد الأدنى المسموح', en: 'Value is shorter than the allowed minimum' },
  'validation.tooLong': { ar: 'القيمة أطول من الحد الأقصى المسموح', en: 'Value is longer than the allowed maximum' },

  'numbering.sequenceNotFound': { ar: 'تسلسل الأرقام غير موجود', en: 'Number sequence not found' },
  'numbering.sequenceInactive': { ar: 'تسلسل الأرقام غير نشط', en: 'Number sequence is inactive' },
  'numbering.duplicateCode': { ar: 'رمز التسلسل مكرر', en: 'Duplicate sequence code' },
  'numbering.manualCodeNotAllowed': { ar: 'الإدخال اليدوي للكود غير مسموح', en: 'Manual code entry is not allowed' },
  'numbering.codeImmutable': { ar: 'لا يمكن تعديل الكود بعد الإنشاء', en: 'Code is immutable after creation' },
  'numbering.invalidScope': { ar: 'نطاق تسلسل الأرقام غير صالح', en: 'Invalid numbering scope' },
  'numbering.invalidResetPolicy': { ar: 'سياسة إعادة التعيين غير صالحة', en: 'Invalid reset policy' },
  'numbering.previewDoesNotConsumeNumber': { ar: 'المعاينة لا تستهلك رقماً', en: 'Preview does not consume a number' },

  'stock.insufficientBalance': { ar: 'الرصيد غير كافٍ', en: 'Insufficient balance' },
  'stock.sparePartWarehouseRequired': { ar: 'مستودع قطع الغيار مطلوب', en: 'Spare part warehouse is required' },
  'stock.productWarehouseBlocked': { ar: 'مستودع المنتجات محظور لهذه العملية', en: 'Product warehouse is blocked for this operation' },
  'stock.rawMaterialWarehouseBlocked': { ar: 'مستودع المواد الخام محظور لهذه العملية', en: 'Raw material warehouse is blocked for this operation' },
  'stock.conditionBalanceNotFound': { ar: 'رصيد الحالة غير موجود', en: 'Condition balance not found' },
  'stock.insufficientConditionBalance': { ar: 'الرصيد حسب الحالة غير كافٍ', en: 'Insufficient condition balance' },
  'stock.invalidCondition': { ar: 'حالة غير صالحة', en: 'Invalid condition' },
  'stock.invalidDirection': { ar: 'اتجاه الحركة غير صالح', en: 'Invalid movement direction' },
  'stock.conditionMovementNotFound': { ar: 'حركة الحالة غير موجودة', en: 'Condition movement not found' },
  'inventory.movementNotFound': { ar: 'حركة المخزون غير موجودة', en: 'Inventory movement not found' },
  'inventory.warehouseNotFound': { ar: 'المستودع غير موجود', en: 'Warehouse not found' },
  'inventory.productNotFound': { ar: 'المنتج غير موجود', en: 'Product not found' },

  'maintenance.requestNotFound': { ar: 'طلب الصيانة غير موجود', en: 'Maintenance request not found' },
  'maintenance.machineRequired': { ar: 'الماكينة مطلوبة', en: 'Machine is required' },
  'maintenance.machineNotFound': { ar: 'الماكينة غير موجودة', en: 'Machine not found' },
  'maintenance.componentNotFound': { ar: 'المكون غير موجود', en: 'Component not found' },
  'maintenance.sparePartNotFound': { ar: 'قطعة الغيار غير موجودة', en: 'Spare part not found' },
  'maintenance.invalidReplacementAction': { ar: 'إجراء الاستبدال غير صالح', en: 'Invalid replacement action' },
  'maintenance.removedPartRequired': { ar: 'الجزء المستبدل مطلوب', en: 'Removed part is required' },
  'maintenance.noReturnReasonRequired': { ar: 'سبب الإرجاع مطلوب', en: 'Return reason is required' },

  'installedParts.notFound': { ar: 'الجزء المثبت غير موجود', en: 'Installed part not found' },
  'installedParts.duplicateInstallation': { ar: 'تم تركيب هذا الجزء مسبقاً لطلب الصيانة هذا', en: 'Part already installed for this maintenance request' },
  'installedParts.replacementFailed': { ar: 'فشل تسجيل سجل الاستبدال', en: 'Failed to record replacement history' },

  'maintenance.repairOrderNotFound': { ar: 'أمر الإصلاح غير موجود', en: 'Repair order not found' },
  'maintenance.repairOrderAlreadyExists': { ar: 'يوجد أمر إصلاح نشط لنفس المصدر', en: 'An active repair order already exists for this source' },
  'maintenance.invalidRepairStatus': { ar: 'حالة أمر الإصلاح غير صالحة', en: 'Invalid repair order status' },
  'maintenance.invalidRepairTransition': { ar: 'لا يمكن تغيير الحالة إلى الحالة المطلوبة', en: 'Cannot transition to the requested status' },
  'maintenance.repairSourceNotFound': { ar: 'مصدر الإصلاح غير موجود', en: 'Repair source not found' },
  'maintenance.repairSourceNotRepairable': { ar: 'مصدر الإصلاح غير قابل للإصلاح', en: 'Repair source is not repairable' },
  'maintenance.repairQuantityInvalid': { ar: 'الكمية غير صالحة لأمر الإصلاح', en: 'Invalid quantity for repair order' },
  'maintenance.repairAlreadyCompleted': { ar: 'أمر الإصلاح مكتمل بالفعل', en: 'Repair order is already completed' },
  'maintenance.repairAlreadyCancelled': { ar: 'أمر الإصلاح ملغي بالفعل', en: 'Repair order is already cancelled' },
  'maintenance.repairCancelReasonRequired': { ar: 'سبب الإلغاء مطلوب', en: 'Cancel reason is required' },

  'maintenance.bomNotFound': { ar: 'قائمة المكونات غير موجودة', en: 'BOM not found' },
  'maintenance.bomCannotScopeToBothMachineAndComponent': { ar: 'لا يمكن تحديد ماكينة ومكون معاً لنفس القائمة', en: 'Cannot scope BOM to both machine and component' },
  'maintenance.bomVersionNotFound': { ar: 'إصدار قائمة المكونات غير موجود', en: 'BOM version not found' },
  'maintenance.bomItemNotFound': { ar: 'عنصر قائمة المكونات غير موجود', en: 'BOM item not found' },
  'maintenance.planNotFound': { ar: 'خطة قطع الغيار غير موجودة', en: 'Spare part plan not found' },
  'maintenance.planItemNotFound': { ar: 'عنصر خطة قطع الغيار غير موجود', en: 'Plan item not found' },
  'maintenance.cannotUpdateNonDraftPlan': { ar: 'لا يمكن تعديل الخطة خارج حالة المسودة', en: 'Cannot update plan outside DRAFT status' },
  'maintenance.cannotDeleteNonDraftPlan': { ar: 'لا يمكن حذف الخطة خارج حالة المسودة', en: 'Cannot delete plan outside DRAFT status' },
  'maintenance.invalidPlanStatusTransition': { ar: 'لا يمكن تغيير حالة الخطة إلى الحالة المطلوبة', en: 'Cannot transition plan to the requested status' },
  'maintenance.cannotModifyPlanItemsInCurrentStatus': { ar: 'لا يمكن تعديل عناصر الخطة في الحالة الحالية', en: 'Cannot modify plan items in current status' },
  'maintenance.scheduleNotFound': { ar: 'جدول الصيانة غير موجود', en: 'Schedule not found' },
  'maintenance.scheduleMachineMismatch': { ar: 'الماكينة لا تطابق جدول الصيانة', en: 'Machine does not match the schedule' },
  'maintenance.noItemsToCopy': { ar: 'لا توجد عناصر لنسخها', en: 'No items to copy' },

  'permissions.permissionDenied': { ar: 'تم رفض الإذن', en: 'Permission denied' },
  'permissions.roleRequired': { ar: 'الدور مطلوب', en: 'Role is required' },

  'organization.companyNotFound': { ar: 'الشركة غير موجودة', en: 'Company not found' },
  'organization.branchNotFound': { ar: 'الفرع غير موجود', en: 'Branch not found' },
  'organization.companyNotAllowed': { ar: 'الشركة غير مسموح بها', en: 'Company not allowed' },
  'organization.branchNotAllowed': { ar: 'الفرع غير مسموح به', en: 'Branch not allowed' },

  'operationalContext.headersRequired': { ar: 'يجب تحديد الشركة والفرع في سياق العمل النشط', en: 'Active company and branch context headers are required' },
  'operationalContext.companyRequired': { ar: 'الشركة مطلوبة لسياق العمل', en: 'Company is required for the operational context' },
  'operationalContext.branchRequired': { ar: 'الفرع مطلوب لسياق العمل', en: 'Branch is required for the operational context' },
  'operationalContext.notAllowed': { ar: 'سياق العمل المحدد غير مسموح لهذا المستخدم', en: 'The selected operational context is not allowed for this user' },
  'operationalContext.invalidRelationship': { ar: 'علاقة الشركة أو الفرع أو الإدارة أو القسم غير صالحة', en: 'The company, branch, administration, or department relationship is invalid' },
  'operationalContext.companyMismatch': { ar: 'الشركة في الطلب لا تطابق سياق العمل النشط', en: 'The request company does not match the active operational context' },
  'operationalContext.branchMismatch': { ar: 'الفرع في الطلب لا يطابق سياق العمل النشط', en: 'The request branch does not match the active operational context' },
  'operationalContext.administrationMismatch': { ar: 'الإدارة في الطلب لا تطابق سياق العمل النشط', en: 'The request administration does not match the active operational context' },
  'operationalContext.departmentMismatch': { ar: 'القسم في الطلب لا يطابق سياق العمل النشط', en: 'The request department does not match the active operational context' },
};

export function getApiMessage(key: string, locale: string, params?: Record<string, string>): string {
  const safeLocale = locale?.toLowerCase().startsWith('en') ? 'en' : 'ar';
  const entry = messages[key];
  if (!entry) return key;
  let msg = entry[safeLocale] || entry['ar'] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(`{${k}}`, v);
    }
  }
  return msg;
}

export function getApiMessageEntry(key: string): { ar: string; en: string } | undefined {
  return messages[key];
}

export function localizedApiError(key: string, locale: string, statusCode: number = 400, error?: string, params?: Record<string, string>) {
  const entry = messages[key];
  const message = getApiMessage(key, locale, params);
  return {
    statusCode,
    messageKey: key,
    message,
    ...(error ? { error } : {}),
  };
}
