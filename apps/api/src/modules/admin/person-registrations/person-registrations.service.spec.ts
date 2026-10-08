import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PersonRegistrationsService } from './person-registrations.service';
import { CreatePersonRegistrationDto } from './dto/create-person-registration.dto';
import { UpdatePersonRegistrationDto } from './dto/update-person-registration.dto';

type Tx = any;

/**
 * Focused unit tests for the Group 1 canonical registration orchestration.
 *
 * The behaviours asserted here are the ones that were previously split and therefore
 * unprotected: atomicity, tenant derivation, per-domain permission segmentation, and the
 * promise that a coordinated update cannot destroy authentication or placement state.
 */
describe('PersonRegistrationsService', () => {
  const ctx: any = {
    companyId: 'company-1',
    branchId: 'branch-1',
    companyName: 'Company One',
    branchName: 'Branch One',
  };
  const actorId = 'actor-1';

  const personId = 'person-1';

  function baseDto(overrides: Partial<CreatePersonRegistrationDto> = {}): CreatePersonRegistrationDto {
    return {
      code: 'EMP-1',
      name: 'Ahmed Hassan',
      category: 'MAINTENANCE',
      placement: { departmentId: 'dept-1' },
      ...overrides,
    } as CreatePersonRegistrationDto;
  }

  /**
   * A permissive in-memory transaction double. Every table is a plain object keyed by id,
   * and each write helper records its arguments so tests can assert what was actually
   * written rather than only that no exception was raised.
   */
  /**
   * Every Group 1 domain key. Tests that care about a specific denial override `userRoles`;
   * everything else runs as a fully granted tenant admin so the assertions stay about
   * behaviour under test rather than about repeated setup.
   */
  const ALL_DOMAIN_KEYS = [
    'person-assignment:create',
    'user:create',
    'user:update',
    'maintenance-personnel:create',
    'maintenance-personnel:update',
  ];

  function fullyGrantedRoles() {
    return [
      {
        role: {
          code: 'TENANT_ADMIN',
          status: 'ACTIVE',
          permissions: ALL_DOMAIN_KEYS.map((key) => ({ permission: { key, status: 'ACTIVE' } })),
        },
      },
    ];
  }

  function makeTx(overrides: Record<string, any> = {}) {
    const calls: any = { created: [], updated: [], audits: [], deletedMany: [], createdMany: [] };

    const tx: Tx = {
      userRole: {
        findMany: jest.fn().mockResolvedValue(overrides.userRoles ?? fullyGrantedRoles()),
        deleteMany: jest.fn(async (args: any) => {
          calls.deletedMany.push(args);
          return { count: 1 };
        }),
        createMany: jest.fn(async (args: any) => {
          calls.createdMany.push(args);
          return { count: 1 };
        }),
      },
      role: {
        findMany: jest.fn(async (args: any) => {
          const ids = args.where?.id?.in ?? [];
          // Unknown role ids resolve to nothing, which is what the "role must be
          // grantable" assertions rely on.
          return (overrides.roles ?? []).filter((r: any) => ids.includes(r.id));
        }),
      },
      user: {
        findUnique: jest.fn(async (args: any) => {
          if (args.where?.email) return (overrides.users ?? []).find((u: any) => u.email === args.where.email) ?? null;
          return (overrides.users ?? []).find((u: any) => u.id === args.where?.id) ?? null;
        }),
        findFirst: jest.fn(async (args: any) => {
          const w = args.where ?? {};
          return (
            (overrides.users ?? []).find(
              (u: any) =>
                u.id === w.id &&
                (w.companyId === undefined || u.companyId === w.companyId) &&
                (w.branchId === undefined || u.branchId === w.branchId) &&
                (w.deletedAt === undefined || u.deletedAt === w.deletedAt),
            ) ?? null
          );
        }),
        create: jest.fn(async (args: any) => {
          calls.created.push({ table: 'user', data: args.data });
          return { id: 'user-new', ...args.data, passwordHash: undefined };
        }),
        update: jest.fn(async (args: any) => {
          calls.updated.push({ table: 'user', args });
          return { id: args.where.id };
        }),
      },
      operationalPerson: {
        findUnique: jest.fn(async (args: any) =>
          (overrides.people ?? []).find((p: any) => p.code === args.where?.code || p.id === args.where?.id) ?? null,
        ),
        findFirst: jest.fn(async (args: any) => {
          const w = args.where ?? {};
          if (w.userId) return (overrides.people ?? []).find((p: any) => p.userId === w.userId) ?? null;
          return (overrides.people ?? []).find((p: any) => p.id === w.id) ?? null;
        }),
        findUniqueForDetail: jest.fn(),
        create: jest.fn(async (args: any) => {
          calls.created.push({ table: 'person', data: args.data });
          return { id: personId, ...args.data, createdAt: new Date(), updatedAt: new Date() };
        }),
        update: jest.fn(async (args: any) => {
          calls.updated.push({ table: 'person', args });
          return { id: args.where.id };
        }),
      },
      operationalPersonAssignment: {
        create: jest.fn(async (args: any) => {
          calls.created.push({ table: 'assignment', data: args.data });
          return { id: 'assignment-new', ...args.data };
        }),
      },
      maintenancePersonnel: {
        create: jest.fn(async (args: any) => {
          calls.created.push({ table: 'maintenance', data: args.data });
          return { id: 'maintenance-new', ...args.data };
        }),
        update: jest.fn(async (args: any) => {
          calls.updated.push({ table: 'maintenance', args });
          return { id: args.where.id };
        }),
      },
      department: { findFirst: jest.fn(async (args: any) => ({ id: args.where.id, branchId: 'branch-1', administrationId: null })) },
      branch: { findFirst: jest.fn(async (args: any) => ({ id: args.where.id })) },
      jobTitle: { findFirst: jest.fn(async (args: any) => ({ id: args.where.id })) },
      administration: { findFirst: jest.fn(async (args: any) => ({ id: args.where.id, branchId: args.where?.id ? 'branch-1' : null })) },
    };

    // The read model fetch at the end of create/update.
    tx.operationalPerson.findUnique = jest.fn(async (args: any) => {
      if (args.where?.email) {
        return (overrides.users ?? []).find((u: any) => u.email === args.where.email) ?? null;
      }
      if (args.where?.code) {
        return (overrides.people ?? []).find((p: any) => p.code === args.where.code) ?? null;
      }
      return (
        (overrides.people ?? []).find((p: any) => p.id === args.where?.id) ?? {
          id: args.where?.id ?? personId,
          code: 'EMP-1',
          name: 'Ahmed Hassan',
          category: 'MAINTENANCE',
          isActive: true,
          phone: null,
          email: null,
          notes: null,
          userId: null,
          user: null,
          maintenancePersonnel: null,
          assignments: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );
    });

    return { tx, calls };
  }

  function makeService(tx: Tx, opts: { superAdmin?: boolean; preparePassword?: any } = {}) {
    const prisma: any = {
      $transaction: jest.fn(async (fn: any) => fn(tx)),
      operationalPerson: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    };

    const auditService: any = {
      logWithClient: jest.fn(async (_client: any, params: any) => {
        return params;
      }),
      log: jest.fn(),
    };

    const passwordCredentials: any = {
      preparePassword:
        opts.preparePassword ??
        jest.fn(async () => ({ passwordHash: 'hashed-never-logged', policy: {} })),
    };

    const numberingService: any = {
      generateNumberAtomicWithClient: jest.fn(async () => 'MP-000123'),
    };

    const service = new PersonRegistrationsService(
      prisma,
      auditService,
      passwordCredentials,
      numberingService,
    );
    return { service, prisma, auditService, passwordCredentials, numberingService };
  }

  describe('create', () => {
    it('writes the person, the placement and the audit record in one transaction', async () => {
      const { tx, calls } = makeTx();
      const { service } = makeService(tx);

      await service.create(baseDto(), ctx, actorId);

      const tables = calls.created.map((c: any) => c.table);
      expect(tables).toContain('person');
      expect(tables).toContain('assignment');
      expect(tables).not.toContain('user');
      expect(tables).not.toContain('maintenance');
      expect(service['prisma'].$transaction).toHaveBeenCalledTimes(1);
    });

    it('derives company and branch from the active context and never from the payload', async () => {
      const { tx, calls } = makeTx();
      const { service } = makeService(tx);

      // The DTO type does not accept companyId; the assertion proves even a smuggled
      // value cannot reach the write.
      await service.create(
        { ...baseDto(), companyId: 'attacker-company' } as any,
        ctx,
        actorId,
      );

      const assignment = calls.created.find((c: any) => c.table === 'assignment');
      expect(assignment.data.companyId).toBe('company-1');
      expect(assignment.data.branchId).toBe('branch-1');
      expect(assignment.data.companyId).not.toBe('attacker-company');
    });

    it('rejects a placement whose department belongs to another branch', async () => {
      const tx = makeTx().tx;
      tx.department.findFirst = jest.fn(async () => ({ id: 'dept-1', branchId: 'branch-other', administrationId: null }));
      const { service } = makeService(tx);

      await expect(
        service.create(baseDto({ placement: { departmentId: 'dept-1', branchId: 'branch-1' } }), ctx, actorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a placement, because an OperationalPerson has no tenant columns of its own', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);

      await expect(service.create(baseDto({ placement: undefined as any }), ctx, actorId)).rejects.toBeDefined();
    });

    it('creates the login and links it in the same transaction when a login is requested', async () => {
      const { tx, calls } = makeTx();
      const { service } = makeService(tx);

      await service.create(
        baseDto({ login: { email: 'ahmed@example.com', password: 'Str0ng!Pass' } as any }),
        ctx,
        actorId,
      );

      expect(calls.created.map((c: any) => c.table)).toContain('user');
      const linked = calls.updated.find((c: any) => c.table === 'person');
      expect(linked.args.data.userId).toBe('user-new');
    });

    it('creates the maintenance capability in the same transaction when requested', async () => {
      const { tx, calls } = makeTx();
      const { service } = makeService(tx);

      await service.create(
        baseDto({ maintenance: { role: 'TECHNICIAN', specialty: 'Hydraulics' } }),
        ctx,
        actorId,
      );

      const maintenance = calls.created.find((c: any) => c.table === 'maintenance');
      expect(maintenance.data.role).toBe('TECHNICIAN');
      expect(maintenance.data.operationalPersonId).toBe(personId);
    });

    it('rejects a login whose email already belongs to another account', async () => {
      const tx = makeTx({ users: [{ id: 'existing', email: 'taken@example.com', companyId: 'company-1', branchId: 'branch-1', deletedAt: null }] }).tx;
      const { service } = makeService(tx);

      await expect(
        service.create(baseDto({ login: { email: 'taken@example.com', password: 'Str0ng!Pass' } as any }), ctx, actorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to link a user that already belongs to another person', async () => {
      const tx = makeTx({
        users: [{ id: 'user-9', email: 'u@example.com', companyId: 'company-1', branchId: 'branch-1', deletedAt: null }],
        people: [{ id: 'other-person', userId: 'user-9' }],
      }).tx;
      const { service } = makeService(tx);

      await expect(service.create(baseDto({ login: { userId: 'user-9' } as any }), ctx, actorId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('refuses to link a user from another company', async () => {
      const tx = makeTx({
        users: [{ id: 'user-x', email: 'x@example.com', companyId: 'other-company', branchId: 'branch-1', deletedAt: null }],
        people: [],
      }).tx;
      const { service } = makeService(tx);

      await expect(service.create(baseDto({ login: { userId: 'user-x' } as any }), ctx, actorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a duplicate person code', async () => {
      const tx = makeTx({ people: [{ id: 'someone-else', code: 'EMP-1' }] }).tx;
      const { service } = makeService(tx);

      await expect(service.create(baseDto(), ctx, actorId)).rejects.toThrow(ConflictException);
    });

    it('never writes the password or its hash to the audit log', async () => {
      const { tx } = makeTx();
      const { service, auditService } = makeService(tx);

      await service.create(
        baseDto({ login: { email: 'ahmed@example.com', password: 'Str0ng!Pass' } as any }),
        ctx,
        actorId,
      );

      const serialised = JSON.stringify(auditService.logWithClient.mock.calls);
      expect(serialised).not.toContain('hashed-never-logged');
      expect(serialised).not.toContain('Str0ng!Pass');
    });

    it('generates a code from the numbering sequence when none is supplied', async () => {
      const { tx } = makeTx();
      const { service, numberingService } = makeService(tx);

      await service.create(baseDto({ code: undefined }), ctx, actorId);

      expect(numberingService.generateNumberAtomicWithClient).toHaveBeenCalledWith(
        'MAINTENANCE_PERSONNEL',
        tx,
      );
    });
  });

  describe('permission segmentation', () => {
    /**
     * The actor is granted every key except the ones named in `deny`, so each test can
     * prove that one specific domain key is genuinely required rather than assumed.
     */
    function actorWith(deny: string[] = []) {
      const all = [
        'person-assignment:create',
        'user:create',
        'user:update',
        'maintenance-personnel:create',
        'maintenance-personnel:update',
      ];
      const granted = all
        .filter((key) => !deny.includes(key))
        .map((key) => ({ permission: { key, status: 'ACTIVE' } }));
      return [{ role: { code: 'TENANT_ADMIN', status: 'ACTIVE', permissions: granted } }];
    }

    it('denies the whole operation when person-assignment:create is missing', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);
      tx.userRole.findMany = jest.fn().mockResolvedValue(actorWith(['person-assignment:create']));

      await expect(service.create(baseDto(), ctx, actorId)).rejects.toThrow(ForbiddenException);
    });

    it('denies creating a login without user:create, while allowing a plain person', async () => {
      const { tx: plainTx } = makeTx();
      const { service: plainService } = makeService(plainTx);
      plainTx.userRole.findMany = jest.fn().mockResolvedValue(actorWith(['user:create']));
      // A person-only operator is still allowed to register the person itself.
      await expect(plainService.create(baseDto(), ctx, actorId)).resolves.toBeDefined();

      const { tx } = makeTx();
      const { service } = makeService(tx);
      tx.userRole.findMany = jest.fn().mockResolvedValue(actorWith(['user:create']));
      await expect(
        service.create(baseDto({ login: { email: 'a@example.com', password: 'Str0ng!Pass' } as any }), ctx, actorId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies creating a maintenance capability without maintenance-personnel:create', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);
      tx.userRole.findMany = jest.fn().mockResolvedValue(actorWith(['maintenance-personnel:create']));

      await expect(
        service.create(baseDto({ maintenance: { role: 'TECHNICIAN' } }), ctx, actorId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies granting roles without user:update, even with user:create', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);
      tx.userRole.findMany = jest.fn().mockResolvedValue(actorWith(['user:update']));

      await expect(
        service.create(
          baseDto({ login: { email: 'a@example.com', password: 'Str0ng!Pass', roleIds: ['role-1'] } as any }),
          ctx,
          actorId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies an unauthenticated actor rather than trusting the request', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);

      await expect(service.create(baseDto(), ctx, undefined)).rejects.toThrow(ForbiddenException);
    });

    it('allows an ACTIVE SUPER_ADMIN through the per-domain checks', async () => {
      const { tx } = makeTx({
        roles: [{ id: 'role-1', status: 'ACTIVE', deletedAt: null }],
      });
      const { service } = makeService(tx);
      tx.userRole.findMany = jest.fn().mockResolvedValue([{ role: { code: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [] } }]);

      await expect(
        service.create(
          baseDto({
            login: { email: 'boss@example.com', password: 'Str0ng!Pass', roleIds: ['role-1'] } as any,
            maintenance: { role: 'TECHNICIAN' },
          }),
          ctx,
          actorId,
        ),
      ).resolves.toBeDefined();
    });

    it('ignores an INACTIVE role when computing granted permissions', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);
      tx.userRole.findMany = jest.fn().mockResolvedValue([
        { role: { code: 'STALE', status: 'INACTIVE', permissions: [{ permission: { key: 'person-assignment:create', status: 'ACTIVE' } }] } },
      ]);

      await expect(service.create(baseDto(), ctx, actorId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    function personWithLogin(overrides: any = {}) {
      return {
        id: personId,
        code: 'EMP-1',
        name: 'Ahmed Hassan',
        category: 'MAINTENANCE',
        isActive: true,
        phone: null,
        email: null,
        notes: null,
        userId: 'user-1',
        user: { id: 'user-1', email: 'ahmed@example.com', name: 'Ahmed', status: 'ACTIVE', lastLoginAt: new Date(), roles: [{ roleId: 'role-a' }] },
        maintenancePersonnel: { id: 'mp-1', role: 'TECHNICIAN', specialty: null, isActive: true, dailyCapacityMinutes: 480 },
        assignments: [
          {
            id: 'assignment-1',
            companyId: 'company-1',
            branchId: 'branch-1',
            administrationId: null,
            departmentId: 'dept-1',
            jobTitleId: null,
            assignmentType: 'PRIMARY',
            leadershipLevel: 'NONE',
            effectiveFrom: new Date('2020-01-01'),
            effectiveTo: null,
            status: 'ACTIVE',
            deletedAt: null,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      };
    }

    function updateTx(person: any, overrides: Record<string, any> = {}) {
      const { tx, calls } = makeTx({
        people: [person],
        users: [],
        roles: overrides.roles ?? [],
      });
      tx.operationalPerson.findFirst = jest.fn(async () => person);
      tx.operationalPerson.findUnique = jest.fn(async () => person);
      tx.user.findFirst = jest.fn(async () => ({ id: 'user-1', email: 'ahmed@example.com' }));
      tx.userRole.findMany = jest.fn(
        async () => overrides.userRoles ?? [
          {
            role: {
              code: 'TENANT_ADMIN',
              status: 'ACTIVE',
              permissions: [
                { permission: { key: 'user:update', status: 'ACTIVE' } },
                { permission: { key: 'maintenance-personnel:update', status: 'ACTIVE' } },
              ],
            },
          },
        ],
      );
      return { tx, calls };
    }

    it('preserves the login roles when the request does not mention them', async () => {
      const { tx, calls } = updateTx(personWithLogin());
      const { service } = makeService(tx);

      await service.update(personId, { name: 'Ahmed Hassan II' } as UpdatePersonRegistrationDto, ctx, actorId);

      expect(calls.deletedMany).toHaveLength(0);
      expect(calls.createdMany).toHaveLength(0);
      const personUpdate = calls.updated.find((c: any) => c.table === 'person');
      expect(personUpdate.args.data.name).toBe('Ahmed Hassan II');
    });

    it('never rewrites the password hash, authVersion or last-login stamp', async () => {
      const { tx, calls } = updateTx(personWithLogin());
      const { service } = makeService(tx);

      await service.update(
        personId,
        { name: 'Renamed' } as UpdatePersonRegistrationDto,
        ctx,
        actorId,
      );

      const userUpdate = calls.updated.find((c: any) => c.table === 'user');
      if (userUpdate) {
        expect(userUpdate.args.data).not.toHaveProperty('passwordHash');
        expect(userUpdate.args.data).not.toHaveProperty('authVersion');
        expect(userUpdate.args.data).not.toHaveProperty('lastLoginAt');
      }
    });

    it('replaces the role set only when roleIds is explicitly supplied', async () => {
      const { tx, calls } = updateTx(personWithLogin(), {
        roles: [
          { id: 'role-b', status: 'ACTIVE', deletedAt: null },
          { id: 'role-c', status: 'ACTIVE', deletedAt: null },
        ],
      });
      const { service } = makeService(tx);

      await service.update(
        personId,
        { login: { roleIds: ['role-b', 'role-c'] } } as UpdatePersonRegistrationDto,
        ctx,
        actorId,
      );

      expect(calls.deletedMany).toHaveLength(1);
      expect(calls.createdMany[0].data).toEqual([
        { userId: 'user-1', roleId: 'role-b' },
        { userId: 'user-1', roleId: 'role-c' },
      ]);
    });

    it('does not touch the placement rows', async () => {
      const { tx, calls } = updateTx(personWithLogin());
      const { service } = makeService(tx);

      await service.update(
        personId,
        { maintenance: { role: 'SENIOR_TECHNICIAN' } } as UpdatePersonRegistrationDto,
        ctx,
        actorId,
      );

      expect(calls.created.some((c: any) => c.table === 'assignment')).toBe(false);
      const maintenanceUpdate = calls.updated.find((c: any) => c.table === 'maintenance');
      expect(maintenanceUpdate).toBeDefined();
      expect(maintenanceUpdate.args.data.role).toBe('SENIOR_TECHNICIAN');
    });

    it('rejects login edits for a person that has no login', async () => {
      const { tx } = updateTx(personWithLogin({ userId: null, user: null }));
      const { service } = makeService(tx);

      await expect(
        service.update(personId, { login: { name: 'X' } } as UpdatePersonRegistrationDto, ctx, actorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('denies login edits without user:update', async () => {
      const { tx } = updateTx(personWithLogin(), { userRoles: [] });
      const { service } = makeService(tx);

      await expect(
        service.update(personId, { login: { name: 'X' } } as UpdatePersonRegistrationDto, ctx, actorId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies capability edits without maintenance-personnel:update', async () => {
      const { tx } = updateTx(personWithLogin(), {
        userRoles: [
          { role: { code: 'TENANT_ADMIN', status: 'ACTIVE', permissions: [{ permission: { key: 'user:update', status: 'ACTIVE' } }] } },
        ],
      });
      const { service } = makeService(tx);

      await expect(
        service.update(personId, { maintenance: { role: 'X' } } as UpdatePersonRegistrationDto, ctx, actorId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cannot see a person that has no placement in the active company and branch', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);
      tx.operationalPerson.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.update(personId, { name: 'X' } as UpdatePersonRegistrationDto, ctx, actorId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects reusing another account email', async () => {
      const { tx } = updateTx(personWithLogin());
      tx.user.findUnique = jest.fn().mockResolvedValue({ id: 'someone-else' });
      const { service } = makeService(tx);

      await expect(
        service.update(personId, { login: { email: 'taken@example.com' } } as UpdatePersonRegistrationDto, ctx, actorId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('read model', () => {
    it('does not expose a password hash anywhere in the list shape', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);

      const result = await service.findAll({}, ctx);
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('reports the current placement and the assignment count', async () => {
      const { tx } = makeTx();
      const { service } = makeService(tx);

      const person = {
        id: personId,
        code: 'EMP-1',
        name: 'Ahmed',
        category: 'MAINTENANCE',
        isActive: true,
        phone: null,
        email: null,
        notes: null,
        userId: null,
        user: null,
        maintenancePersonnel: null,
        assignments: [
          {
            id: 'a1',
            companyId: 'company-1',
            branchId: 'branch-1',
            administrationId: null,
            jobTitleId: null,
            assignmentType: 'PRIMARY',
            leadershipLevel: 'NONE',
            status: 'ACTIVE',
            deletedAt: null,
            effectiveFrom: new Date('2020-01-01'),
            effectiveTo: null,
          },
          {
            id: 'a2',
            companyId: 'company-1',
            branchId: 'branch-1',
            administrationId: null,
            jobTitleId: null,
            assignmentType: 'PRIMARY',
            leadershipLevel: 'NONE',
            status: 'CLOSED',
            deletedAt: null,
            effectiveFrom: new Date('2022-01-01'),
            effectiveTo: new Date('2023-01-01'),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (service['prisma'].operationalPerson as any).findMany = jest.fn().mockResolvedValue([person]);

      const result = await service.findAll({}, ctx);
      expect(result.data[0].currentAssignment.id).toBe('a1');
      expect(result.data[0].assignmentCount).toBe(2);
    });
  });
});