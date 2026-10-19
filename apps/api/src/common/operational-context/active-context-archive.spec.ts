import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActiveContextInterceptor } from './active-context.interceptor';
import { ActiveContextService } from './active-context.service';
import {
  ARCHIVE_READ_PERMISSION,
  ARCHIVE_READABLE_KEY,
  ARCHIVED_CONTEXT_MODE_HEADER,
  ARCHIVED_CONTEXT_MODE_VALUE,
} from './archive-context.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPERATIONAL_CONTEXT_OPTIONAL_KEY } from './operational-context-optional.decorator';
import type { ActiveOperationalContext, ArchivedOperationalContext } from './operational-context.types';

const ARCHIVED_CONTEXT: ArchivedOperationalContext = {
  contextKey: 'company_1:branch_1:-:-',
  scopeId: null,
  companyId: 'company_1',
  companyName: 'Test Company',
  companyCode: 'DEFAULT',
  branchId: 'branch_1',
  branchName: 'Headquarters',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: false,
  source: 'SUPER_ADMIN',
  isArchived: true,
  archivedAncestors: [
    {
      level: 'company',
      id: 'company_1',
      code: 'DEFAULT',
      name: 'Test Company',
      deletedAt: '2026-09-29T01:49:30.991Z',
    },
  ],
};

const ACTIVE_CONTEXT = { ...ARCHIVED_CONTEXT, isDefault: true } as unknown as ActiveOperationalContext;

function createRequest(over: Partial<Record<string, unknown>> = {}) {
  return {
    method: (over.method as string | undefined) ?? 'GET',
    headers: {
      'x-active-company-id': 'company_1',
      'x-active-branch-id': 'branch_1',
      ...(over.headers as Record<string, string> | undefined),
    },
    user: { id: 'user_1' },
    body: {},
    query: {},
  } as Record<string, unknown> & { headers: Record<string, string> };
}

function createInterceptor(options: {
  request: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  archiveResult?: unknown;
}) {
  const metadata = options.metadata ?? {};
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
  const service = {
    validate: jest.fn().mockResolvedValue(ACTIVE_CONTEXT),
    validateArchived: jest.fn().mockResolvedValue(
      options.archiveResult ?? {
        context: ARCHIVED_CONTEXT,
        authorization: {
          roles: [],
          permissions: [ARCHIVE_READ_PERMISSION],
          isSuperAdmin: false,
        },
      },
    ),
    assertRequestMatches: jest.fn().mockResolvedValue(undefined),
  };
  const interceptor = new ActiveContextInterceptor(reflector, service as unknown as ActiveContextService);
  const executionContext = {
    getType: () => 'http',
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => options.request }),
  } as unknown as ExecutionContext;
  const next = { handle: jest.fn().mockReturnValue('handled') };
  return { interceptor, service, executionContext, next };
}

async function rejectionKey(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    const response = (error as ForbiddenException).getResponse();
    return typeof response === 'string' ? response : (response as { messageKey: string }).messageKey;
  }
  throw new Error('expected the request to be rejected');
}

