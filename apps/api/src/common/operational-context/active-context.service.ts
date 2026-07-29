import { ForbiddenException, Injectable } from '@nestjs/common';
import { ActiveContextValidator } from './active-context.validator';
import { AllowedContextResolver } from './allowed-context.resolver';
import {
  ActiveOperationalContext,
  OperationalContextSelection,
  OperationalContextsResult,
  UserAuthorizationSnapshot,
} from './operational-context.types';

const CONTEXT_FIELDS = [
  'companyId',
  'branchId',
  'administrationId',
  'departmentId',
] as const;

type ContextField = (typeof CONTEXT_FIELDS)[number];

@Injectable()
export class ActiveContextService {
  constructor(
    private readonly resolver: AllowedContextResolver,
    private readonly validator: ActiveContextValidator,
  ) {}

  getAllowedContexts(userId: string): Promise<OperationalContextsResult> {
    return this.resolver.getContexts(userId);
  }

  getAuthorization(userId: string): Promise<UserAuthorizationSnapshot> {
    return this.resolver.getAuthorization(userId);
  }

  validate(
    userId: string,
    selection: OperationalContextSelection,
  ): Promise<ActiveOperationalContext> {
    return this.validator.validate(userId, selection);
  }

  async assertRequestMatches(
    userId: string,
    activeContext: ActiveOperationalContext,
    body: unknown,
    query: unknown,
  ): Promise<void> {
    for (const container of [body, query]) {
      if (!this.isRecord(container)) continue;

      const values = this.contextValues(container);
      this.assertExact(
        'companyId',
        values.companyId,
        activeContext.companyId,
      );
      this.assertExact('branchId', values.branchId, activeContext.branchId);

      if (
        values.administrationId &&
        activeContext.administrationId &&
        values.administrationId !== activeContext.administrationId
      ) {
        this.reject('operationalContext.administrationMismatch');
      }
      if (
        values.departmentId &&
        activeContext.departmentId &&
        values.departmentId !== activeContext.departmentId
      ) {
        this.reject('operationalContext.departmentMismatch');
      }

      if (
        (values.administrationId && !activeContext.administrationId) ||
        (values.departmentId && !activeContext.departmentId)
      ) {
        await this.validator.validate(userId, {
          companyId: activeContext.companyId,
          branchId: activeContext.branchId,
          administrationId:
            values.administrationId || activeContext.administrationId,
          departmentId: values.departmentId || activeContext.departmentId,
        });
      }
    }
  }

  private contextValues(
    value: Record<string, unknown>,
  ): Partial<Record<ContextField, string>> {
    const result: Partial<Record<ContextField, string>> = {};
    for (const field of CONTEXT_FIELDS) {
      const normalized = this.normalizeValue(value[field]);
      if (normalized) result[field] = normalized;
    }
    return result;
  }

  private assertExact(
    field: 'companyId' | 'branchId',
    actual: string | undefined,
    expected: string,
  ): void {
    if (actual && actual !== expected) {
      this.reject(
        field === 'companyId'
          ? 'operationalContext.companyMismatch'
          : 'operationalContext.branchMismatch',
      );
    }
  }

  private normalizeValue(value: unknown): string | undefined {
    const candidate = Array.isArray(value) ? value[0] : value;
    if (typeof candidate !== 'string') return undefined;
    const normalized = candidate.trim();
    if (
      !normalized ||
      normalized === 'undefined' ||
      normalized === 'null'
    ) {
      return undefined;
    }
    return normalized;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private reject(messageKey: string): never {
    throw new ForbiddenException({
      messageKey,
      message: messageKey,
    });
  }
}
