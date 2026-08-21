import { BadRequestException, ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import { ApiFieldError } from '../validation/validation-error-transformer';
import { getApiMessage } from '../i18n/api-messages';

const HIER_G_API_MESSAGE_KEYS = [
  'auth.insufficientPermissions',
  'validation.assignmentOutOfRange',
  'validation.cycleDetected',
  'validation.directSupervisorOverlap',
  'validation.duplicatePrimary',
  'validation.duplicateResolution',
  'validation.foreignResolution',
  'validation.invalidBranchHierarchy',
  'validation.invalidOperation',
  'validation.invalidRange',
  'validation.invalidReference',
  'validation.invalidResolution',
  'validation.leadershipAdministrationRequired',
  'validation.leadershipDepartmentRequired',
  'validation.missingResolution',
  'validation.primaryAdministrationManagerOverlap',
  'validation.primaryDepartmentHeadOverlap',
  'validation.selfReference',
  'validation.staleTransfer',
  'organization.assignmentNotFound',
] as const;

function createHostFor(exception: unknown, locale: string) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status };
  const request = { method: 'POST', originalUrl: '/api/v1/companies' };
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ ...request, headers: { 'x-locale': locale } }),
    }),
  };
  const filter = new AllExceptionsFilter();
  filter.catch(exception, host);
  return { status, json };
}

describe('AllExceptionsFilter canonical error contract', () => {
  it('includes requestId, success=false, statusCode, and message array', () => {
    const { status, json } = createHostFor(new BadRequestException('bad'), 'en');
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(400);
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message[0]).toBe('bad');
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(10);
  });

  it('localizes messageKey-based exceptions per request locale', () => {
    const { json } = createHostFor(
      new UnauthorizedException({ messageKey: 'auth.invalidCredentials', message: 'Invalid credentials' }),
      'ar',
    );
    const body = json.mock.calls[0][0];
    expect(body.messageKey).toBe('auth.invalidCredentials');
    expect(body.message[0]).toBe('بيانات الدخول غير صحيحة');
  });

  it('localizes the validation summary message', () => {
    const { json } = createHostFor(
      new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed' }),
      'ar',
    );
    const body = json.mock.calls[0][0];
    expect(body.messageKey).toBe('common.validationFailed');
    expect(body.message[0]).toBe('فشل التحقق من صحة البيانات');
  });

  it('localizes every HIER-G transfer and supervision error key in Arabic and English', () => {
    for (const key of HIER_G_API_MESSAGE_KEYS) {
      const ar = getApiMessage(key, 'ar');
      const en = getApiMessage(key, 'en');
      expect(ar).toBeTruthy();
      expect(en).toBeTruthy();
      expect(ar).not.toBe(key);
      expect(en).not.toBe(key);
    }
  });

  it('localizes the HIER-G graph-permission denial without exposing a raw key', () => {
    const { json } = createHostFor(
      new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' }),
      'ar',
    );
    const body = json.mock.calls[0][0];
    expect(body.messageKey).toBe('auth.insufficientPermissions');
    expect(body.message[0]).toBe('صلاحيات غير كافية');
  });

  it('passes through and localizes canonical field errors', () => {
    const fieldErrors: ApiFieldError[] = [
      { field: 'name', code: 'validation.required', message: 'name should not be empty' },
      { field: 'lines.0.quantity', code: 'validation.invalidNumber', message: 'must be an integer' },
    ];
    const { json } = createHostFor(
      new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: fieldErrors }),
      'ar',
    );
    const body = json.mock.calls[0][0];
    expect(body.errors).toEqual([
      { field: 'name', code: 'validation.required', message: 'هذا الحقل مطلوب' },
      { field: 'lines.0.quantity', code: 'validation.invalidNumber', message: 'القيمة يجب أن تكون رقماً صالحاً' },
    ]);
  });

  it('converts legacy string error lists to canonical entries', () => {
    const { json } = createHostFor(
      new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: ['validation.required'] }),
      'en',
    );
    const body = json.mock.calls[0][0];
    expect(body.errors).toEqual([{ code: 'validation.required', message: 'This field is required' }]);
  });

  it('passes through params and uses them in field messages', () => {
    const fieldErrors: ApiFieldError[] = [
      { field: 'code', code: 'validation.tooShort', message: 'too short', params: { min: '3' } },
    ];
    const { json } = createHostFor(
      new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: fieldErrors }),
      'ar',
    );
    const body = json.mock.calls[0][0];
    expect(body.errors[0].params).toEqual({ min: '3' });
  });

  it('never leaks raw unexpected errors to the client', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { status, json } = createHostFor(new Error('secret database password leaked'), 'en');
    const body = json.mock.calls[0][0];
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.messageKey).toBe('common.internalError');
    expect(body.message[0]).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret database password');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('localizes unexpected errors in Arabic', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { json } = createHostFor(new Error('boom'), 'ar');
    const body = json.mock.calls[0][0];
    expect(body.message[0]).toBe('خطأ داخلي في الخادم');
    consoleSpy.mockRestore();
  });

  it('keeps messageKey on the body when present', () => {
    const { json } = createHostFor(
      new HttpException({ messageKey: 'organization.companyNotFound', message: 'Company not found' }, 404),
      'en',
    );
    const body = json.mock.calls[0][0];
    expect(body.messageKey).toBe('organization.companyNotFound');
    expect(body.message[0]).toBe('Company not found');
  });
});
