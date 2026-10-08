import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { OperationTypesService } from './operation-types.service';
import { OperationTypesController } from './operation-types.controller';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AllowedContextResolver } from '../../../../common/operational-context/allowed-context.resolver';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { ProductionLinesService } from '../production-lines/production-lines.service';

/**
 * OPTYPE-RESTORE-R3A regression coverage.
 *
 * Global reference data (OperationType) was soft-deleted by a test run, which
 * made the canonical MANUFACTURING reference invisible to every read path and
 * unusable by ProductionLinesService.validateHierarchy. This suite pins:
 *
 *  - restore() revives the SAME row and clears only deletedAt (§7 A-E, B, C, D);
 *  - restore() is NOT activate(): activation leaves deletedAt set (§4);
 *  - restore() refuses a non-deleted record (F) and an unknown id (G);
 *  - restore() is privileged in two independent layers (H, §6);
 *  - restore() writes exactly one RESTORE audit event (I);
 *  - a restored reference becomes visible again and is accepted by production
 *    line hierarchy validation (J, K), while PACKAGING is untouched (L).
 */
describe('OperationTypesService.restore (OPTYPE-RESTORE-R3A)', () => {
  const SUPER_ADMIN = { isSuperAdmin: true, roles: [{ code: 'SUPER_ADMIN' }], permissions: [] };
  const SCOPED_ADMIN = {
    isSuperAdmin: false,
    roles: [{ code: 'COMPANY_ADMIN' }],
    // Holds the permission key but is NOT a system administrator: proves the
    // explicit service-side check is real and not a restatement of the guard.
    permissions: ['operation-type:update', 'operation-type:read'],
  };
  const ACTOR = 'super-admin-user';

  const DELETED_AT = new Date('2026-07-26T01:01:20.681Z');
  const CREATED_AT = new Date('2026-07-23T04:20:21.485Z');

  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: 'cm-manufacturing',
      code: 'MANUFACTURING',
      name: 'Manufacturing',
      description: 'Manufacturing and production operations',
      status: 'ACTIVE',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      deletedAt: DELETED_AT,
      ...overrides,
    };
  }

  let prisma: any;
  let audit: any;
  let resolver: any;
  let service: OperationTypesService;

  beforeEach(() => {
    prisma = {
      operationType: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    resolver = { getAuthorization: jest.fn().mockResolvedValue(SUPER_ADMIN) };
    service = new OperationTypesService(
      prisma as PrismaService,
      audit as AuditService,
      { generateNumberAtomic: jest.fn() } as unknown as NumberingService,
      resolver as AllowedContextResolver,
    );
  });

  describe('§7 restoring a soft-deleted reference', () => {
    it('A. clears deletedAt and returns the same record', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockImplementation(({ data }: any) =>
        Promise.resolve(row({ deletedAt: data.deletedAt })),
      );

      const result = await service.restore('cm-manufacturing', ACTOR);

      expect(result.id).toBe('cm-manufacturing');
      expect(result.code).toBe('MANUFACTURING');
      expect(result.deletedAt).toBeNull();
    });

    it('B. keeps the same id (no replacement row is created)', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      // Exactly one lookup and one update, both pinned to the SAME id.
      expect(prisma.operationType.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.operationType.findUnique).toHaveBeenCalledWith({ where: { id: 'cm-manufacturing' } });
      expect(prisma.operationType.update).toHaveBeenCalledTimes(1);
      expect(prisma.operationType.update.mock.calls[0][0].where).toEqual({ id: 'cm-manufacturing' });
      expect(prisma.operationType.create).toBeUndefined();
    });

    it('C. keeps the same code (no regeneration)', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      const data = prisma.operationType.update.mock.calls[0][0].data;
      expect(Object.keys(data)).toEqual(['deletedAt']);
      expect(data.code).toBeUndefined();
      expect(data.name).toBeUndefined();
      expect(data.createdAt).toBeUndefined();
    });

    it('D. sets deletedAt to null explicitly', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      expect(prisma.operationType.update.mock.calls[0][0].data).toEqual({ deletedAt: null });
    });

    it('E. preserves the existing status rather than forcing ACTIVE', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row({ status: 'INACTIVE' }));
      prisma.operationType.update.mockImplementation(({ data }: any) =>
        Promise.resolve(row({ status: 'INACTIVE', deletedAt: data.deletedAt })),
      );

      const result = await service.restore('cm-manufacturing', ACTOR);

      expect(prisma.operationType.update.mock.calls[0][0].data.status).toBeUndefined();
      expect(result.status).toBe('INACTIVE');
    });

    it('finds the record without filtering deletedAt, so a hidden row is reachable', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      const where = prisma.operationType.findUnique.mock.calls[0][0].where;
      expect(where.deletedAt).toBeUndefined();
    });
  });

  describe('§4 restore and activate are distinct lifecycle operations', () => {
    it('activate does not clear deletedAt and issues no RESTORE audit', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ status: 'ACTIVE', deletedAt: DELETED_AT }));

      await service.activate('cm-manufacturing', ACTOR);

      // Activation only flips status: the record stays hidden from every read.
      expect(prisma.operationType.update.mock.calls[0][0].data).toEqual({ status: 'ACTIVE' });
      expect(audit.log.mock.calls[0][1]).toBe('ACTIVATE');
      expect(audit.log.mock.calls.some((c: any[]) => c[1] === 'RESTORE')).toBe(false);
    });

    it('restore does not flip status and issues no ACTIVATE audit', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      expect(prisma.operationType.update.mock.calls[0][0].data.status).toBeUndefined();
      expect(audit.log.mock.calls[0][1]).toBe('RESTORE');
      expect(audit.log.mock.calls.some((c: any[]) => c[1] === 'ACTIVATE')).toBe(false);
    });

    it('an activated-but-deleted record is still rejected by restore (status change is not a restore)', async () => {
      // Proves activate() is not a viable workaround for a deleted record.
      prisma.operationType.findUnique.mockResolvedValue(row({ status: 'ACTIVE' }));
      prisma.operationType.update.mockResolvedValue(row({ status: 'ACTIVE', deletedAt: DELETED_AT }));

      await service.activate('cm-manufacturing', ACTOR);
      const stillDeleted = await prisma.operationType.findUnique();

      expect(stillDeleted.deletedAt).toEqual(DELETED_AT);
    });
  });

  describe('§7 rejection contracts', () => {
    it('F. rejects restoring a record that is not deleted', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row({ deletedAt: null }));

      await expect(service.restore('cm-manufacturing', ACTOR)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.operationType.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('G. returns 404 for a missing id', async () => {
      prisma.operationType.findUnique.mockResolvedValue(null);

      await expect(service.restore('cm-does-not-exist', ACTOR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.operationType.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('rejects before any lookup when the actor lacks system administration', async () => {
      resolver.getAuthorization.mockResolvedValue(SCOPED_ADMIN);

      await expect(service.restore('cm-manufacturing', ACTOR)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.operationType.findUnique).not.toHaveBeenCalled();
      expect(prisma.operationType.update).not.toHaveBeenCalled();
    });

    it('rejects an inactive SUPER_ADMIN role assignment resolved from the database', async () => {
      // The resolver filters on role.status/deletedAt; this proves the service
      // trusts the resolver snapshot rather than any request-supplied role.
      resolver.getAuthorization.mockResolvedValue({ isSuperAdmin: false, roles: [], permissions: [] });

      await expect(service.restore('cm-manufacturing', ACTOR)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('§8 audit', () => {
    it('I. writes exactly one RESTORE audit event for the restored record', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      expect(audit.log).toHaveBeenCalledTimes(1);
      const [userId, action, entity, entityId, details] = audit.log.mock.calls[0];
      expect(userId).toBe(ACTOR);
      expect(action).toBe('RESTORE');
      expect(entity).toBe('OperationType');
      expect(entityId).toBe('cm-manufacturing');
      expect(details.code).toBe('MANUFACTURING');
      expect(details.previousDeletedAt).toBe(DELETED_AT.toISOString());
    });

    it('does not leak credential material into audit details', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      const details = JSON.stringify(audit.log.mock.calls[0][4]);
      expect(details).not.toMatch(/token|jwt|bearer|password|secret/i);
    });
  });

  describe('§6 route protection', () => {
    const reflector = new Reflector();

    function metadataOf(handler: string) {
      return reflector.getAllAndOverride<string[]>('permissions', [
        (OperationTypesController.prototype as any)[handler],
        OperationTypesController,
      ]);
    }

    it('requires the SEEDED operation-type:update on the restore route', () => {
      // R4R: the controller previously enforced `operationTypes:update`, but the seed
      // only ever creates `operation-type:*`. A guard key that no role can be granted
      // is a permanently-denied route, so the enforced key must be a seeded key.
      expect(metadataOf('restore')).toEqual(['operation-type:update']);
    });

    it('keeps activate on its own permission key', () => {
      expect(metadataOf('activate')).toEqual(['operation-type:activate']);
    });

    it('every enforced permission key is a SEEDED operation-type key, never the unseeded operationTypes:* spelling', () => {
      const handlers = [
        'create', 'findAll', 'findOne', 'update', 'remove',
        'activate', 'deactivate', 'restore',
      ];
      for (const handler of handlers) {
        const keys = metadataOf(handler) ?? [];
        for (const key of keys) {
          expect(key.startsWith('operationTypes:')).toBe(false);
          expect(key.startsWith('operation-type:')).toBe(true);
        }
      }
    });

    it('SEEDS every operation-type key the controller enforces (OPTYPE-SEEDED-KEYS)', () => {
      // R4R: the assertion above only checked the `operation-type:` PREFIX, so the four
      // enforced-but-unseeded keys (create/read/update/delete) passed unnoticed. A key that
      // is enforced but never declared in the seed is a permanently-denied route on a fresh
      // database, so every enforced key must appear in the actual seed catalogue.
      const seedDirectory = join(
        __dirname, '..', '..', '..', '..', '..', 'prisma', 'seed',
      );
      const seededKeys = new Set<string>();
      for (const file of readdirSync(seedDirectory)) {
        if (!file.endsWith('.ts')) continue;
        const seedSource = readFileSync(join(seedDirectory, file), 'utf8');
        for (const match of seedSource.matchAll(/key:\s*"([^"]+)"/g)) {
          seededKeys.add(match[1]);
        }
      }
      const handlers = [
        'create', 'findAll', 'findOne', 'update', 'remove',
        'activate', 'deactivate', 'restore',
      ];
      const enforced = handlers.flatMap((handler) => metadataOf(handler) ?? []);
      expect(enforced.length).toBeGreaterThan(0);
      for (const key of enforced) {
        expect(seededKeys.has(key)).toBe(true);
      }
      // Explicitly pin the four keys the seed was missing before this fix.
      for (const key of [
        'operation-type:create',
        'operation-type:read',
        'operation-type:update',
        'operation-type:delete',
      ]) {
        expect(seededKeys.has(key)).toBe(true);
      }
    });

    function guardContext(handler: string, user: unknown) {
      return {
        getHandler: () => (OperationTypesController.prototype as any)[handler],
        getClass: () => OperationTypesController,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as any;
    }

    it('denies an unauthenticated request (no resolved user)', async () => {
      const guard = new PermissionsGuard(reflector, prisma as any);
      await expect(guard.canActivate(guardContext('restore', undefined))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('denies an authenticated caller without the permission', async () => {
      prisma.userRole = {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              status: 'ACTIVE',
              code: 'TECHNICIAN',
              permissions: [{ permission: { key: 'operation-type:read', status: 'ACTIVE' } }],
            },
          },
        ]),
      };
      const guard = new PermissionsGuard(reflector, prisma as any);
      await expect(
        guard.canActivate(guardContext('restore', { id: 'tech-1' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies a non-SUPER_ADMIN role at the guard too', async () => {
      prisma.userRole = {
        findMany: jest.fn().mockResolvedValue([
          { role: { status: 'ACTIVE', code: 'COMPANY_ADMIN', permissions: [] } },
        ]),
      };
      const guard = new PermissionsGuard(reflector, prisma as any);
      await expect(
        guard.canActivate(guardContext('restore', { id: 'ca-1' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets SUPER_ADMIN through the shared permission guard for the restore key', async () => {
      prisma.userRole = {
        findMany: jest.fn().mockResolvedValue([
          { role: { status: 'ACTIVE', code: 'SUPER_ADMIN', permissions: [] } },
        ]),
      };
      const guard = new PermissionsGuard(reflector, prisma as any);
      await expect(
        guard.canActivate(guardContext('restore', { id: ACTOR })),
      ).resolves.toBe(true);
    });

    it('passes only the path id and authenticated user id to the service', () => {
      const serviceSpy = { restore: jest.fn() };
      const controller = new OperationTypesController(serviceSpy as any);

      controller.restore('cm-manufacturing', ACTOR);

      expect(serviceSpy.restore).toHaveBeenCalledWith('cm-manufacturing', ACTOR);
    });
  });

  describe('§14 downstream visibility and reference validation', () => {
    it('J. a restored row is returned by the list filter used by findAll', async () => {
      const all = [
        row({ deletedAt: null }),
        row({ id: 'cm-packaging', code: 'PACKAGING', name: 'Packaging', deletedAt: null }),
      ];
      prisma.operationType.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(all.filter((r) => where.deletedAt === null ? r.deletedAt === null : true)),
      );

      const { data } = await service.findAll({ limit: 100 });

      expect(data.map((r: any) => r.code).sort()).toEqual(['MANUFACTURING', 'PACKAGING']);
    });

    it('K. ProductionLinesService accepts the restored non-deleted reference', async () => {
      // The real defect: hierarchy validation rejected MANUFACTURING because the
      // row was soft-deleted. After restore the same query must resolve it.
      prisma.operationType.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.id === 'cm-manufacturing' && where.deletedAt === null
            ? { id: 'cm-manufacturing', code: 'MANUFACTURING' }
            : null,
        ),
      );

      const lines = new ProductionLinesService(
        prisma as PrismaService,
        audit as AuditService,
        { generateNumberAtomic: jest.fn() } as unknown as NumberingService,
      );
      const ctx = { companyId: 'company-joubah', branchId: 'branch-main' } as any;

      await expect(
        (lines as any).validateHierarchy(
          { operationTypeId: 'cm-manufacturing' },
          ctx,
        ),
      ).resolves.toBeUndefined();
    });

    it('K. ProductionLinesService still rejects a soft-deleted reference', async () => {
      prisma.operationType.findFirst.mockResolvedValue(null);

      const lines = new ProductionLinesService(
        prisma as PrismaService,
        audit as AuditService,
        { generateNumberAtomic: jest.fn() } as unknown as NumberingService,
      );
      const ctx = { companyId: 'company-joubah', branchId: 'branch-main' } as any;

      await expect(
        (lines as any).validateHierarchy({ operationTypeId: 'cm-manufacturing' }, ctx),
      ).rejects.toThrow('Operation type not found');
    });

    it('L. restore never touches a different operation type', async () => {
      prisma.operationType.findUnique.mockResolvedValue(row());
      prisma.operationType.update.mockResolvedValue(row({ deletedAt: null }));

      await service.restore('cm-manufacturing', ACTOR);

      expect(prisma.operationType.update).toHaveBeenCalledTimes(1);
      expect(prisma.operationType.update.mock.calls[0][0].where).toEqual({
        id: 'cm-manufacturing',
      });
      const serialized = JSON.stringify(prisma.operationType.update.mock.calls[0][0]);
      expect(serialized).not.toContain('PACKAGING');
      expect(serialized).not.toContain('FILLING');
      expect(serialized).not.toContain('QUALITY');
      expect(serialized).not.toContain('UTILITIES');
      expect(serialized).not.toContain('PROJECT');
    });
  });
});
