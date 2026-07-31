import type { LocaleTranslations } from '../../types';

const organization: Pick<LocaleTranslations, 'organization'> = {
    organization: {
        companyNotFound: 'الشركة غير موجودة.',
        branchNotFound: 'الفرع غير موجود.',
        administrationNotFound: 'الإدارة غير موجودة.',
        departmentNotFound: 'القسم غير موجود.',
        roleNotFound: 'الدور غير موجود.',
        permissionNotFound: 'الإذن غير موجود.',
        userNotFound: 'المستخدم غير موجود.',
        systemRoleProtected: 'لا يمكن تعديل أو حذف دور النظام.',
        cannotDeleteRoleWithUsers: 'لا يمكن حذف دور مرتبط بمستخدمين. قم بإزالة المستخدمين أولاً.',
        cannotRemoveLastSuperAdmin: 'لا يمكن إزالة آخر مستخدم بدور مدير النظام.',
        cannotDeleteAdministrationWithDepartments: 'لا يمكن حذف إدارة مرتبطة بأقسام نشطة. قم بإلغاء تنشيط الأقسام أولاً.',
        companyNotAllowed: 'الشركة غير مسموح بها.',
        branchNotAllowed: 'الفرع غير مسموح به.',
    },
};

export default organization;
