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
  'validation.duplicateValue': { ar: 'قيمة مكررة، يرجى اختيار قيمة مختلفة', en: 'Duplicate value, please choose a different one' },
  'validation.invalidReference': { ar: 'المرجع المحدد غير صالح أو غير موجود', en: 'The selected reference is invalid or does not exist' },
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
  'maintenance.taskNotFound': { ar: 'مهمة الصيانة غير موجودة', en: 'Maintenance task not found' },
  'maintenance.assignmentNotFound': { ar: 'إسناد الصيانة غير موجود', en: 'Maintenance request assignment not found' },
  'maintenance.downtimeLogNotFound': { ar: 'سجل التوقف غير موجود', en: 'Downtime log not found' },
  'maintenance.personnelNotFound': { ar: 'فرد الصيانة غير موجود', en: 'Maintenance personnel not found' },
  'maintenance.assignedUserNotFound': { ar: 'المستخدم المعين غير موجود', en: 'Assigned user not found' },
  'maintenance.componentMachineMismatch': { ar: 'المكون لا ينتمي إلى الماكينة المحددة', en: 'Component does not belong to selected machine' },
  'maintenance.productionLineNotFound': { ar: 'خط الإنتاج غير موجود', en: 'Production line not found' },
  'maintenance.productionLineMachineMismatch': { ar: 'خط الإنتاج لا يطابق ماكينة الطلب', en: 'Production line does not match machine' },
  'maintenance.operationTypeNotFound': { ar: 'نوع العملية غير موجود', en: 'Operation type not found' },
  'maintenance.costCenterNotFound': { ar: 'مركز التكلفة غير موجود', en: 'Cost center not found' },
  'maintenance.checklistExecutionNotFound': { ar: 'تنفيذ قائمة الفحص غير موجود لهذا الطلب', en: 'Checklist execution not found for this request' },
  'maintenance.checklistScheduleNotFound': { ar: 'جدول قائمة الفحص غير موجود', en: 'Checklist schedule not found' },
  'maintenance.machineRequestMismatch': { ar: 'الماكينة لا تطابق ماكينة الطلب', en: 'Machine does not match request machine' },
  'maintenance.cannotUpdateTerminalRequest': { ar: 'لا يمكن تعديل الطلبات المكتملة أو الملغاة أو المغلقة', en: 'Cannot update completed, cancelled, or closed requests' },
  'maintenance.onlyOpenCanStart': { ar: 'يمكن بدء الطلبات المفتوحة فقط', en: 'Only OPEN requests can be started' },
  'maintenance.onlyInProgressCanComplete': { ar: 'يمكن إكمال الطلبات قيد التنفيذ فقط', en: 'Only IN_PROGRESS requests can be completed' },
  'maintenance.mandatoryChecklistPending': { ar: 'لا يمكن إكمال الطلب: يوجد {count} عنصر قائمة فحص إلزامي معلق. أكمل جميع عناصر قائمة الفحص الإلزامية أولاً', en: 'Cannot complete request: {count} mandatory checklist item(s) still pending. Complete all mandatory checklist items first' },
  'maintenance.onlyCompletedCanClose': { ar: 'يمكن إغلاق الطلبات المكتملة فقط', en: 'Only COMPLETED requests can be closed' },
  'maintenance.onlyOpenInProgressCanCancel': { ar: 'يمكن إلغاء الطلبات المفتوحة أو قيد التنفيذ فقط', en: 'Only OPEN or IN_PROGRESS requests can be cancelled' },
  'maintenance.cannotAssignTerminalRequest': { ar: 'لا يمكن إسناد الطلبات المكتملة أو الملغاة أو المغلقة', en: 'Cannot assign completed, cancelled, or closed requests' },
  'maintenance.cannotDeleteInProgressRequest': { ar: 'لا يمكن حذف طلب قيد التنفيذ', en: 'Cannot delete an in-progress request' },
  'maintenance.onlyTerminalCanReopen': { ar: 'يمكن إعادة فتح الطلبات المكتملة أو الملغاة أو المغلقة فقط', en: 'Only completed, cancelled, or closed requests can be reopened' },
  'maintenance.inactiveSparePart': { ar: 'لا يمكن طلب قطعة غيار غير نشطة', en: 'Inactive spare part cannot be requested' },
  'maintenance.sparePartAlreadyAdded': { ar: 'قطعة الغيار هذه مضافة بالفعل إلى الطلب', en: 'This spare part is already added to the request' },
  'maintenance.requiredPartNotFound': { ar: 'الجزء المطلوب غير موجود', en: 'Required part not found' },
  'maintenance.cannotUpdatePartsTerminalRequest': { ar: 'لا يمكن تعديل الأجزاء على الطلبات المكتملة أو الملغاة', en: 'Cannot update parts on completed or cancelled requests' },
  'maintenance.partAlreadyCancelled': { ar: 'الجزء ملغي بالفعل', en: 'Part is already cancelled' },
  'maintenance.cannotAddTaskTerminalRequest': { ar: 'لا يمكن إضافة مهام إلى طلبات مكتملة أو ملغاة', en: 'Cannot add tasks to completed or cancelled requests' },
  'maintenance.cannotUpdateTerminalTask': { ar: 'لا يمكن تعديل المهام المكتملة أو الملغاة', en: 'Cannot update completed or cancelled tasks' },
  'maintenance.onlyPendingCanStart': { ar: 'يمكن بدء المهام المعلقة فقط', en: 'Only PENDING tasks can be started' },
  'maintenance.onlyInProgressTaskCanComplete': { ar: 'يمكن إكمال المهام قيد التنفيذ فقط', en: 'Only IN_PROGRESS tasks can be completed' },
  'maintenance.onlyPendingInProgressCanCancelTask': { ar: 'يمكن إلغاء المهام المعلقة أو قيد التنفيذ فقط', en: 'Only PENDING or IN_PROGRESS tasks can be cancelled' },
  'maintenance.cannotDeleteInProgressTask': { ar: 'لا يمكن حذف مهمة قيد التنفيذ', en: 'Cannot delete an in-progress task' },
  'maintenance.cannotAssignTerminalTask': { ar: 'لا يمكن إسناد مهام مكتملة أو ملغاة', en: 'Cannot assign completed or cancelled tasks' },
  'maintenance.activeDowntimeExists': { ar: 'يوجد سجل توقف نشط لهذه الماكينة. أغلقه قبل إنشاء سجل جديد', en: 'Machine already has an active downtime log. Close it before creating a new one' },
  'maintenance.endTimeAfterStartTime': { ar: 'يجب أن يكون وقت النهاية بعد وقت البداية', en: 'End time must be after start time' },
  'maintenance.cannotUpdateClosedCancelledDowntime': { ar: 'لا يمكن تعديل سجل توقف مغلق أو ملغي', en: 'Cannot update a closed or cancelled downtime log' },
  'maintenance.cannotUpdateCancelledDowntime': { ar: 'لا يمكن تعديل سجل توقف ملغي', en: 'Cannot update a cancelled downtime log' },
  'maintenance.cannotCloseCancelledDowntime': { ar: 'لا يمكن إغلاق سجل توقف ملغي', en: 'Cannot close a cancelled downtime log' },
  'maintenance.downtimeAlreadyClosed': { ar: 'سجل التوقف مغلق بالفعل', en: 'Downtime log is already closed' },
  'maintenance.durationMustBePositive': { ar: 'يجب أن تكون المدة موجبة', en: 'Duration must be positive' },
  'maintenance.downtimeAlreadyCancelled': { ar: 'سجل التوقف ملغي بالفعل', en: 'Downtime log is already cancelled' },
  'maintenance.cannotCancelClosedDowntime': { ar: 'لا يمكن إلغاء سجل توقف مغلق', en: 'Cannot cancel a closed downtime log' },
  'maintenance.closeOrCancelBeforeDelete': { ar: 'أغلق سجل التوقف أو ألغه قبل الحذف', en: 'Close or cancel the downtime log before deleting' },
  'maintenance.downtimeAlreadyEnded': { ar: 'سجل التوقف منتهٍ بالفعل', en: 'Downtime log is already ended' },
  'maintenance.cannotEndCancelledDowntime': { ar: 'لا يمكن إنهاء سجل توقف ملغي', en: 'Cannot end a cancelled downtime log' },
  'maintenance.rcaAlreadyCompleted': { ar: 'تحليل السبب الجذري مكتمل بالفعل', en: 'RCA is already completed' },
  'maintenance.cannotCompleteRcaCancelledDowntime': { ar: 'لا يمكن إكمال تحليل السبب الجذري لسجل توقف ملغي', en: 'Cannot complete RCA for a cancelled downtime log' },
  'maintenance.machineRequired': { ar: 'الماكينة مطلوبة', en: 'Machine is required' },
  'maintenance.machineNotFound': { ar: 'الماكينة غير موجودة', en: 'Machine not found' },
  'maintenance.machineCategoryNotFound': { ar: 'تصنيف الماكينة غير موجود', en: 'Machine category not found' },
  'maintenance.machineDocumentNotFound': { ar: 'مستند الماكينة غير موجود', en: 'Machine document not found' },
  'maintenance.machinePartNotFound': { ar: 'قطعة الماكينة غير موجودة', en: 'Machine part not found' },
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
  'organization.administrationNotFound': { ar: 'الإدارة غير موجودة', en: 'Administration not found' },
  'organization.departmentNotFound': { ar: 'القسم غير موجود', en: 'Department not found' },
  'organization.roleNotFound': { ar: 'الدور غير موجود', en: 'Role not found' },
  'organization.permissionNotFound': { ar: 'الإذن غير موجود', en: 'Permission not found' },
  'organization.userNotFound': { ar: 'المستخدم غير موجود', en: 'User not found' },
  'organization.systemRoleProtected': { ar: 'لا يمكن تعديل أو حذف دور النظام', en: 'System roles cannot be modified or deleted' },
  'organization.cannotDeleteRoleWithUsers': { ar: 'لا يمكن حذف دور مرتبط بمستخدمين. قم بإزالة المستخدمين أولاً', en: 'Cannot delete a role assigned to users. Remove the users first' },
  'organization.cannotRemoveLastSuperAdmin': { ar: 'لا يمكن إزالة آخر مستخدم بدور مدير النظام', en: 'Cannot remove the last SUPER_ADMIN user' },
  'organization.cannotDeleteAdministrationWithDepartments': { ar: 'لا يمكن حذف إدارة مرتبطة بأقسام نشطة. قم بإلغاء تنشيط الأقسام أولاً', en: 'Cannot delete an administration with active departments. Deactivate the departments first' },
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
