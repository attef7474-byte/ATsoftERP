import type { LocaleTranslations } from '../../types';

const productionCostCalculation: Pick<LocaleTranslations, 'productionCostCalculation'> = {
  productionCostCalculation: {
    notFound: 'حساب التكلفة غير موجود',
    orderNotFound: 'أمر الإنتاج لنطاق الحساب غير موجود',
    runNotFound: 'تشغيلة الإنتاج لنطاق الحساب غير موجودة',
    branchScopeMismatch: 'نطاق الفرع يجب أن يطابق الفرع النشط',
    invalidPeriod: 'نطاق الفترة غير صالح: البداية بعد النهاية',
    linkOnlyDraft: 'يمكن ربط الحركات بالحسابات المسودة فقط',
    transactionNotPosted: 'يمكن ربط الحركات المرحّلة فقط',
    transactionAlreadyLinked: 'الحركة مرتبطة بحساب تكلفة بالفعل',
    reviewOnlyDraft: 'يمكن مراجعة الحسابات المسودة فقط',
    finalizeOnlyReview: 'يمكن ترحيل الحسابات قيد المراجعة فقط',
    reopenOnlyFinalized: 'يمكن إعادة فتح الحسابات المرحّلة فقط',
  },
};

export default productionCostCalculation;
