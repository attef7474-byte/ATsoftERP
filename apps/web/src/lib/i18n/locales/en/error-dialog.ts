import type { LocaleTranslations } from '../../types';

const errorDialog: Pick<LocaleTranslations, 'errorDialog'> = {
  errorDialog: {
    title: 'Error',
    dismiss: 'Dismiss',
    showDetails: 'Show Details',
    hideDetails: 'Hide Details',
    retry: 'Retry',
    close: 'Close',
    unexpectedError: 'An unexpected error occurred',
    apiErrorMessage: 'Error: {message}',
    operationFailed: 'Operation failed',
    sessionExpired: 'Session expired. Please login again.',
    serverUnavailable: 'Server unavailable. Please try again later.',
    validationErrors: 'Validation errors',
    confirmClose: 'Are you sure you want to close?',
    requestId: 'Request ID',
  },
};

export default errorDialog;
