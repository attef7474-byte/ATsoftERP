import type { LocaleTranslations } from '../../types';

const productionCostCalculation: Pick<LocaleTranslations, 'productionCostCalculation'> = {
  productionCostCalculation: {
    notFound: 'Cost calculation not found',
    orderNotFound: 'Production order for the calculation scope not found',
    runNotFound: 'Production run for the calculation scope not found',
    branchScopeMismatch: 'Branch scope must match the active branch',
    invalidPeriod: 'Invalid period: start is after end',
    linkOnlyDraft: 'Transactions can only be linked to DRAFT calculations',
    transactionNotPosted: 'Only POSTED transactions can be linked',
    transactionAlreadyLinked: 'The transaction is already linked to a cost calculation',
    reviewOnlyDraft: 'Only DRAFT calculations can be reviewed',
    finalizeOnlyReview: 'Only REVIEW calculations can be finalized',
    reopenOnlyFinalized: 'Only FINALIZED calculations can be reopened',
  },
};

export default productionCostCalculation;
