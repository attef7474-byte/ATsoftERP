import type { LocaleTranslations } from '../../types';

const grid: Pick<LocaleTranslations, 'grid'> = {
    grid: {
        filter: 'تصفية',
        filters: 'تصفية',
        sortAscending: 'ترتيب تصاعدي',
        sortDescending: 'ترتيب تنازلي',
        clearFilter: 'مسح التصفية',
        clearFilters: 'مسح التصفية',
        showFilters: 'إظهار التصفية',
        hideFilters: 'إخفاء التصفية',
        showColumns: 'إظهار الأعمدة',
        hideColumns: 'إخفاء الأعمدة',
        resetTable: 'إعادة تعيين الجدول',
        noRows: 'لا توجد صفوف',
        loading: 'جارٍ تحميل بيانات الجدول...',
        actions: 'إجراءات',
        selectedRow: 'الصف المحدد',
        columnMenu: 'قائمة الأعمدة',
        searchPlaceholder: 'بحث...',
        refresh: 'تحديث',
        edit: 'تعديل',
        view: 'عرض',
        delete: 'حذف',
        print: 'طباعة',
        export: 'تصدير',
        all: 'الكل',
        filterBy: 'تصفية حسب',
        noFilter: 'لا توجد تصفية',
        rowsPerPage: 'صفوف لكل صفحة',
        itemsPerPage: 'عنصر لكل صفحة',
        totalItems: 'إجمالي العناصر',
    }
};

export default grid;