describe('ActiveContextInterceptor archive mode', () => {
  it('allows GET reads in archived mode and marks the request as archived', async () => {
    const request = createRequest({
      headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE },
    });
    const { interceptor, service, executionContext, next } = createInterceptor({ request });

    await interceptor.intercept(executionContext, next as never);

    expect(service.validateArchived).toHaveBeenCalledTimes(1);
    expect(service.validate).not.toHaveBeenCalled();
    expect(request.activeContextMode).toBe('archived');
    expect(request.activeContext).toEqual(ARCHIVED_CONTEXT);
    expect(next.handle).toHaveBeenCalled();
  });

  it('rejects POST mutations in archived mode with archiveContext.readOnly', async () => {
    const request = createRequest({
      method: 'POST',
      headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE },
    });
    const { interceptor, service, executionContext, next } = createInterceptor({ request });

    await expect(rejectionKey(interceptor.intercept(executionContext, next as never))).resolves.toBe(
      'archiveContext.readOnly',
    );
    expect(service.assertRequestMatches).not.toHaveBeenCalled();
    expect(next.handle).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects %s in archived mode unless the handler is explicitly archive-readable',
    async (method) => {
      const request = createRequest({
        method,
        headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE },
      });
      const { interceptor, executionContext, next } = createInterceptor({ request });

      await expect(
        rejectionKey(interceptor.intercept(executionContext, next as never)),
      ).resolves.toBe('archiveContext.readOnly');
    },
  );

  it('allows an explicitly archive-readable POST (audited read-only export)', async () => {
    const request = createRequest({
      method: 'POST',
      headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE },
    });
    const { interceptor, service, executionContext, next } = createInterceptor({
      request,
      metadata: { [ARCHIVE_READABLE_KEY]: true },
    });

    await interceptor.intercept(executionContext, next as never);

    expect(request.activeContextMode).toBe('archived');
    expect(service.assertRequestMatches).toHaveBeenCalledWith(
      'user_1',
      ARCHIVED_CONTEXT,
      request.body,
      request.query,
      'archived',
    );
    expect(next.handle).toHaveBeenCalled();
  });

  it('rejects archived browsing without the archive permission for non super admin principals', async () => {
    const request = createRequest({
      headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE },
    });
    const { interceptor, executionContext, next } = createInterceptor({
      request,
      archiveResult: {
        context: ARCHIVED_CONTEXT,
        authorization: { roles: [], permissions: [], isSuperAdmin: false },
      },
    });

    await expect(rejectionKey(interceptor.intercept(executionContext, next as never))).resolves.toBe(
      'archiveContext.permissionRequired',
    );
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('allows SUPER_ADMIN to browse archives without the explicit permission key', async () => {
    const request = createRequest({
      headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE },
    });
    const { interceptor, executionContext, next } = createInterceptor({
      request,
      archiveResult: {
        context: ARCHIVED_CONTEXT,
        authorization: { roles: [], permissions: [], isSuperAdmin: true },
      },
    });

    await interceptor.intercept(executionContext, next as never);

    expect(next.handle).toHaveBeenCalled();
  });

  it('keeps the active path byte-for-byte unchanged when the mode header is absent', async () => {
    const request = createRequest();
    const { interceptor, service, executionContext, next } = createInterceptor({ request });

    await interceptor.intercept(executionContext, next as never);

    expect(service.validateArchived).not.toHaveBeenCalled();
    expect(service.validate).toHaveBeenCalledTimes(1);
    expect(service.assertRequestMatches).toHaveBeenCalledWith(
      'user_1',
      ACTIVE_CONTEXT,
      request.body,
      request.query,
    );
    expect(request.activeContextMode).toBe('active');
  });

  it('ignores an unknown mode header value and stays on the active path', async () => {
    const request = createRequest({
      headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: 'weird' },
    });
    const { interceptor, service, executionContext, next } = createInterceptor({ request });

    await interceptor.intercept(executionContext, next as never);

    expect(service.validateArchived).not.toHaveBeenCalled();
    expect(service.validate).toHaveBeenCalledTimes(1);
  });

  it('skips public and operational-context-optional handlers entirely', async () => {
    for (const key of [IS_PUBLIC_KEY, OPERATIONAL_CONTEXT_OPTIONAL_KEY]) {
      const request = createRequest({
        method: 'POST',
        headers: { [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE },
      });
      const { interceptor, service, executionContext, next } = createInterceptor({
        request,
        metadata: { [key]: true },
      });

      await interceptor.intercept(executionContext, next as never);

      expect(service.validateArchived).not.toHaveBeenCalled();
      expect(next.handle).toHaveBeenCalled();
    }
  });

  it('still requires company and branch headers in archived mode', async () => {
    const request = createRequest({ headers: { 'x-active-company-id': '' } });
    const { interceptor, executionContext, next } = createInterceptor({ request });

    await expect(rejectionKey(interceptor.intercept(executionContext, next as never))).resolves.toBe(
      'operationalContext.headersRequired',
    );
  });
});
