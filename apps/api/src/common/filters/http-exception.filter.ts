import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Response, Request } from 'express';
import { getRequestLanguage } from '../i18n/get-request-language';
import { localizedApiError, getApiMessage } from '../i18n/api-messages';
import { ApiFieldError } from '../validation/validation-error-transformer';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const locale = getRequestLanguage(request);
    const requestId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let messageKey: string | undefined;
    let fieldErrors: ApiFieldError[] | string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const resObj = typeof res === 'object' ? res as any : { message: res };

      messageKey = resObj.messageKey;
      fieldErrors = resObj.errors;

      if (resObj.messageKey && resObj.messageKey !== resObj.message) {
        message = getApiMessage(resObj.messageKey, locale, resObj.params);
      } else if (Array.isArray(resObj.message)) {
        message = resObj.message;
      } else if (typeof resObj.message === 'string') {
        message = resObj.message;
      } else {
        message = exception.message;
      }
    } else {
      // Never leak raw unexpected errors to the client. Log server-side only.
      console.error(
        `[AllExceptionsFilter] requestId=${requestId} method=${request.method} url=${request.originalUrl}`,
        exception instanceof Error ? exception.stack || exception.message : exception,
      );
      messageKey = 'common.internalError';
      message = getApiMessage('common.internalError', locale);
    }

    const body: any = {
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      requestId,
    };

    if (messageKey) body.messageKey = messageKey;

    if (Array.isArray(fieldErrors)) {
      body.errors = fieldErrors.map((entry) => {
        if (typeof entry === 'string') {
          return { code: entry, message: getApiMessage(entry, locale) };
        }
        if (entry && typeof entry === 'object') {
          const fieldError = entry as ApiFieldError;
          const messageText = fieldError.code
            ? getApiMessage(fieldError.code, locale, fieldError.params as Record<string, string>)
            : fieldError.message;
          return {
            field: fieldError.field,
            code: fieldError.code,
            message: messageText,
            ...(fieldError.params ? { params: fieldError.params } : {}),
          };
        }
        return entry;
      });
    }

    response.status(status).json(body);
  }
}
