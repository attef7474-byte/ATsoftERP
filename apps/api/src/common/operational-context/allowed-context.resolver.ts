import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ARCHIVED_CONTEXT_DISCOVERY_LIMIT } from './archive-context.constants';
import {
  ActiveOperationalContext,
  ArchivedOrganizationalAncestor,
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

  /**
   * Archive browsing discovery: soft-deleted company/branch/administration/
   * department contexts this principal may still read, in read-only form.
   * Never returns a default context and never clears any archival marker.
   */
  async getArchivedContexts(userId: string): Promise<OperationalContextsResult> {
    const access = await this.resolve(userId);
    const isSuperAdmin = access.authorization.isSuperAdmin;

    const ownedPairs = new Set<string>();
    const ownedBranchIds: string[] | null = isSuperAdmin ? null : [];
    if (!isSuperAdmin) {
      const scopes = await this.prisma.userOperationalScope.findMany({
        where: { userId, status: 'ACTIVE', deletedAt: null },
        select: { companyId: true, branchId: true },
      });
      for (const scope of scopes) {
        ownedPairs.add(`${scope.companyId}:${scope.branchId}`);
        ownedBranchIds!.push(scope.branchId);
      }
      if (access.legacyCompanyId && access.legacyBranchId) {
        ownedPairs.add(`${access.legacyCompanyId}:${access.legacyBranchId}`);
        ownedBranchIds!.push(access.legacyBranchId);
      }
      if (ownedPairs.size === 0) return { contexts: [], defaultContext: null };
    }

    const owns = (companyId: string, branchId: string): boolean =>
      isSuperAdmin || ownedPairs.has(`${companyId}:${branchId}`);

    const branchIds = ownedBranchIds ? Array.from(new Set(ownedBranchIds)) : null;

    const limit = ARCHIVED_CONTEXT_DISCOVERY_LIMIT;
    const contexts: ActiveOperationalContext[] = [];

    const archivedBranches = await this.prisma.branch.findMany({
      where: {
        ...(branchIds ? { id: { in: branchIds } } : {}),
        OR: [
          { deletedAt: { not: null } },
          { company: { deletedAt: { not: null } } },
        ],
      },
      include: { company: true },
      orderBy: [{ company: { code: 'asc' } }, { code: 'asc' }],
      take: limit,
    });

    for (const branch of archivedBranches) {
      if (!owns(branch.companyId, branch.id)) continue;
      contexts.push(
        this.toArchivedContext(
          {
            scopeId: null,
            companyId: branch.companyId,
            branchId: branch.id,
            administrationId: null,
            departmentId: null,
            isDefault: false,
            source: isSuperAdmin ? 'SUPER_ADMIN' : 'EXPLICIT_SCOPE',
          },
          {
            company: branch.company,
            branch,
            administration: null,
            department: null,
          },
          [
            ...this.archivedAncestor('company', branch.company),
            ...this.archivedAncestor('branch', branch),
          ],
        ),
      );
    }

    const archivedAdministrations = await this.prisma.administration.findMany({
      where: {
        deletedAt: { not: null },
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      include: { branch: { include: { company: true } } },
      orderBy: [{ branch: { company: { code: 'asc' } } }, { code: 'asc' }],
      take: limit,
    });
    for (const administration of archivedAdministrations) {
      const branch = administration.branch;
      if (!branch || !owns(branch.companyId, branch.id)) continue;
      contexts.push(
        this.toArchivedContext(
          {
            scopeId: null,
            companyId: branch.companyId,
            branchId: branch.id,
            administrationId: administration.id,
            departmentId: null,
            isDefault: false,
            source: isSuperAdmin ? 'SUPER_ADMIN' : 'EXPLICIT_SCOPE',
          },
          {
            company: branch.company,
            branch,
            administration,
            department: null,
          },
          [
            ...this.archivedAncestor('company', branch.company),
            ...this.archivedAncestor('branch', branch),
            ...this.archivedAncestor('administration', administration),
          ],
        ),
      );
    }

    const archivedDepartments = await this.prisma.department.findMany({
      where: {
        deletedAt: { not: null },
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      include: {
        administration: true,
        branch: { include: { company: true } },
      },
      orderBy: [{ company: { code: 'asc' } }, { code: 'asc' }],
      take: limit,
    });
    for (const department of archivedDepartments) {
      const branch = department.branch;
      if (!branch || !owns(branch.companyId, branch.id)) continue;
      const administration = department.administration;
      contexts.push(
        this.toArchivedContext(
          {
            scopeId: null,
            companyId: branch.companyId,
            branchId: branch.id,
            administrationId: department.administrationId,
            departmentId: department.id,
            isDefault: false,
            source: isSuperAdmin ? 'SUPER_ADMIN' : 'EXPLICIT_SCOPE',
          },
          {
            company: branch.company,
            branch,
            administration,
            department,
          },
          [
            ...this.archivedAncestor('company', branch.company),
            ...this.archivedAncestor('branch', branch),
            ...this.archivedAncestor('administration', administration),
            ...this.archivedAncestor('department', department),
          ],
        ),
      );
    }

    const deduped = this.deduplicateContexts(contexts).slice(
      0,
      ARCHIVED_CONTEXT_DISCOVERY_LIMIT,
    );
    const levelRank: Record<string, number> = {
      company: 0,
      branch: 0,
      administration: 1,
      department: 2,
    };
    deduped.sort((a, b) => {
      const byCompany = a.companyCode.localeCompare(b.companyCode);
      if (byCompany !== 0) return byCompany;
      const byBranch = a.branchCode.localeCompare(b.branchCode);
      if (byBranch !== 0) return byBranch;
      const aLevel = a.departmentId
        ? levelRank.department
        : a.administrationId
          ? levelRank.administration
          : levelRank.company;
      const bLevel = b.departmentId
        ? levelRank.department
        : b.administrationId
          ? levelRank.administration
          : levelRank.company;
      if (aLevel !== bLevel) return aLevel - bLevel;
      return (a.departmentName || a.administrationName || '').localeCompare(
        b.departmentName || b.administrationName || '',
      );
    });

    return { contexts: deduped, defaultContext: null };
  }

  private archivedAncestor(
    level: ArchivedOrganizationalAncestor['level'],
    record: { id: string; code?: string | null; name: string; deletedAt: Date | null } | null,
  ): ArchivedOrganizationalAncestor[] {
    if (!record || record.deletedAt === null) return [];
    return [
      {
        level,
        id: record.id,
        code: record.code || '',
        name: record.name,
        deletedAt: record.deletedAt.toISOString(),
      },
    ];
  }

  private toArchivedContext(
    grant: OperationalAccessGrant,
    relations: ContextRelations,
    archivedAncestors: ArchivedOrganizationalAncestor[],
  ): ActiveOperationalContext {
    return {
      ...this.toContext(grant, relations),
      isDefault: false,
      isArchived: true,
      archivedAncestors,
    };
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
