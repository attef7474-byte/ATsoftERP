import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { PasswordCredentialService } from '../../settings/security/password-credential.service';
import { NumberingService } from '../../numbering/numbering.service';
import { assertUserPermissions } from '../../../common/permissions/assert-user-permissions';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  CreatePersonRegistrationDto,
  PersonLoginDto,
  PersonMaintenanceCapabilityDto,
} from './dto/create-person-registration.dto';
import { UpdatePersonRegistrationDto } from './dto/update-person-registration.dto';

/**
 * CANONICAL PERSON REGISTRATION ORCHESTRATION (Group 1).
 *
 * Why this exists. The same operational fact - "a person joined" - used to be entered in
 * three unrelated places, each writing a different subset of the domain and each owning a
 * different share of the invariants:
 *
 *   - `EmployeesService.create` wrote OperationalPerson + OperationalPersonAssignment and
 *     knew about tenancy, but knew nothing about logins or maintenance capability.
 *   - `MaintenancePersonnelService.create` wrote OperationalPerson + MaintenancePersonnel
 *     and knew about neither company nor branch, so it produced a person that no
 *     OperationalPersonAssignment anchors and that the employee list therefore cannot see.
 *   - `UsersService.create` wrote User + roles and knew about tenancy, but not about the
 *     person or their placement.
 *
 * So a real hire needed up to three round trips, and a partial failure left an orphaned
 * identity behind with no tenant anchor. This service is the single write path that answers
 * it in one transaction.
 *
 * Invariants this service owns:
 *  - Tenancy is derived from the active operational context and never accepted from the
 *    client. An OperationalPerson has no company/branch columns; its placement row is the
 *    only thing that anchors it, which is why `placement` is required on create.
 *  - Optional capabilities are genuinely optional and each one is permission-gated by its
 *    own domain key, so creating a login is not covered by `operational-person:create`.
 *  - Everything is written in one transaction, so a rejected login or capability cannot
 *    leave a half-registered person behind.
 *  - Nothing secret is written to the audit log.
 */
