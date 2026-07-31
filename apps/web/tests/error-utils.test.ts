import { normalizeApiError, ErrorConfig, ApiFieldError } from '../src/lib/error-utils';

const dictionary: Record<string, string> = {
  'errors.generalError': 'An unexpected error occurred.',
  'errors.networkError': 'Network error.',
  'errors.serverError': 'Server error.',
  'errors.badRequest': 'Bad request.',
  'errors.unauthorized': 'Unauthorized.',
  'errors.notFound': 'Not found.',
  'errors.validationFailed': 'Please check the form.',
  'errorDialog.title': 'Error',
  'auth.invalidCredentials': 'Invalid credentials.',
  'validation.required': 'This field is required.',
  'validation.invalidNumber': 'Must be a valid number.',
  'validation.duplicateValue': 'Duplicate value, please choose a different one.',
  'validation.invalidReference': 'The selected reference is invalid or does not exist.',
  'organization.branchNotFound': 'Branch not found.',
  'organization.roleNotFound': 'Role not found.',
};

const t = (key: string): string => dictionary[key] ?? key;

function canonicalError(overrides: Record<string, unknown>): Error {
  const error = new Error('HTTP 400') as Error & { status?: number; details?: unknown };
  (error as any).response = { status: 400, data: { success: false, statusCode: 400, message: ['Bad request'], requestId: 'req-123', ...overrides } };
  error.status = 400;
  return error;
}

describe('normalizeApiError', () => {
  it('returns the general error for falsy input', () => {
    expect(normalizeApiError(null, t).message).toBe('An unexpected error occurred.');
  });

  it('prefers the server-localized message when a messageKey is present', () => {
    const err = canonicalError({ messageKey: 'auth.invalidCredentials', message: ['بيانات الدخول غير صحيحة'] });
    const config = normalizeApiError(err, t);
    expect(config.message).toBe('بيانات الدخول غير صحيحة');
    expect(config.messageKey).toBe('auth.invalidCredentials');
    expect(config.title).toBe('Error');
  });

  it('falls back to the web dictionary when the server message equals the raw key', () => {
    const err = canonicalError({ messageKey: 'auth.invalidCredentials', message: ['auth.invalidCredentials'] });
    expect(normalizeApiError(err, t).message).toBe('Invalid credentials.');
  });

  it('carries over the requestId', () => {
    const config = normalizeApiError(canonicalError({ messageKey: 'auth.invalidCredentials' }), t);
    expect(config.requestId).toBe('req-123');
  });

  it('maps canonical field errors with code localization', () => {
    const fieldErrors: ApiFieldError[] = [
      { field: 'name', code: 'validation.required', message: 'name should not be empty' },
      { field: 'lines.0.quantity', code: 'validation.invalidNumber', message: 'must be an integer' },
    ];
    const config = normalizeApiError(canonicalError({ messageKey: 'common.validationFailed', errors: fieldErrors }), t);
    expect(config.errors).toEqual([
      { field: 'name', code: 'validation.required', message: 'name should not be empty' },
      { field: 'lines.0.quantity', code: 'validation.invalidNumber', message: 'must be an integer' },
    ]);
  });

  it('localizes string-typed field errors through the validation namespace', () => {
    const config = normalizeApiError(canonicalError({ messageKey: 'common.validationFailed', errors: ['validation.required'] }), t);
    expect(config.errors).toEqual([{ code: 'validation.required', message: 'This field is required.' }]);
  });

  it('localizes duplicate and invalid-reference field error codes', () => {
    const fieldErrors: ApiFieldError[] = [
      { field: 'code', code: 'validation.duplicateValue', message: 'validation.duplicateValue' },
      { field: 'companyId', code: 'validation.invalidReference', message: 'Company not found' },
    ];
    const config = normalizeApiError(canonicalError({ messageKey: 'common.validationFailed', errors: fieldErrors }), t);
    expect(config.errors).toEqual([
      { field: 'code', code: 'validation.duplicateValue', message: 'Duplicate value, please choose a different one.' },
      { field: 'companyId', code: 'validation.invalidReference', message: 'Company not found' },
    ]);
  });

  it('resolves organization message keys against the web dictionary', () => {
    const err = canonicalError({ messageKey: 'organization.roleNotFound', message: ['organization.roleNotFound'] });
    const config = normalizeApiError(err, t);
    expect(config.message).toBe('Role not found.');
    expect(config.messageKey).toBe('organization.roleNotFound');
  });

  it('falls back to status-based text for unknown keys and never leaks the raw key', () => {
    const config = normalizeApiError(canonicalError({ messageKey: 'unknown.key.here', message: ['unknown.key.here'] }), t);
    expect(config.message).toBe('Bad request.');
    expect(config.message).not.toBe('unknown.key.here');
    expect(config.messageKey).toBe('unknown.key.here');
  });

  it('handles legacy axios errors without a messageKey', () => {
    const err = new Error('Request failed') as Error & { response?: unknown };
    (err as any).response = { status: 404, data: { message: 'Not found', details: 'no such company' } };
    const config = normalizeApiError(err, t);
    expect(config.message).toBe('Not found');
    expect(config.detail).toBe('no such company');
  });

  it('detects network errors', () => {
    expect(normalizeApiError(new Error('Network Error'), t).message).toBe('Network error.');
    expect(normalizeApiError(new Error('Failed to fetch'), t).message).toBe('Network error.');
  });

  it('detects aborted requests', () => {
    const err = new Error('The operation was aborted') as Error & { name: string };
    err.name = 'AbortError';
    expect(normalizeApiError(err, t).message).toBe('Network error.');
  });

  it('maps fetch-style thrown errors with status', () => {
    const err = new Error('HTTP 500: Internal Server Error') as Error & { status?: number };
    err.status = 500;
    expect(normalizeApiError(err, t).message).toBe('Server error.');
  });

  it('never renders a raw messageKey as the message', () => {
    const config = normalizeApiError(canonicalError({ messageKey: 'auth.invalidCredentials' }), t);
    expect(config.message).not.toBe('auth.invalidCredentials');
  });

  it('keeps unexpected messages only when they are user-safe', () => {
    const config = normalizeApiError(new Error('Something exploded'), t);
    expect(config.message).toBe('Something exploded');
  });
});
