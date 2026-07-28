import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { getRequestLanguage } from '../i18n/get-request-language';
import { localizedApiError, getApiMessage } from '../i18n/api-messages';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const locale = getRequestLanguage(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let messageKey: string | undefined;
    let validationErrors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const resObj = typeof res === 'object' ? res as any : { message: res };

      messageKey = resObj.messageKey;
      validationErrors = resObj.errors;

      if (resObj.messageKey && resObj.messageKey !== resObj.message) {
        message = getApiMessage(resObj.messageKey, locale);
      } else {
        message = Array.isArray(resObj.message) ? resObj.message[0] : (typeof resObj.message === 'string' ? resObj.message : exception.message);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: any = {
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
    };

    if (messageKey) body.messageKey = messageKey;
    if (validationErrors) body.errors = validationErrors;

    response.status(status).json(body);
  }
}
