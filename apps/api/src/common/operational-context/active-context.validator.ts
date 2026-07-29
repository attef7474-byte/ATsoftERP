import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllowedContextResolver } from './allowed-context.resolver';
import {
  ActiveOperationalContext,
  OperationalAccessGrant,
  OperationalContextSelection,
  operationalContextKey,
} from './operational-context.types';

@Injectable()
export class ActiveContextValidator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AllowedContextResolver,
  ) {}

  async validate(
    userId: string,
    selection: OperationalContextSelection,
  ): Promise<ActiveOperationalContext> {
    if (!selection.companyId) {
      this.reject('operationalContext.companyRequired');
    }
    if (!selection.branchId) {
      this.reject('operationalContext.branchRequired');
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: selection.branchId,
        companyId: selection.companyId,
        status: 'ACTIVE',
        deletedAt: null,
        company: { status: 'ACTIVE', deletedAt: null },
      },
      include: { company: true },
    });
    if (!branch) {
      this.reject('operationalContext.invalidRelationship');
    }

    const administration = selection.administrationId
      ? await this.prisma.administration.findFirst({
          where: {
            id: selection.administrationId,
            branchId: selection.branchId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        })
      : null;
    if (selection.administrationId && !administration) {
      this.reject('operationalContext.invalidRelationship');
    }

    const department = selection.departmentId
      ? await this.prisma.department.findFirst({
          where: {
            id: selection.departmentId,
            companyId: selection.companyId,
            branchId: selection.branchId,
            status: 'ACTIVE',
            deletedAt: null,
          },
          include: { administration: true },
        })
      : null;
    if (selection.departmentId && !department) {
      this.reject('operationalContext.invalidRelationship');
    }
    if (
      department?.administrationId &&
      (!department.administration ||
        department.administration.status !== 'ACTIVE' ||
        department.administration.deletedAt !== null)
    ) {
      this.reject('operationalContext.invalidRelationship');
    }
    if (
      department &&
      selection.administrationId &&
      department.administrationId !== selection.administrationId
    ) {
      this.reject('operationalContext.invalidRelationship');
    }

    const access = await this.resolver.resolve(userId);
    const grant = access.authorization.isSuperAdmin
      ? access.grants.find(
          (candidate) =>
            candidate.companyId === selection.companyId &&
            candidate.branchId === selection.branchId,
        )
      : access.grants.find((candidate) =>
          this.grantAllows(candidate, selection),
        );
    if (!grant) {
      this.reject('operationalContext.notAllowed');
    }

    const normalizedAdministration =
      administration ||
      (department?.administration &&
      department.administration.status === 'ACTIVE' &&
      department.administration.deletedAt == null
        ? department.administration
        : null);
    const normalizedSelection = {
      companyId: selection.companyId,
      branchId: selection.branchId,
      administrationId:
        normalizedAdministration?.id || selection.administrationId || null,
      departmentId: department?.id || selection.departmentId || null,
    };

    return {
      contextKey: operationalContextKey(normalizedSelection),
      scopeId: grant!.scopeId,
      companyId: selection.companyId,
      companyName: branch!.company.name,
      companyCode: branch!.company.code,
      branchId: selection.branchId,
      branchName: branch!.name,
      branchCode: branch!.code,
      administrationId: normalizedSelection.administrationId,
      administrationName: normalizedAdministration?.name || null,
      administrationCode: normalizedAdministration?.code || null,
      departmentId: normalizedSelection.departmentId,
      departmentName: department?.name || null,
      departmentCode: department?.code || null,
      isDefault:
        access.defaultContext?.contextKey ===
          operationalContextKey(normalizedSelection) ||
        (!!grant!.isDefault &&
          grant!.administrationId === normalizedSelection.administrationId &&
          grant!.departmentId === normalizedSelection.departmentId),
      source: grant!.source,
    };
  }

  private grantAllows(
    grant: OperationalAccessGrant,
    selection: OperationalContextSelection,
  ): boolean {
    if (
      grant.companyId !== selection.companyId ||
      grant.branchId !== selection.branchId
    ) {
      return false;
    }
    if (
      grant.administrationId &&
      grant.administrationId !== selection.administrationId
    ) {
      return false;
    }
    if (grant.departmentId && grant.departmentId !== selection.departmentId) {
      return false;
    }
    return true;
  }

  private reject(messageKey: string): never {
    throw new ForbiddenException({
      messageKey,
      message: messageKey,
    });
  }
}
