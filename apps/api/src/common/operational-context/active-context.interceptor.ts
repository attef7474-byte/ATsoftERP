import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ActiveContextService } from './active-context.service';
import { OPERATIONAL_CONTEXT_OPTIONAL_KEY } from './operational-context-optional.decorator';
import { OperationalContextSelection } from './operational-context.types';

@Injectable()
export class ActiveContextInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activeContextService: ActiveContextService,
  ) {}

  async intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (executionContext.getType() !== 'http') return next.handle();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    const isOptional = this.reflector.getAllAndOverride<boolean>(
      OPERATIONAL_CONTEXT_OPTIONAL_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );
    if (isPublic || isOptional) return next.handle();

    const request = executionContext.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.sub;

    // Authentication guards execute before interceptors. A request without a
    // resolved user is either public/unguarded and is not treated as trusted.
    if (!userId) return next.handle();

    const selection = this.extractSelection(request.headers);
    if (!selection.companyId || !selection.branchId) {
      throw new ForbiddenException({
        messageKey: 'operationalContext.headersRequired',
        message: 'operationalContext.headersRequired',
      });
    }

    const activeContext = await this.activeContextService.validate(
      userId,
      selection as OperationalContextSelection,
    );
    await this.activeContextService.assertRequestMatches(
      userId,
      activeContext,
      request.body,
      request.query,
    );
    request.activeContext = activeContext;
    return next.handle();
  }

  private extractSelection(
    headers: Record<string, string | string[] | undefined>,
  ): Partial<OperationalContextSelection> {
    return {
      companyId: this.header(headers['x-active-company-id']),
      branchId: this.header(headers['x-active-branch-id']),
      administrationId:
        this.header(headers['x-active-administration-id']) || null,
      departmentId: this.header(headers['x-active-department-id']) || null,
    };
  }

  private header(value: string | string[] | undefined): string | undefined {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate?.trim() || undefined;
  }
}
