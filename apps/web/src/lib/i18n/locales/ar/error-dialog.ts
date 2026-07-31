import type { LocaleTranslations } from '../../types';

const errorDialog: Pick<LocaleTranslations, 'errorDialog'> = {
  errorDialog: {
    title: 'خطأ',
    dismiss: 'تجاهل',
    showDetails: 'عرض التفاصيل',
    hideDetails: 'إخفاء التفاصيل',
    retry: 'إعادة المحاولة',
    close: 'إغلاق',
    unexpectedError: 'حدث خطأ غير متوقع',
    apiErrorMessage: 'خطأ: {message}',
    operationFailed: 'فشلت العملية',
    sessionExpired: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.',
    serverUnavailable: 'الخادم غير متاح. يرجى المحاولة لاحقاً.',
    validationErrors: 'أخطاء التحقق',
    confirmClose: 'هل أنت متأكد من الإغلاق؟',
    requestId: 'معرف الطلب',
  },
};

export default errorDialog;
