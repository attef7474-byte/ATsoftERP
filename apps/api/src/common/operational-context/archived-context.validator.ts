import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllowedContextResolver } from './allowed-context.resolver';
import {
  ArchivedOperationalContext,
  ArchivedOrganizationalAncestor,
  OperationalContextSelection,
  operationalContextKey,
  OrganizationalLevel,
  UserAuthorizationSnapshot,
} from './operational-context.types';

export interface ArchivedContextValidation {
  context: ArchivedOperationalContext;
  authorization: UserAuthorizationSnapshot;
}

interface ArchivableRecord {
  id: string;
  code?: string | null;
  name: string;
  status: string;
  deletedAt: Date | null;
}

/**
 * Resolves an archived (soft-deleted) organizational context for read-only
 * browsing.
 *
 * Rules:
 *  1. company and branch ids are mandatory and are never trusted from the
 *     client without structural validation;
 *  2. the referenced records must exist and be structurally consistent
 *     (branch belongs to company, administration belongs to branch,
 *     department belongs to company/branch, department administration link);
 *  3. at least one selected level must be soft-deleted, otherwise the request
 *     belongs to active mode (`archiveContext.notArchived`);
 *  4. ownership is re-validated server side: SUPER_ADMIN canonical bypass, or
 *     an explicit active operational scope / legacy assignment for the same
 *     company and branch;
 *  5. nothing is ever un-deleted, reactivated, or returned as the default
 *     active context.
 */
@Injectable()
export class ArchivedContextValidator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AllowedContextResolver,
  ) {}

  async validate(
    userId: string,
    selection: OperationalContextSelection,
  ): Promise<ArchivedContextValidation> {
    if (!selection.companyId) {
      this.reject('operationalContext.companyRequired');
    }
    if (!selection.branchId) {
      this.reject('operationalContext.branchRequired');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: selection.branchId, companyId: selection.companyId },
      include: { company: true },
    });
    if (!branch) {
      this.reject('operationalContext.invalidRelationship');
    }

    this.assertArchivable(branch.company);
    this.assertArchivable(branch);

    let administration: (ArchivableRecord & { branchId: string }) | null = null;
    if (selection.administrationId) {
      administration = await this.prisma.administration.findFirst({
        where: {
          id: selection.administrationId,
          branchId: branch.id,
        },
      });
      if (!administration) {
        this.reject('operationalContext.invalidRelationship');
      }
      this.assertArchivable(administration);
    }

    let department:
      | (ArchivableRecord & {
          companyId: string;
          branchId: string | null;
          administrationId: string | null;
          administration:
            | (ArchivableRecord & { branchId: string })
            | null;
        })
      | null = null;
    if (selection.departmentId) {
      department = await this.prisma.department.findFirst({
        where: {
          id: selection.departmentId,
          companyId: branch.companyId,
          branchId: branch.id,
        },
        include: { administration: true },
      });
      if (!department) {
        this.reject('operationalContext.invalidRelationship');
      }
      this.assertArchivable(department);
      if (department.administrationId) {
        if (department.administration) {
          this.assertArchivable(department.administration);
        }
        if (
          selection.administrationId &&
          department.administrationId !== selection.administrationId
        ) {
          this.reject('operationalContext.invalidRelationship');
        }
        if (!selection.administrationId && department.administration) {
          if (department.administration.branchId !== branch.id) {
            this.reject('operationalContext.invalidRelationship');
          }
          administration = department.administration;
        }
      }
    }

    const selected: {
      level: OrganizationalLevel;
      record: ArchivableRecord;
    }[] = [
      { level: 'company', record: branch.company },
      { level: 'branch', record: branch },
    ];
    if (administration) {
      selected.push({ level: 'administration', record: administration });
    }
    if (department) {
      selected.push({ level: 'department', record: department });
    }

    const archivedAncestors: ArchivedOrganizationalAncestor[] = selected
      .filter((entry) => entry.record.deletedAt !== null)
      .map((entry) => ({
        level: entry.level,
        id: entry.record.id,
        code: entry.record.code || '',
        name: entry.record.name,
        deletedAt: (entry.record.deletedAt as Date).toISOString(),
      }));
    if (archivedAncestors.length === 0) {
      this.reject('archiveContext.notArchived');
    }

    const access = await this.resolver.resolve(userId);
    const isSuperAdmin = access.authorization.isSuperAdmin;
    let source: ArchivedOperationalContext['source'] = 'SUPER_ADMIN';
    let scopeId: string | null = null;

    if (!isSuperAdmin) {
      const scope = await this.prisma.userOperationalScope.findFirst({
        where: {
          userId,
          companyId: branch.companyId,
          branchId: branch.id,
          status: 'ACTIVE',
          deletedAt: null,
        },
      });
      const legacyMatch =
        access.legacyCompanyId === branch.companyId &&
        access.legacyBranchId === branch.id;
      if (!scope && !legacyMatch) {
        this.reject('operationalContext.notAllowed');
      }
      scopeId = scope?.id || null;
      source = scope ? 'EXPLICIT_SCOPE' : 'LEGACY_USER_ASSIGNMENT';
    }

    const normalizedSelection = {
      companyId: branch.companyId,
      branchId: branch.id,
      administrationId: administration?.id || null,
      departmentId: department?.id || null,
    };

    const context: ArchivedOperationalContext = {
      contextKey: operationalContextKey(normalizedSelection),
      scopeId,
      companyId: branch.companyId,
      companyName: branch.company.name,
      companyCode: branch.company.code,
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      administrationId: normalizedSelection.administrationId,
      administrationName: administration?.name || null,
      administrationCode: administration?.code || null,
      departmentId: normalizedSelection.departmentId,
      departmentName: department?.name || null,
      departmentCode: department?.code || null,
      isDefault: false,
      source,
      isArchived: true,
      archivedAncestors,
    };

    return { context, authorization: access.authorization };
  }

  private assertArchivable(record: ArchivableRecord): void {
    if (record.deletedAt === null && record.status !== 'ACTIVE') {
      this.reject('operationalContext.invalidRelationship');
    }
  }

  private reject(messageKey: string): never {
    throw new ForbiddenException({ messageKey });
  }
}
