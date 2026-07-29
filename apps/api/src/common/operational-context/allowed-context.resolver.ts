import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActiveOperationalContext,
  OperationalAccessGrant,
  OperationalContextsResult,
  ResolvedOperationalAccess,
  UserAuthorizationSnapshot,
  operationalContextKey,
} from './operational-context.types';

interface ContextReference {
  id: string;
  code: string;
  name: string;
  status: string;
  deletedAt: Date | null;
}

interface ContextRelations {
  company: ContextReference;
  branch: ContextReference;
  administration: ContextReference | null;
  department: ContextReference | null;
}

@Injectable()
export class AllowedContextResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<ResolvedOperationalAccess> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        messageKey: 'auth.userNotFound',
        message: 'User not found or inactive',
      });
    }

    const activeRoles = user.roles
      .map((assignment) => assignment.role)
      .filter((role) => role.status === 'ACTIVE' && role.deletedAt === null);
    const permissions = new Set<string>();
    for (const role of activeRoles) {
      for (const assignment of role.permissions) {
        if (assignment.permission.status === 'ACTIVE') {
          permissions.add(assignment.permission.key);
        }
      }
    }

    const authorization: UserAuthorizationSnapshot = {
      roles: activeRoles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
      })),
      permissions: Array.from(permissions).sort(),
      isSuperAdmin: activeRoles.some((role) => role.code === 'SUPER_ADMIN'),
    };

    let contexts: ActiveOperationalContext[] = [];
    let grants: OperationalAccessGrant[] = [];

    if (authorization.isSuperAdmin) {
      const branches = await this.prisma.branch.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          company: { status: 'ACTIVE', deletedAt: null },
        },
        include: { company: true },
        orderBy: [{ company: { code: 'asc' } }, { code: 'asc' }],
      });

      contexts = branches.map((branch) =>
        this.toContext(
          {
            scopeId: null,
            companyId: branch.companyId,
            branchId: branch.id,
            administrationId: null,
            departmentId: null,
            isDefault:
              branch.companyId === user.companyId && branch.id === user.branchId,
            source: 'SUPER_ADMIN',
          },
          {
            company: branch.company,
            branch,
            administration: null,
            department: null,
          },
        ),
      );
      grants = contexts.map((context) => this.toGrant(context));
    } else {
      const scopes = await this.prisma.userOperationalScope.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: {
          company: true,
          branch: true,
          administration: true,
          department: true,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });

      contexts = scopes
        .filter(
          (scope) =>
            this.isActive(scope.company) &&
            this.isActive(scope.branch) &&
            scope.branch.companyId === scope.companyId &&
            (!scope.administration ||
              (this.isActive(scope.administration) &&
                scope.administration.branchId === scope.branchId)) &&
            (!scope.department ||
              (this.isActive(scope.department) &&
                scope.department.companyId === scope.companyId &&
                scope.department.branchId === scope.branchId &&
                (!scope.administrationId ||
                  scope.department.administrationId ===
                    scope.administrationId))),
        )
        .map((scope) =>
          this.toContext(
            {
              scopeId: scope.id,
              companyId: scope.companyId,
              branchId: scope.branchId,
              administrationId: scope.administrationId,
              departmentId: scope.departmentId,
              isDefault: scope.isDefault,
              source: 'EXPLICIT_SCOPE',
            },
            {
              company: scope.company,
              branch: scope.branch,
              administration: scope.administration,
              department: scope.department,
            },
          ),
        );
      contexts = this.deduplicateContexts(contexts);
      grants = contexts.map((context) => this.toGrant(context));

      if (contexts.length === 0) {
        const legacy = await this.resolveLegacyContext(
          user.companyId,
          user.branchId,
          user.departmentId,
        );
        if (legacy) {
          contexts = [legacy];
          grants = [this.toGrant(legacy)];
        }
      }
    }

    const normalized = this.markDefault(contexts);
    return {
      authorization,
      contexts: normalized.contexts,
      defaultContext: normalized.defaultContext,
      grants,
      legacyCompanyId: user.companyId,
      legacyBranchId: user.branchId,
      legacyDepartmentId: user.departmentId,
    };
  }

  async getContexts(userId: string): Promise<OperationalContextsResult> {
    const result = await this.resolve(userId);
    return {
      contexts: result.contexts,
      defaultContext: result.defaultContext,
    };
  }

  async getAuthorization(userId: string): Promise<UserAuthorizationSnapshot> {
    return (await this.resolve(userId)).authorization;
  }

  private async resolveLegacyContext(
    companyId: string | null,
    branchId: string | null,
    departmentId: string | null,
  ): Promise<ActiveOperationalContext | null> {
    if (!companyId || !branchId) return null;

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: 'ACTIVE',
        deletedAt: null,
        company: { status: 'ACTIVE', deletedAt: null },
      },
      include: { company: true },
    });
    if (!branch) return null;

    let department: ContextReference & {
      companyId: string;
      branchId: string | null;
      administrationId: string | null;
      administration: ContextReference | null;
    } | null = null;
    if (departmentId) {
      department = await this.prisma.department.findFirst({
        where: {
          id: departmentId,
          companyId,
          branchId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        include: { administration: true },
      });
      if (
        !department ||
        (department.administrationId &&
          !this.isActive(department.administration))
      ) {
        return null;
      }
    }

    return this.toContext(
      {
        scopeId: null,
        companyId,
        branchId,
        administrationId: department?.administrationId || null,
        departmentId: department?.id || null,
        isDefault: true,
        source: 'LEGACY_USER_ASSIGNMENT',
      },
      {
        company: branch.company,
        branch,
        administration: department?.administration || null,
        department,
      },
    );
  }

  private isActive(
    entity: { status: string; deletedAt?: Date | null } | null,
  ): boolean {
    return !!entity && entity.status === 'ACTIVE' && entity.deletedAt == null;
  }

  private toContext(
    grant: OperationalAccessGrant,
    relations: ContextRelations,
  ): ActiveOperationalContext {
    return {
      contextKey: operationalContextKey(grant),
      scopeId: grant.scopeId,
      companyId: grant.companyId,
      companyName: relations.company.name,
      companyCode: relations.company.code,
      branchId: grant.branchId,
      branchName: relations.branch.name,
      branchCode: relations.branch.code,
      administrationId: grant.administrationId,
      administrationName: relations.administration?.name || null,
      administrationCode: relations.administration?.code || null,
      departmentId: grant.departmentId,
      departmentName: relations.department?.name || null,
      departmentCode: relations.department?.code || null,
      isDefault: grant.isDefault,
      source: grant.source,
    };
  }

  private toGrant(context: ActiveOperationalContext): OperationalAccessGrant {
    return {
      scopeId: context.scopeId,
      companyId: context.companyId,
      branchId: context.branchId,
      administrationId: context.administrationId,
      departmentId: context.departmentId,
      isDefault: context.isDefault,
      source: context.source,
    };
  }

  private deduplicateContexts(
    contexts: ActiveOperationalContext[],
  ): ActiveOperationalContext[] {
    const byKey = new Map<string, ActiveOperationalContext>();
    for (const context of contexts) {
      const existing = byKey.get(context.contextKey);
      if (!existing || (!existing.isDefault && context.isDefault)) {
        byKey.set(context.contextKey, context);
      }
    }
    return Array.from(byKey.values());
  }

  private markDefault(
    contexts: ActiveOperationalContext[],
  ): OperationalContextsResult {
    if (contexts.length === 0) {
      return { contexts: [], defaultContext: null };
    }
    const selected =
      contexts.find((context) => context.isDefault) || contexts[0];
    const normalized = contexts.map((context) => ({
      ...context,
      isDefault: context.contextKey === selected.contextKey,
    }));
    return {
      contexts: normalized,
      defaultContext:
        normalized.find(
          (context) => context.contextKey === selected.contextKey,
        ) || null,
    };
  }
}