@Injectable()
export class PersonRegistrationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private passwordCredentials: PasswordCredentialService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  /**
   * A person is visible only through a placement inside the active context. This is the
   * same tenant predicate the employee list uses, so both surfaces agree on membership.
   */
  private currentPlacementWhere(ctx: ActiveOperationalContext, now = new Date()) {
    return {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    };
  }

  /**
   * Resolves the permissions this specific request actually exercises.
   *
   * The route itself is guarded by `operational-person:create`, which covers only the
   * person. A login is a User write and a maintenance capability is a MaintenancePersonnel
   * write, so those keys are required in addition, and granting roles is a separate action
   * again. Failing here rather than silently skipping keeps the domains separated.
   */
  private async resolveRequiredPermissions(
    client: Prisma.TransactionClient,
    actorUserId: string | undefined,
    dto: { login?: { roleIds?: string[] }; maintenance?: unknown },
  ): Promise<void> {
    const required = ['person-assignment:create'];
    if (dto.login) {
      required.push('user:create');
      if (dto.login.roleIds?.length) required.push('user:update');
    }
    if (dto.maintenance) required.push('maintenance-personnel:create');
    await assertUserPermissions(client as any, actorUserId, required);
  }

  private async validatePlacementReferences(
    client: Prisma.TransactionClient,
    placement: CreatePersonRegistrationDto['placement'],
    ctx: ActiveOperationalContext,
  ): Promise<void> {
    const c = client as any;

    const branchId = placement.branchId ?? ctx.branchId;

    const department = await c.department.findFirst({
      where: { id: placement.departmentId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true, branchId: true, administrationId: true },
    });
    if (!department) {
      throw this.validationError(
        'placement.departmentId',
        'validation.invalidReference',
        'Department not found in the active company',
      );
    }

    if (placement.branchId) {
      const branch = await c.branch.findFirst({
        where: { id: placement.branchId, companyId: ctx.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!branch) {
        throw this.validationError(
          'placement.branchId',
          'validation.invalidReference',
          'Branch not found in the active company',
        );
      }
    }

    // The department must actually sit in the branch we are about to place the person in,
    // otherwise the placement would contradict the org structure it claims to follow.
    if (department.branchId && department.branchId !== branchId) {
      throw this.validationError(
        'placement.departmentId',
        'validation.invalidBranchHierarchy',
        'Department does not belong to the selected branch',
      );
    }

    if (placement.jobTitleId) {
      const jobTitle = await c.jobTitle.findFirst({
        where: { id: placement.jobTitleId, companyId: ctx.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!jobTitle) {
        throw this.validationError(
          'placement.jobTitleId',
          'validation.invalidReference',
          'Job title not found in the active company',
        );
      }
    }

    if (placement.administrationId) {
      const administration = await c.administration.findFirst({
        where: {
          id: placement.administrationId,
          deletedAt: null,
          branch: { companyId: ctx.companyId, deletedAt: null },
        },
        select: { id: true, branchId: true },
      });
      if (!administration) {
        throw this.validationError(
          'placement.administrationId',
          'validation.invalidReference',
          'Administration not found in the active company',
        );
      }
      if (administration.branchId !== branchId) {
        throw this.validationError(
          'placement.administrationId',
          'validation.invalidBranchHierarchy',
          'Administration does not belong to the selected branch',
        );
      }
      if (department.administrationId && department.administrationId !== administration.id) {
        throw this.validationError(
          'placement.administrationId',
          'validation.invalidReference',
          'Administration does not own the selected department',
        );
      }
    }

    if (placement.effectiveFrom && Number.isNaN(Date.parse(placement.effectiveFrom))) {
      throw this.validationError(
        'placement.effectiveFrom',
        'validation.invalidDate',
        'placement.effectiveFrom is not a valid date',
      );
    }
  }

  private async assertRoleIdsUsable(client: Prisma.TransactionClient, roleIds: string[]): Promise<void> {
    const roles = await (client as any).role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, status: true, deletedAt: true },
    });
    const byId = new Map<string, { id: string; status: string; deletedAt: string | null }>(
      (roles as Array<{ id: string; status: string; deletedAt: string | null }>).map((role) => [
        role.id,
        role,
      ]),
    );
    const unusable = roleIds.filter((id) => {
      const role = byId.get(id);
      return !role || role.status !== 'ACTIVE' || role.deletedAt !== null;
    });
    if (unusable.length > 0) {
      throw this.validationError(
        'login.roleIds',
        'validation.invalidReference',
        `Roles not found or not grantable: ${unusable.join(', ')}`,
      );
    }
  }

  /**
   * A person code is unique across the whole system, so a repeat submission must be
   * reported as a duplicate rather than surfacing as a raw constraint violation.
   */
  private async assertCodeAvailable(
    client: Prisma.TransactionClient,
    code: string,
    excludePersonId?: string,
  ): Promise<void> {
    const existing = await (client as any).operationalPerson.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing && existing.id !== excludePersonId) {
      throw new ConflictException({
        messageKey: 'organization.personCodeAlreadyExists',
        message: 'Person code already exists',
        errors: [{ field: 'code', code: 'employees.duplicateCode', message: 'Person code already exists' }],
      });
    }
  }

  async create(dto: CreatePersonRegistrationDto, ctx: ActiveOperationalContext, actorUserId?: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.resolveRequiredPermissions(tx, actorUserId, dto);
          await this.validatePlacementReferences(tx, dto.placement, ctx);

          const branchId = dto.placement.branchId ?? ctx.branchId;

          // Reject a duplicate submission on the login side before writing anything.
          if (dto.login?.email) {
            const existingUser = await tx.user.findUnique({
              where: { email: dto.login.email },
              select: { id: true },
            });
            if (existingUser) {
              throw this.validationError(
                'login.email',
                'validation.duplicateValue',
                'Email already in use',
              );
            }
          }
          if (dto.login?.userId) {
            await this.assertLinkableUser(tx, dto.login, ctx);
          }
          if (dto.login?.roleIds?.length) {
            await this.assertRoleIdsUsable(tx, dto.login.roleIds);
          }

          const code =
            dto.code?.trim() ||
            (await this.numberingService.generateNumberAtomicWithClient('MAINTENANCE_PERSONNEL', tx));
          await this.assertCodeAvailable(tx, code);

          const isActive = dto.isActive ?? true;

          const person = await tx.operationalPerson.create({
            data: {
              code,
              name: dto.name,
              category: dto.category ?? 'MAINTENANCE',
              phone: dto.phone ?? null,
              email: dto.email ?? null,
              notes: dto.notes ?? null,
              isActive,
            },
          });

          // The placement is what makes the person real for this company: every
          // tenant-scoped read of a person goes through it.
          const assignment = await tx.operationalPersonAssignment.create({
            data: {
              companyId: ctx.companyId,
              branchId,
              administrationId: dto.placement.administrationId ?? null,
              departmentId: dto.placement.departmentId,
              jobTitleId: dto.placement.jobTitleId ?? null,
              personnelId: person.id,
              assignmentType: dto.placement.assignmentType ?? 'PRIMARY',
              // Leadership is assigned through the placement workflow, which owns the
              // one-holder-per-department rule. Registration always starts unled.
              leadershipLevel: 'NONE',
              effectiveFrom: dto.placement.effectiveFrom
                ? new Date(dto.placement.effectiveFrom)
                : new Date(),
              status: 'ACTIVE',
              notes: dto.placement.notes ?? null,
              createdByUserId: actorUserId ?? null,
            },
          });

          const user = dto.login
            ? await this.createLinkedUser(tx, dto.login, ctx, person.id, branchId, actorUserId)
            : null;

          if (user) {
            await tx.operationalPerson.update({
              where: { id: person.id },
              data: { userId: user.id },
            });
          }

          const maintenance = dto.maintenance
            ? await this.createMaintenanceCapability(tx, dto.maintenance, person.id, isActive)
            : null;

          await this.auditService.logWithClient(tx, {
            userId: actorUserId,
            action: 'CREATE',
            entity: 'OperationalPerson',
            entityId: person.id,
            details: {
              source: 'PERSON_REGISTRATION',
              companyId: ctx.companyId,
              branchId,
              code: person.code,
              name: person.name,
              category: person.category,
              assignmentId: assignment.id,
              departmentId: assignment.departmentId,
              loginCreated: Boolean(user),
              maintenanceCapabilityCreated: Boolean(maintenance),
            },
          });

          if (user) {
            await this.auditService.logWithClient(tx, {
              userId: actorUserId,
              action: 'CREATE',
              entity: 'User',
              entityId: user.id,
              details: {
                source: 'PERSON_REGISTRATION',
                companyId: ctx.companyId,
                branchId,
                operationalPersonId: person.id,
                email: user.email,
                // The role list is intentional, the credential never is.
                roleIds: dto.login?.roleIds ?? [],
              },
            });
          }

          if (maintenance) {
            await this.auditService.logWithClient(tx, {
              userId: actorUserId,
              action: 'CREATE',
              entity: 'MaintenancePersonnel',
              entityId: maintenance.id,
              details: {
                source: 'PERSON_REGISTRATION',
                companyId: ctx.companyId,
                branchId,
                operationalPersonId: person.id,
                role: maintenance.role,
              },
            });
          }

          return this.buildResponse(tx, person.id, ctx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: any) {
      // Unique-code races and serialization failures arrive as Prisma errors; translate
      // them into the stable contract instead of leaking driver text to the client.
      if (error?.code === 'P2002') {
        throw new ConflictException({
          messageKey: 'organization.personCodeAlreadyExists',
          message: 'Person code already exists',
          errors: [{ field: 'code', code: 'employees.duplicateCode', message: 'Person code already exists' }],
        });
      }
      if (error?.code === 'P2034') {
        throw new ConflictException({
          messageKey: 'organization.personRegistrationConflict',
          message: 'The person was registered concurrently, please retry',
        });
      }
      throw error;
    }
  }

  /**
   * Linking an existing login must not be a way to borrow a user from another company or
   * to attach one user to two people, so both are rejected here.
   */
  private async assertLinkableUser(
    tx: Prisma.TransactionClient,
    login: PersonLoginDto,
    ctx: ActiveOperationalContext,
  ): Promise<any> {
    const user = await tx.user.findFirst({
      where: {
        id: login.userId!,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
      },
      select: { id: true, email: true },
    });
    if (!user) {
      throw this.validationError(
        'login.userId',
        'validation.invalidReference',
        'User not found in the active company and branch',
      );
    }
    const linked = await tx.operationalPerson.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (linked) {
      throw new ConflictException({
        messageKey: 'organization.userAlreadyLinkedToPerson',
        message: 'User is already linked to another operational person',
      });
    }
    return user;
  }

  private async createLinkedUser(
    tx: Prisma.TransactionClient,
    login: PersonLoginDto,
    ctx: ActiveOperationalContext,
    personId: string,
    branchId: string,
    actorUserId?: string,
  ): Promise<any> {
    if (login.userId) {
      return this.assertLinkableUser(tx, login, ctx);
    }

    if (!login.email || !login.password) {
      throw this.validationError(
        'login',
        'validation.required',
        'Creating a login requires email and password, or an existing userId to link',
      );
    }

    const { passwordHash } = await this.passwordCredentials.preparePassword(
      login.password,
      login.password,
      { passwordField: 'password', confirmationField: 'password', client: tx },
    );

    return tx.user.create({
      data: {
        email: login.email,
        passwordHash,
        name: login.name ?? login.email,
        phone: login.phone ?? null,
        status: 'ACTIVE',
        companyId: ctx.companyId,
        branchId,
        roles: login.roleIds?.length
          ? { create: login.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: { id: true, email: true, status: true },
    });
  }

  private async createMaintenanceCapability(
    tx: Prisma.TransactionClient,
    maintenance: PersonMaintenanceCapabilityDto,
    personId: string,
    personIsActive: boolean,
  ): Promise<any> {
    return tx.maintenancePersonnel.create({
      data: {
        operationalPersonId: personId,
        role: maintenance.role,
        specialty: maintenance.specialty ?? null,
        isActive: maintenance.isActive ?? personIsActive,
        dailyCapacityMinutes: maintenance.dailyCapacityMinutes ?? 480,
      },
      select: { id: true, role: true, isActive: true },
    });
  }

  async findAll(
    query: { page?: number; limit?: number; search?: string; isActive?: string },
    ctx: ActiveOperationalContext,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      assignments: { some: this.currentPlacementWhere(ctx) },
    };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [rows, total] = await Promise.all([
      this.prisma.operationalPerson.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: this.registrationInclude(),
      }),
      this.prisma.operationalPerson.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.mapPerson(row, ctx)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(personId: string, ctx: ActiveOperationalContext) {
    const person = await this.prisma.operationalPerson.findFirst({
      where: {
        id: personId,
        assignments: { some: this.currentPlacementWhere(ctx) },
      },
      include: this.registrationInclude(),
    });
    if (!person) {
      throw new NotFoundException({
        messageKey: 'employees.notFound',
        message: 'Person not found in the active branch',
      });
    }
    return this.mapPerson(person, ctx);
  }

  /**
   * Coordinated update.
   *
   * The promise here is that updating a person can never silently destroy authentication
   * or history state: the password hash, `authVersion`, last-login stamp, account status,
   * role set and placement rows are all left alone unless the request explicitly asks for
   * that specific field.
   */
  async update(
    personId: string,
    dto: UpdatePersonRegistrationDto,
    ctx: ActiveOperationalContext,
    actorUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const person = await tx.operationalPerson.findFirst({
        where: {
          id: personId,
          assignments: { some: this.currentPlacementWhere(ctx) },
        },
        include: this.registrationInclude(),
      });
      if (!person) {
        throw new NotFoundException({
          messageKey: 'employees.notFound',
          message: 'Person not found in the active branch',
        });
      }

      // A person that carries a login is an identity, not just a profile row, so its
      // login edits are User writes and capability edits are MaintenancePersonnel writes.
      const required: string[] = [];
      if (dto.login) required.push('user:update');
      if (dto.maintenance) required.push('maintenance-personnel:update');
      await assertUserPermissions(tx as any, actorUserId, required);

      const personChanges: Record<string, unknown> = {};
      if (dto.name !== undefined) personChanges.name = dto.name;
      if (dto.phone !== undefined) personChanges.phone = dto.phone ?? null;
      if (dto.email !== undefined) personChanges.email = dto.email ?? null;
      if (dto.notes !== undefined) personChanges.notes = dto.notes ?? null;
      if (dto.isActive !== undefined) personChanges.isActive = dto.isActive;
      if (dto.code !== undefined && dto.code.trim() !== person.code) {
        await this.assertCodeAvailable(tx, dto.code.trim(), person.id);
        personChanges.code = dto.code.trim();
      }

      let loginChanges: Record<string, unknown> = {};
      let roleReplacement: string[] | undefined;
      if (dto.login) {
        loginChanges = {};
        if (dto.login.email !== undefined) loginChanges.email = dto.login.email;
        if (dto.login.name !== undefined) loginChanges.name = dto.login.name;
        if (dto.login.phone !== undefined) loginChanges.phone = dto.login.phone ?? null;
        if (dto.login.status !== undefined) loginChanges.status = dto.login.status;
        if (dto.login.roleIds !== undefined) roleReplacement = dto.login.roleIds;

        if (!person.userId) {
          throw new BadRequestException({
            messageKey: 'organization.personHasNoLogin',
            message: 'This person has no linked login to update',
          });
        }
        if (dto.login.email && dto.login.email !== person.user?.email) {
          const existingUser = await tx.user.findUnique({
            where: { email: dto.login.email },
            select: { id: true },
          });
          if (existingUser && existingUser.id !== person.userId) {
            throw this.validationError(
              'login.email',
              'validation.duplicateValue',
              'Email already in use',
            );
          }
        }
        if (roleReplacement) await this.assertRoleIdsUsable(tx, roleReplacement);
      }

      if (Object.keys(personChanges).length > 0) {
        await tx.operationalPerson.update({ where: { id: person.id }, data: personChanges });
      }

      if (person.userId && (Object.keys(loginChanges).length > 0 || roleReplacement)) {
        const data: Record<string, unknown> = { ...loginChanges };
        if (roleReplacement) {
          // Explicitly requested, so replacing the set is intended. When `roleIds` is
          // absent this branch is never reached, which is what preserves roles.
          await tx.userRole.deleteMany({ where: { userId: person.userId } });
          if (roleReplacement.length > 0) {
            await tx.userRole.createMany({
              data: roleReplacement.map((roleId) => ({ userId: person.userId!, roleId })),
            });
          }
        }
        await tx.user.update({ where: { id: person.userId }, data });
      }

      if (dto.maintenance) {
        const existing = person.maintenancePersonnel;
        if (existing) {
          await tx.maintenancePersonnel.update({
            where: { id: existing.id },
            data: {
              role: dto.maintenance.role,
              specialty: dto.maintenance.specialty ?? null,
              dailyCapacityMinutes: dto.maintenance.dailyCapacityMinutes ?? 480,
              ...(dto.maintenance.isActive !== undefined
                ? { isActive: dto.maintenance.isActive }
                : {}),
            },
          });
        } else {
          await this.createMaintenanceCapability(tx, dto.maintenance, person.id, person.isActive);
        }
      }

      await this.auditService.logWithClient(tx, {
        userId: actorUserId,
        action: 'UPDATE',
        entity: 'OperationalPerson',
        entityId: person.id,
        details: {
          source: 'PERSON_REGISTRATION',
          companyId: ctx.companyId,
          previousValues: {
            name: person.name,
            code: person.code,
            phone: person.phone,
            email: person.email,
            isActive: person.isActive,
          },
          newValues: Object.keys(personChanges).length > 0 ? personChanges : 'no person field changed',
          loginChanged: Object.keys(loginChanges).length > 0,
          roleIdsReplaced: roleReplacement ?? 'preserved',
          maintenanceCapabilityChanged: Boolean(dto.maintenance),
          // Records that placements were deliberately not rewritten by this call.
          placementPreserved: true,
        },
      });

      return this.buildResponse(tx, person.id, ctx);
    });
  }

  /**
   * The unified read model. A password hash is never selected, so it cannot leak even if
   * this shape is serialised straight to the client.
   */
  private registrationInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          lastLoginAt: true,
          roles: { select: { roleId: true } },
        },
      },
      maintenancePersonnel: {
        select: {
          id: true,
          role: true,
          specialty: true,
          isActive: true,
          dailyCapacityMinutes: true,
        },
      },
      assignments: {
        where: { deletedAt: null },
        orderBy: { effectiveFrom: 'desc' as const },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          administrationId: true,
          departmentId: true,
          jobTitleId: true,
          assignmentType: true,
          leadershipLevel: true,
          effectiveFrom: true,
          effectiveTo: true,
          status: true,
          deletedAt: true,
        },
      },
    } as const;
  }

  private mapPerson(person: any, ctx: ActiveOperationalContext) {
    const now = new Date();
    const currentAssignment =
      person.assignments?.find(
        (assignment: any) =>
          assignment.companyId === ctx.companyId &&
          assignment.branchId === ctx.branchId &&
          assignment.deletedAt === null &&
          new Date(assignment.effectiveFrom) <= now &&
          (!assignment.effectiveTo || new Date(assignment.effectiveTo) >= now),
      ) ?? null;

    return {
      id: person.id,
      code: person.code,
      name: person.name,
      category: person.category,
      isActive: person.isActive,
      phone: person.phone,
      email: person.email,
      notes: person.notes,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
      login: person.user
        ? {
            id: person.user.id,
            email: person.user.email,
            name: person.user.name,
            status: person.user.status,
            lastLoginAt: person.user.lastLoginAt,
            roleIds: person.user.roles.map((role: any) => role.roleId),
          }
        : null,
      maintenanceCapability: person.maintenancePersonnel
        ? {
            id: person.maintenancePersonnel.id,
            role: person.maintenancePersonnel.role,
            specialty: person.maintenancePersonnel.specialty,
            isActive: person.maintenancePersonnel.isActive,
            dailyCapacityMinutes: person.maintenancePersonnel.dailyCapacityMinutes,
          }
        : null,
      currentAssignment,
      assignmentCount: person.assignments?.length ?? 0,
    };
  }

  private async buildResponse(tx: Prisma.TransactionClient, personId: string, ctx: ActiveOperationalContext) {
    const person = await tx.operationalPerson.findUnique({
      where: { id: personId },
      include: this.registrationInclude(),
    });
    return this.mapPerson(person, ctx);
  }
}