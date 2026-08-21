import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreatePersonAssignmentDto } from './dto/create-person-assignment.dto';
import { UpdatePersonAssignmentDto } from './dto/update-person-assignment.dto';
import { TransferPreviewDto } from './dto/transfer-preview.dto';
import { TransferApplyDto, RelationshipResolutionDto } from './dto/transfer-apply.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  assertBranchCompatible,
  DirectIntegrityRelationshipSnapshot,
  SupervisorAssignmentsService,
} from '../supervisor-assignments/supervisor-assignments.service';
import { Prisma } from '@prisma/client';

const LEADERSHIP_LEVELS = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'] as const;
const LEADERSHIP_REQUIRES_DEPARTMENT = ['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD'] as const;

@Injectable()
export class PersonAssignmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private supervisorAssignmentsService: SupervisorAssignmentsService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private validateLeadershipLevel(level: string | undefined): string {
    const resolved = level ?? 'NONE';
    if (!LEADERSHIP_LEVELS.includes(resolved as any)) {
      throw this.validationError('leadershipLevel', 'validation.invalidValue', `Invalid leadershipLevel. Allowed: ${LEADERSHIP_LEVELS.join(', ')}`);
    }
    return resolved;
  }

  private validateLeadershipStructure(level: string, dto: any) {
    if ((LEADERSHIP_REQUIRES_DEPARTMENT as readonly string[]).includes(level)) {
      if (!dto.departmentId) {
        throw this.validationError('leadershipLevel', 'validation.leadershipDepartmentRequired', `${level} requires a departmentId`);
      }
    }
    if (level === 'ADMINISTRATION_MANAGER') {
      if (!dto.administrationId) {
        throw this.validationError('leadershipLevel', 'validation.leadershipAdministrationRequired', 'ADMINISTRATION_MANAGER requires an administrationId');
      }
    }
  }

  private async enforceLeadershipUniqueness(
    level: string,
    assignmentType: string,
    departmentId: string | undefined,
    administrationId: string | undefined,
    effectiveFrom: string,
    effectiveTo?: string | null,
    excludeId?: string,
    companyId?: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (level === 'NONE' || level === 'TEAM_LEAD' || level === 'SUPERVISOR') return;

    if (level === 'DEPARTMENT_HEAD' && (assignmentType === 'PRIMARY' || assignmentType === 'ACTING') && departmentId) {
      await this.checkExistingLeadershipHolder(level, assignmentType, 'departmentId', departmentId, effectiveFrom, effectiveTo, excludeId, companyId, client);
    }

    if (level === 'ADMINISTRATION_MANAGER' && (assignmentType === 'PRIMARY' || assignmentType === 'ACTING') && administrationId) {
      await this.checkExistingLeadershipHolder(level, assignmentType, 'administrationId', administrationId, effectiveFrom, effectiveTo, excludeId, companyId, client);
    }
  }

  private async checkExistingLeadershipHolder(
    level: string,
    assignmentType: string,
    scopeField: string,
    scopeId: string,
    effectiveFrom: string,
    effectiveTo?: string | null,
    excludeId?: string,
    companyId?: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const effectiveFromDate = new Date(effectiveFrom);
    const effectiveToDate = effectiveTo ? new Date(effectiveTo) : null;

    const where: any = {
      leadershipLevel: level,
      assignmentType,
      deletedAt: null,
      [scopeField]: scopeId,
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: effectiveFromDate } },
      ],
    };
    if (companyId) where.companyId = companyId;
    if (effectiveToDate) where.effectiveFrom = { lt: effectiveToDate };
    if (excludeId) where.NOT = { id: excludeId };

    const existing = await (client as any).operationalPersonAssignment.findFirst({ where });
    if (existing) {
      const scopeLabel = scopeField === 'departmentId' ? 'Department' : 'Administration';
      const typeLabel = assignmentType === 'ACTING' ? 'ACTING' : 'PRIMARY';
      throw this.validationError(
        'leadershipLevel',
        level === 'ADMINISTRATION_MANAGER' ? 'validation.primaryAdministrationManagerOverlap' : 'validation.primaryDepartmentHeadOverlap',
        `Only one current effective ${typeLabel} ${level} is allowed per ${scopeLabel}`,
      );
    }
  }

  async create(dto: CreatePersonAssignmentDto, ctx: ActiveOperationalContext, userId?: string) {
    await this.validateReferences(dto, ctx);

    if (dto.effectiveTo && dto.effectiveTo < dto.effectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');
    }

    const assignmentType = dto.assignmentType ?? 'PRIMARY';
    const leadershipLevel = this.validateLeadershipLevel(dto.leadershipLevel);

    this.validateLeadershipStructure(leadershipLevel, dto);

    if (assignmentType === 'PRIMARY') {
      await this.enforceSinglePrimary(dto.personnelId, dto.effectiveFrom, dto.effectiveTo, undefined, ctx.companyId);
    }

    await this.enforceLeadershipUniqueness(leadershipLevel, assignmentType, dto.departmentId, dto.administrationId, dto.effectiveFrom, dto.effectiveTo, undefined, ctx.companyId);

    const assignment = await this.prisma.operationalPersonAssignment.create({
      data: {
        companyId: ctx.companyId,
        branchId: dto.branchId ?? ctx.branchId ?? null,
        administrationId: dto.administrationId ?? null,
        departmentId: dto.departmentId,
        jobTitleId: dto.jobTitleId ?? null,
        personnelId: dto.personnelId,
        assignmentType,
        leadershipLevel,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        notes: dto.notes ?? null,
        createdByUserId: userId ?? null,
      },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
        administration: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        person: { select: { id: true, name: true, code: true } },
      },
    });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'CREATE',
      entity: 'OperationalPersonAssignment',
      entityId: assignment.id,
      details: JSON.stringify({ personnelId: dto.personnelId, departmentId: dto.departmentId, assignmentType, leadershipLevel, companyId: ctx.companyId }),
    });

    return assignment;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; personnelId?: string; departmentId?: string; branchId?: string; assignmentType?: string; leadershipLevel?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (query.personnelId) where.personnelId = query.personnelId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.assignmentType) where.assignmentType = query.assignmentType;
    if (query.leadershipLevel) where.leadershipLevel = query.leadershipLevel;
    if (query.search) {
      where.OR = [
        { person: { name: { contains: query.search } } },
        { person: { code: { contains: query.search } } },
        { department: { name: { contains: query.search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.operationalPersonAssignment.findMany({
        where, skip, take: limit, orderBy: { effectiveFrom: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true, code: true } },
          jobTitle: { select: { id: true, name: true, code: true } },
          person: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.operationalPersonAssignment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const assignment = await this.prisma.operationalPersonAssignment.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
        administration: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        person: { select: { id: true, name: true, code: true } },
        supervisorAssignments: {
          where: { deletedAt: null },
          select: { id: true, relationshipType: true, effectiveFrom: true, effectiveTo: true, isActive: true },
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException({ messageKey: 'organization.assignmentNotFound', message: 'Person assignment not found' });
    }
    return assignment;
  }

  async update(id: string, dto: UpdatePersonAssignmentDto, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);

    const data: any = {};
    if (dto.branchId !== undefined) data.branchId = dto.branchId ?? null;
    if (dto.administrationId !== undefined) data.administrationId = dto.administrationId ?? null;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.jobTitleId !== undefined) data.jobTitleId = dto.jobTitleId ?? null;
    if (dto.assignmentType !== undefined) data.assignmentType = dto.assignmentType;
    if (dto.effectiveFrom !== undefined) data.effectiveFrom = new Date(dto.effectiveFrom);
    if (dto.effectiveTo !== undefined) data.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;

    if (dto.leadershipLevel !== undefined) {
      data.leadershipLevel = this.validateLeadershipLevel(dto.leadershipLevel);
    }

    if (data.departmentId || data.jobTitleId) {
      await this.validateReferences({ ...existing, ...dto } as any, ctx);
    }

    if (data.assignmentType === 'PRIMARY' || (existing.assignmentType === 'PRIMARY' && !data.assignmentType)) {
      const effectiveFrom = data.effectiveFrom ?? existing.effectiveFrom;
      const effectiveTo = data.effectiveTo ?? existing.effectiveTo;
      await this.enforceSinglePrimary(existing.personnelId, effectiveFrom.toISOString(), effectiveTo?.toISOString(), id, ctx.companyId);
    }

    const finalLevel = data.leadershipLevel ?? existing.leadershipLevel ?? 'NONE';
    const finalType = data.assignmentType ?? existing.assignmentType;
    const finalDept = data.departmentId ?? existing.departmentId;
    const finalAdmin = data.administrationId ?? existing.administrationId;
    const finalFrom = data.effectiveFrom ?? existing.effectiveFrom;
    const finalTo = data.effectiveTo !== undefined ? data.effectiveTo : existing.effectiveTo;

    if (finalLevel !== 'NONE') {
      this.validateLeadershipStructure(finalLevel, { departmentId: finalDept, administrationId: finalAdmin });
      await this.enforceLeadershipUniqueness(finalLevel, finalType, finalDept, finalAdmin, finalFrom.toISOString(), finalTo?.toISOString(), id, ctx.companyId);
    }

    const assignment = await this.prisma.operationalPersonAssignment.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        person: { select: { id: true, name: true, code: true } },
      },
    });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'UPDATE',
      entity: 'OperationalPersonAssignment',
      entityId: id,
      details: JSON.stringify({ ...dto, companyId: ctx.companyId }),
    });

    return assignment;
  }

  async remove(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const assignment = await this.findOne(id, ctx);

    const supervisorCount = await this.prisma.supervisorAssignment.count({
      where: { OR: [{ assignmentId: id }, { supervisorAssignmentId: id }], deletedAt: null },
    });
    if (supervisorCount > 0) {
      throw this.validationError('assignmentId', 'validation.hasDependencies', 'Cannot delete assignment with active supervisor relationships');
    }

    await this.prisma.operationalPersonAssignment.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'DELETE',
      entity: 'OperationalPersonAssignment',
      entityId: id,
      details: JSON.stringify({ personnelId: assignment.personnelId, departmentId: assignment.departmentId, companyId: ctx.companyId }),
    });

    return { message: 'Person assignment deleted successfully' };
  }

  async transfer(id: string, dto: TransferApplyDto, ctx: ActiveOperationalContext, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOneWithClient(tx, id, ctx);
      const { transferDate, newEffectiveTo } = this.validateTransferWindow(current, dto);

      await this.validateReferences({ ...current, ...dto } as any, ctx, tx);

      const transferType = dto.assignmentType ?? 'PRIMARY';
      const transferLeadership = this.validateLeadershipLevel(dto.leadershipLevel);
      if (transferLeadership !== 'NONE') {
        this.validateLeadershipStructure(transferLeadership, {
          departmentId: dto.departmentId,
          administrationId: dto.administrationId ?? current.administrationId,
        });
        await this.enforceLeadershipUniqueness(
          transferLeadership,
          transferType,
          dto.departmentId,
          dto.administrationId ?? current.administrationId ?? undefined,
          dto.effectiveFrom,
          dto.effectiveTo,
          id,
          ctx.companyId,
          tx,
        );
      }

      const affectedRelationships = await this.discoverAffectedRelationships(id, transferDate, ctx, tx);
      const resolutions = dto.relationshipResolutions ?? [];
      this.validateResolutions(resolutions, affectedRelationships);

      const requiredGraphPermissions = ['supervisor:remove'];
      if (resolutions.some((resolution) => resolution.action === 'CONTINUE_ON_NEW_ASSIGNMENT')) {
        requiredGraphPermissions.push('supervisor:assign');
      }
      if (resolutions.length > 0) {
        await this.assertUserPermissions(tx, userId, requiredGraphPermissions);
      }

      const proposedPlacement = this.buildProposedPlacement(current, dto, ctx, transferDate, newEffectiveTo);
      const retiringRelationshipIds = affectedRelationships
        .filter((relationship) => relationship.temporalCategory !== 'HISTORICAL')
        .map((relationship) => relationship.id);
      const plannedDirectRelationships: DirectIntegrityRelationshipSnapshot[] = [];
      for (const resolution of resolutions) {
        if (resolution.action !== 'CONTINUE_ON_NEW_ASSIGNMENT') continue;
        const relationship = affectedRelationships.find((candidate) => candidate.id === resolution.relationshipId)!;
        const blockedReason = await this.getContinuationBlockedReason(
          tx,
          relationship,
          proposedPlacement,
          ctx,
          retiringRelationshipIds,
          plannedDirectRelationships,
        );
        if (blockedReason) {
          throw this.validationError('relationshipResolutions', blockedReason, `Relationship ${relationship.id} cannot continue on the proposed assignment`);
        }
        if (relationship.relationshipType === 'DIRECT') {
          plannedDirectRelationships.push(this.buildPlannedDirectRelationship(relationship, proposedPlacement, transferDate));
        }
      }

      const closed = await tx.operationalPersonAssignment.updateMany({
        where: { id, companyId: ctx.companyId, deletedAt: null, effectiveTo: null },
        data: { effectiveTo: transferDate },
      });
      if (closed.count !== 1) {
        throw this.validationError('assignmentId', 'validation.staleTransfer', 'Assignment changed while the transfer was being applied');
      }

      if (transferType === 'PRIMARY') {
        await this.enforceSinglePrimaryInTx(tx, current.personnelId, dto.effectiveFrom, dto.effectiveTo, ctx.companyId);
      }

      const newAssignment = await tx.operationalPersonAssignment.create({
        data: {
          companyId: ctx.companyId,
          branchId: proposedPlacement.branchId,
          administrationId: proposedPlacement.administrationId,
          departmentId: proposedPlacement.departmentId,
          jobTitleId: proposedPlacement.jobTitleId,
          personnelId: current.personnelId,
          assignmentType: transferType,
          leadershipLevel: transferLeadership,
          effectiveFrom: transferDate,
          effectiveTo: newEffectiveTo,
          notes: dto.notes ?? null,
          createdByUserId: userId ?? null,
        },
        include: {
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true, code: true } },
          jobTitle: { select: { id: true, name: true, code: true } },
          person: { select: { id: true, name: true, code: true } },
        },
      });

      await this.auditService.logWithClient(tx, {
        userId: userId ?? 'system',
        action: 'TRANSFER_ASSIGNMENT_CLOSE',
        entity: 'OperationalPersonAssignment',
        entityId: id,
        details: {
          companyId: ctx.companyId,
          branchId: current.branchId,
          effectiveDate: transferDate.toISOString(),
          previousValues: { effectiveTo: current.effectiveTo, leadershipLevel: current.leadershipLevel },
          newValues: { effectiveTo: transferDate, leadershipLevel: current.leadershipLevel },
        },
      });
      await this.auditService.logWithClient(tx, {
        userId: userId ?? 'system',
        action: 'TRANSFER_ASSIGNMENT_CREATE',
        entity: 'OperationalPersonAssignment',
        entityId: newAssignment.id,
        details: {
          companyId: ctx.companyId,
          branchId: proposedPlacement.branchId,
          effectiveDate: transferDate.toISOString(),
          oldAssignmentId: id,
          newValues: {
            departmentId: proposedPlacement.departmentId,
            administrationId: proposedPlacement.administrationId,
            jobTitleId: proposedPlacement.jobTitleId,
            assignmentType: transferType,
            leadershipLevel: transferLeadership,
            effectiveFrom: transferDate,
            effectiveTo: newEffectiveTo,
          },
        },
      });

      let endedCount = 0;
      let continuedCount = 0;
      for (const resolution of resolutions) {
        const relationship = affectedRelationships.find((candidate) => candidate.id === resolution.relationshipId)!;
        const retired = await this.retireRelationshipInTx(tx, relationship, transferDate, ctx);
        await this.auditService.logWithClient(tx, {
          userId: userId ?? 'system',
          action: relationship.temporalCategory === 'FUTURE'
            ? 'TRANSFER_RELATIONSHIP_CANCEL_FUTURE'
            : 'TRANSFER_RELATIONSHIP_END',
          entity: 'SupervisorAssignment',
          entityId: relationship.id,
          details: {
            companyId: ctx.companyId,
            branchId: current.branchId,
            effectiveDate: transferDate.toISOString(),
            transferAssignmentId: id,
            newAssignmentId: newAssignment.id,
            resolutionAction: resolution.action,
            direction: relationship.direction,
            relationshipType: relationship.relationshipType,
            previousValues: {
              effectiveFrom: relationship.effectiveFrom,
              effectiveTo: relationship.effectiveTo,
              isActive: relationship.isActive,
            },
            newValues: retired,
          },
        });
        if (resolution.action === 'END_AT_TRANSFER') endedCount++;
      }

      for (const resolution of resolutions) {
        if (resolution.action !== 'CONTINUE_ON_NEW_ASSIGNMENT') continue;
        const relationship = affectedRelationships.find((candidate) => candidate.id === resolution.relationshipId)!;
        const newRelationship = await this.createContinuationInTx(
          tx,
          relationship,
          newAssignment.id,
          transferDate,
          ctx,
        );
        await this.auditService.logWithClient(tx, {
          userId: userId ?? 'system',
          action: 'TRANSFER_RELATIONSHIP_CONTINUE',
          entity: 'SupervisorAssignment',
          entityId: newRelationship.id,
          details: {
            companyId: ctx.companyId,
            branchId: proposedPlacement.branchId,
            effectiveDate: transferDate.toISOString(),
            transferAssignmentId: id,
            newAssignmentId: newAssignment.id,
            oldRelationshipId: relationship.id,
            direction: relationship.direction,
            relationshipType: relationship.relationshipType,
            previousValues: {
              assignmentId: relationship.direction === 'INBOUND' ? id : relationship.otherParty.assignmentId,
              supervisorAssignmentId: relationship.direction === 'INBOUND' ? relationship.otherParty.assignmentId : id,
              effectiveFrom: relationship.effectiveFrom,
              effectiveTo: relationship.effectiveTo,
            },
            newValues: {
              assignmentId: newRelationship.assignmentId,
              supervisorAssignmentId: newRelationship.supervisorAssignmentId,
              effectiveFrom: newRelationship.effectiveFrom,
              effectiveTo: newRelationship.effectiveTo,
            },
          },
        });
        continuedCount++;
      }

      await this.auditService.logWithClient(tx, {
        userId: userId ?? 'system',
        action: 'TRANSFER',
        entity: 'OperationalPersonAssignment',
        entityId: id,
        details: {
          companyId: ctx.companyId,
          branchId: current.branchId,
          effectiveDate: transferDate.toISOString(),
          oldAssignmentId: id,
          newAssignmentId: newAssignment.id,
          fromDepartmentId: current.departmentId,
          toDepartmentId: proposedPlacement.departmentId,
          personnelId: current.personnelId,
          relationshipsEnded: endedCount,
          relationshipsContinued: continuedCount,
        },
      });

      return { newAssignment, relationshipsEnded: endedCount, relationshipsContinued: continuedCount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async transferPreview(
    id: string,
    dto: TransferPreviewDto,
    ctx: ActiveOperationalContext,
    userId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => this.transferPreviewWithClient(tx, id, dto, ctx, userId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async transferPreviewWithClient(
    client: Prisma.TransactionClient,
    id: string,
    dto: TransferPreviewDto,
    ctx: ActiveOperationalContext,
    userId?: string,
  ) {
    const current = await this.findOneWithClient(client, id, ctx);
    const { transferDate, newEffectiveTo } = this.validateTransferWindow(current, dto);
    await this.validateReferences({ ...current, ...dto } as any, ctx, client);

    const transferLeadership = this.validateLeadershipLevel(dto.leadershipLevel);
    if (transferLeadership !== 'NONE') {
      this.validateLeadershipStructure(transferLeadership, {
        departmentId: dto.departmentId,
        administrationId: dto.administrationId ?? current.administrationId,
      });
      await this.enforceLeadershipUniqueness(
        transferLeadership,
        dto.assignmentType ?? 'PRIMARY',
        dto.departmentId,
        dto.administrationId ?? current.administrationId ?? undefined,
        dto.effectiveFrom,
        dto.effectiveTo,
        id,
        ctx.companyId,
        client,
      );
    }

    const affectedRelationships = await this.discoverAffectedRelationships(id, transferDate, ctx, client);
    if (affectedRelationships.length > 0) {
      await this.assertUserPermissions(client, userId, ['supervisor:read']);
    }

    const proposedPlacement = this.buildProposedPlacement(current, dto, ctx, transferDate, newEffectiveTo);
    const retiringRelationshipIds = affectedRelationships
      .filter((relationship) => relationship.temporalCategory !== 'HISTORICAL')
      .map((relationship) => relationship.id);
    for (const relationship of affectedRelationships) {
      if (relationship.temporalCategory === 'HISTORICAL') {
        relationship.allowedResolutions = [];
        continue;
      }
      relationship.allowedResolutions = ['END_AT_TRANSFER'];
      const blockedReason = await this.getContinuationBlockedReason(
        client,
        relationship,
        proposedPlacement,
        ctx,
        retiringRelationshipIds,
      );
      relationship.continuationBlockedReason = blockedReason;
      if (!blockedReason) {
        relationship.allowedResolutions.push('CONTINUE_ON_NEW_ASSIGNMENT');
      }
    }

    const historicalUnaffected = affectedRelationships.filter(r => r.temporalCategory === 'HISTORICAL').length;
    const currentInbound = affectedRelationships.filter(r => r.direction === 'INBOUND' && r.temporalCategory === 'CURRENT').length;
    const currentOutbound = affectedRelationships.filter(r => r.direction === 'OUTBOUND' && r.temporalCategory === 'CURRENT').length;
    const futureInbound = affectedRelationships.filter(r => r.direction === 'INBOUND' && r.temporalCategory === 'FUTURE').length;
    const futureOutbound = affectedRelationships.filter(r => r.direction === 'OUTBOUND' && r.temporalCategory === 'FUTURE').length;

    return {
      oldAssignment: {
        id: current.id,
        person: current.person,
        department: current.department,
        jobTitle: current.jobTitle,
        branch: current.branch,
        administration: current.administration,
        assignmentType: current.assignmentType,
        leadershipLevel: current.leadershipLevel,
        effectiveFrom: current.effectiveFrom,
        effectiveTo: current.effectiveTo,
      },
      proposedNewAssignment: {
        departmentId: proposedPlacement.departmentId,
        branchId: proposedPlacement.branchId,
        administrationId: proposedPlacement.administrationId,
        jobTitleId: proposedPlacement.jobTitleId,
        assignmentType: proposedPlacement.assignmentType,
        leadershipLevel: proposedPlacement.leadershipLevel,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
      },
      transferDate: dto.effectiveFrom,
      summary: {
        historicalUnaffected,
        currentInbound,
        currentOutbound,
        futureInbound,
        futureOutbound,
        directCount: affectedRelationships.filter(r => r.relationshipType === 'DIRECT').length,
        matrixCount: affectedRelationships.filter(r => r.relationshipType === 'MATRIX').length,
        functionalCount: affectedRelationships.filter(r => r.relationshipType === 'FUNCTIONAL').length,
        totalAffected: currentInbound + currentOutbound + futureInbound + futureOutbound,
      },
      affectedRelationships,
    };
  }

  private async findOneWithClient(
    client: PrismaService | Prisma.TransactionClient,
    id: string,
    ctx: ActiveOperationalContext,
  ) {
    const assignment = await (client as any).operationalPersonAssignment.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
        administration: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        person: { select: { id: true, name: true, code: true } },
      },
    });
    if (!assignment) {
      throw new NotFoundException({ messageKey: 'organization.assignmentNotFound', message: 'Person assignment not found' });
    }
    return assignment;
  }

  private validateTransferWindow(current: any, dto: TransferPreviewDto | TransferApplyDto) {
    if (current.assignmentType !== 'PRIMARY') {
      throw this.validationError('assignmentId', 'validation.invalidOperation', 'Transfer is only available for PRIMARY assignments');
    }
    if (current.effectiveTo) {
      throw this.validationError('assignmentId', 'validation.invalidOperation', 'Cannot transfer an already closed assignment');
    }

    const transferDate = new Date(dto.effectiveFrom);
    if (Number.isNaN(transferDate.getTime()) || transferDate <= current.effectiveFrom) {
      throw this.validationError('effectiveFrom', 'validation.invalidRange', 'Transfer date must be after the original assignment start date');
    }
    const newEffectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (newEffectiveTo && (Number.isNaN(newEffectiveTo.getTime()) || newEffectiveTo <= transferDate)) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'New assignment effectiveTo must be after the transfer date');
    }
    return { transferDate, newEffectiveTo };
  }

  private buildProposedPlacement(
    current: any,
    dto: TransferPreviewDto | TransferApplyDto,
    ctx: ActiveOperationalContext,
    effectiveFrom: Date,
    effectiveTo: Date | null,
  ) {
    return {
      id: '__PROPOSED_TRANSFER_ASSIGNMENT__',
      companyId: ctx.companyId,
      branchId: dto.branchId ?? current.branchId ?? ctx.branchId ?? null,
      administrationId: dto.administrationId ?? current.administrationId ?? null,
      departmentId: dto.departmentId,
      jobTitleId: dto.jobTitleId ?? current.jobTitleId ?? null,
      personnelId: current.personnelId,
      assignmentType: dto.assignmentType ?? 'PRIMARY',
      leadershipLevel: dto.leadershipLevel ?? 'NONE',
      effectiveFrom,
      effectiveTo,
    };
  }

  private async assertUserPermissions(
    client: PrismaService | Prisma.TransactionClient,
    userId: string | undefined,
    requiredPermissions: string[],
  ): Promise<void> {
    if (requiredPermissions.length === 0) return;
    if (!userId) {
      throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
    }
    const userRoles = await (client as any).userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    const granted = new Set<string>();
    for (const userRole of userRoles) {
      if (userRole.role?.status !== 'ACTIVE') continue;
      if (userRole.role.code === 'SUPER_ADMIN') return;
      for (const rolePermission of userRole.role.permissions ?? []) {
        if (rolePermission.permission?.status === 'ACTIVE') granted.add(rolePermission.permission.key);
      }
    }
    if (!requiredPermissions.every((permission) => granted.has(permission))) {
      throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
    }
  }

  private assignmentWindowBlockReason(
    assignment: { effectiveFrom: Date; effectiveTo: Date | null },
    effectiveFrom: Date,
    effectiveTo: Date | null,
  ): string | null {
    if (effectiveFrom < assignment.effectiveFrom) return 'validation.assignmentOutOfRange';
    if (assignment.effectiveTo && effectiveFrom >= assignment.effectiveTo) return 'validation.assignmentOutOfRange';
    if (assignment.effectiveTo && (!effectiveTo || effectiveTo > assignment.effectiveTo)) return 'validation.assignmentOutOfRange';
    return null;
  }

  private async getContinuationBlockedReason(
    client: PrismaService | Prisma.TransactionClient,
    relationship: any,
    proposedPlacement: any,
    ctx: ActiveOperationalContext,
    retiringRelationshipIds: string[],
    plannedDirectRelationships: DirectIntegrityRelationshipSnapshot[] = [],
  ): Promise<string | null> {
    const effectiveFrom = relationship.temporalCategory === 'FUTURE'
      ? relationship.effectiveFrom
      : proposedPlacement.effectiveFrom;
    const effectiveTo = relationship.effectiveTo;
    if (effectiveTo && effectiveTo <= effectiveFrom) return 'validation.invalidRange';

    if (relationship.direction === 'INBOUND' && !relationship.otherParty.assignmentId) {
      try {
        await this.supervisorAssignmentsService.assertDirectIntegrityWithClient(client, {
          companyId: ctx.companyId,
          assignmentId: proposedPlacement.id,
          supervisorAssignmentId: null,
          effectiveFrom,
          effectiveTo,
          assignmentSnapshot: proposedPlacement,
          excludeRelationshipIds: retiringRelationshipIds,
          plannedDirectRelationships,
        });
        return null;
      } catch (error) {
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as any;
          return response?.errors?.[0]?.code ?? 'validation.invalidResolution';
        }
        throw error;
      }
    }

    const otherAssignment = await (client as any).operationalPersonAssignment.findFirst({
      where: { id: relationship.otherParty.assignmentId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!otherAssignment) return 'validation.invalidReference';

    const subordinate = relationship.direction === 'INBOUND' ? proposedPlacement : otherAssignment;
    const supervisor = relationship.direction === 'INBOUND' ? otherAssignment : proposedPlacement;

    if (relationship.relationshipType === 'DIRECT') {
      try {
        await this.supervisorAssignmentsService.assertDirectIntegrityWithClient(client, {
          companyId: ctx.companyId,
          assignmentId: subordinate.id,
          supervisorAssignmentId: supervisor.id,
          effectiveFrom,
          effectiveTo,
          assignmentSnapshot: subordinate,
          supervisorAssignmentSnapshot: supervisor,
          excludeRelationshipIds: retiringRelationshipIds,
          plannedDirectRelationships,
        });
        return null;
      } catch (error) {
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as any;
          return response?.errors?.[0]?.code ?? 'validation.invalidResolution';
        }
        throw error;
      }
    }

    const subordinateWindowError = this.assignmentWindowBlockReason(subordinate, effectiveFrom, effectiveTo);
    if (subordinateWindowError) return subordinateWindowError;
    const supervisorWindowError = this.assignmentWindowBlockReason(supervisor, effectiveFrom, effectiveTo);
    if (supervisorWindowError) return supervisorWindowError;

    if (subordinate.personnelId === supervisor.personnelId) return 'validation.selfReference';
    try {
      assertBranchCompatible(subordinate.branchId ?? null, supervisor.branchId ?? null);
    } catch {
      return 'validation.invalidBranchHierarchy';
    }

    return null;
  }

  private buildPlannedDirectRelationship(
    relationship: any,
    proposedPlacement: any,
    transferDate: Date,
  ): DirectIntegrityRelationshipSnapshot {
    const effectiveFrom = relationship.temporalCategory === 'FUTURE'
      ? relationship.effectiveFrom
      : transferDate;
    return {
      assignmentId: relationship.direction === 'INBOUND'
        ? proposedPlacement.id
        : relationship.otherParty.assignmentId,
      supervisorAssignmentId: relationship.direction === 'INBOUND'
        ? relationship.otherParty.assignmentId
        : proposedPlacement.id,
      effectiveFrom,
      effectiveTo: relationship.effectiveTo,
    };
  }

  private async discoverAffectedRelationships(
    assignmentId: string,
    transferDate: Date,
    ctx: ActiveOperationalContext,
    client: PrismaService | Prisma.TransactionClient,
  ) {
    const inbound = await (client as any).supervisorAssignment.findMany({
      where: {
        assignmentId,
        companyId: ctx.companyId,
        deletedAt: null,
      },
      include: {
        supervisorAssignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobTitle: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true } },
            administration: { select: { id: true, name: true } },
          },
        },
      },
    });

    const outbound = await (client as any).supervisorAssignment.findMany({
      where: {
        supervisorAssignmentId: assignmentId,
        companyId: ctx.companyId,
        deletedAt: null,
      },
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
            jobTitle: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true } },
            administration: { select: { id: true, name: true } },
          },
        },
      },
    });

    const allRelationships: any[] = [];

    for (const rel of inbound) {
      if (rel.supervisorAssignmentId && rel.supervisorAssignment?.companyId !== ctx.companyId) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidReference',
          `Relationship ${rel.id} references a supervisor assignment outside the active company`,
        );
      }
      const temporalCategory = this.classifyTemporalCategory(rel, transferDate);
      allRelationships.push({
        id: rel.id,
        direction: 'INBOUND' as const,
        relationshipType: rel.relationshipType,
        effectiveFrom: rel.effectiveFrom,
        effectiveTo: rel.effectiveTo,
        isActive: rel.isActive,
        temporalCategory,
        otherParty: {
          person: rel.supervisorAssignment?.person,
          jobTitle: rel.supervisorAssignment?.jobTitle,
          department: rel.supervisorAssignment?.department,
          branch: rel.supervisorAssignment?.branch,
          administration: rel.supervisorAssignment?.administration,
          assignmentType: rel.supervisorAssignment?.assignmentType,
          leadershipLevel: rel.supervisorAssignment?.leadershipLevel,
          assignmentId: rel.supervisorAssignmentId,
        },
        allowedResolutions: this.getAllowedResolutions(temporalCategory),
      });
    }

    for (const rel of outbound) {
      if (!rel.assignment || rel.assignment.companyId !== ctx.companyId) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidReference',
          `Relationship ${rel.id} references a subordinate assignment outside the active company`,
        );
      }
      const temporalCategory = this.classifyTemporalCategory(rel, transferDate);
      allRelationships.push({
        id: rel.id,
        direction: 'OUTBOUND' as const,
        relationshipType: rel.relationshipType,
        effectiveFrom: rel.effectiveFrom,
        effectiveTo: rel.effectiveTo,
        isActive: rel.isActive,
        temporalCategory,
        otherParty: {
          person: rel.assignment?.person,
          jobTitle: rel.assignment?.jobTitle,
          department: rel.assignment?.department,
          branch: rel.assignment?.branch,
          administration: rel.assignment?.administration,
          assignmentType: rel.assignment?.assignmentType,
          leadershipLevel: rel.assignment?.leadershipLevel,
          assignmentId: rel.assignmentId,
        },
        allowedResolutions: this.getAllowedResolutions(temporalCategory),
      });
    }

    return allRelationships;
  }

  private classifyTemporalCategory(
    rel: { effectiveFrom: Date; effectiveTo: Date | null; isActive: boolean; deletedAt: Date | null },
    transferDate: Date,
  ): string {
    if (!rel.isActive || (rel.effectiveTo && rel.effectiveTo <= transferDate)) {
      return 'HISTORICAL';
    }
    if (rel.effectiveFrom >= transferDate) {
      return 'FUTURE';
    }
    return 'CURRENT';
  }

  private getAllowedResolutions(temporalCategory: string): string[] {
    switch (temporalCategory) {
      case 'CURRENT':
        return ['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'];
      case 'FUTURE':
        return ['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'];
      case 'HISTORICAL':
        return [];
      default:
        return [];
    }
  }

  private validateResolutions(
    resolutions: RelationshipResolutionDto[],
    affectedRelationships: any[],
  ) {
    const affectedNonHistorical = affectedRelationships.filter(r => r.temporalCategory !== 'HISTORICAL');
    const affectedIds = new Set(affectedNonHistorical.map((r: any) => r.id));
    const resolutionIds = new Set<string>();

    for (const resolution of resolutions) {
      if (resolutionIds.has(resolution.relationshipId)) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.duplicateResolution',
          `Relationship ${resolution.relationshipId} has more than one resolution`,
        );
      }
      resolutionIds.add(resolution.relationshipId);
      if (!affectedIds.has(resolution.relationshipId)) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.foreignResolution',
          `Resolution references relationship ${resolution.relationshipId} which is not affected by this transfer`,
        );
      }

      if (!['END_AT_TRANSFER', 'CONTINUE_ON_NEW_ASSIGNMENT'].includes(resolution.action)) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidResolution',
          `Action ${resolution.action} is not allowed for relationship ${resolution.relationshipId}`,
        );
      }
    }

    for (const affected of affectedNonHistorical) {
      if (!resolutionIds.has(affected.id)) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.missingResolution',
          `Relationship ${affected.id} (${affected.direction}, ${affected.relationshipType}) requires a resolution`,
        );
      }
    }
  }

  private async retireRelationshipInTx(
    tx: Prisma.TransactionClient,
    relationship: any,
    transferDate: Date,
    ctx: ActiveOperationalContext,
  ) {
    const data = relationship.temporalCategory === 'FUTURE'
      ? { isActive: false, status: 'CANCELLED' }
      : { effectiveTo: transferDate };
    const result = await tx.supervisorAssignment.updateMany({
      where: {
        id: relationship.id,
        companyId: ctx.companyId,
        deletedAt: null,
        effectiveFrom: relationship.effectiveFrom,
        effectiveTo: relationship.effectiveTo,
        isActive: relationship.isActive,
      },
      data,
    });
    if (result.count !== 1) {
      throw this.validationError('relationshipResolutions', 'validation.staleTransfer', `Relationship ${relationship.id} changed while the transfer was being applied`);
    }
    return data;
  }

  private async createContinuationInTx(
    tx: Prisma.TransactionClient,
    relationship: any,
    newAssignmentId: string,
    transferDate: Date,
    ctx: ActiveOperationalContext,
  ) {
    const newEffectiveFrom = relationship.temporalCategory === 'FUTURE'
      ? relationship.effectiveFrom
      : transferDate;
    const newEffectiveTo = relationship.effectiveTo;
    const assignmentId = relationship.direction === 'INBOUND'
      ? newAssignmentId
      : relationship.otherParty.assignmentId;
    const supervisorAssignmentId = relationship.direction === 'INBOUND'
      ? relationship.otherParty.assignmentId
      : newAssignmentId;

    if (relationship.relationshipType === 'DIRECT') {
      await this.supervisorAssignmentsService.assertDirectIntegrityWithClient(tx, {
        companyId: ctx.companyId,
        assignmentId,
        supervisorAssignmentId,
        effectiveFrom: newEffectiveFrom,
        effectiveTo: newEffectiveTo,
      });
    } else {
      const [assignment, supervisorAssignment] = await Promise.all([
        tx.operationalPersonAssignment.findFirst({ where: { id: assignmentId, companyId: ctx.companyId, deletedAt: null } }),
        tx.operationalPersonAssignment.findFirst({ where: { id: supervisorAssignmentId, companyId: ctx.companyId, deletedAt: null } }),
      ]);
      if (!assignment || !supervisorAssignment) {
        throw this.validationError('relationshipResolutions', 'validation.invalidReference', 'Continuation assignment not found in current company');
      }
      if (this.assignmentWindowBlockReason(assignment, newEffectiveFrom, newEffectiveTo)
        || this.assignmentWindowBlockReason(supervisorAssignment, newEffectiveFrom, newEffectiveTo)) {
        throw this.validationError('relationshipResolutions', 'validation.assignmentOutOfRange', 'Continuation falls outside an assignment window');
      }
      if (assignment.personnelId === supervisorAssignment.personnelId) {
        throw this.validationError('relationshipResolutions', 'validation.selfReference', 'A person cannot be their own supervisor');
      }
      assertBranchCompatible(assignment.branchId ?? null, supervisorAssignment.branchId ?? null);
    }

    return tx.supervisorAssignment.create({
      data: {
        companyId: ctx.companyId,
        assignmentId,
        supervisorAssignmentId,
        relationshipType: relationship.relationshipType,
        effectiveFrom: newEffectiveFrom,
        effectiveTo: newEffectiveTo,
      },
      include: {
        assignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
        supervisorAssignment: {
          include: {
            person: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  async findByPerson(personnelId: string, ctx: ActiveOperationalContext) {
    return this.prisma.operationalPersonAssignment.findMany({
      where: { personnelId, companyId: ctx.companyId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
        jobTitle: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async enforceSinglePrimary(
    personnelId: string,
    effectiveFrom: string,
    effectiveTo?: string | null,
    excludeId?: string,
    companyId?: string,
  ) {
    const where: any = {
      personnelId,
      assignmentType: 'PRIMARY',
      effectiveTo: null,
      deletedAt: null,
    };
    if (companyId) where.companyId = companyId;
    if (excludeId) where.NOT = { id: excludeId };

    const existing = await this.prisma.operationalPersonAssignment.findFirst({ where });
    if (existing) {
      throw this.validationError('assignmentType', 'validation.duplicatePrimary', 'Only one active PRIMARY assignment is allowed per person');
    }
  }

  private async enforceSinglePrimaryInTx(
    tx: any,
    personnelId: string,
    effectiveFrom: string,
    effectiveTo: string | null | undefined,
    companyId: string,
  ) {
    const where: any = {
      personnelId,
      companyId,
      assignmentType: 'PRIMARY',
      effectiveTo: null,
      deletedAt: null,
    };

    const existing = await tx.operationalPersonAssignment.findFirst({ where });
    if (existing) {
      throw this.validationError('assignmentType', 'validation.duplicatePrimary', 'Only one active PRIMARY assignment is allowed per person');
    }
  }

  private async validateReferences(
    dto: any,
    ctx: ActiveOperationalContext,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const c = client as any;
    let department: any = null;
    if (dto.departmentId) {
      department = await c.department.findFirst({
        where: { id: dto.departmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!department) throw this.validationError('departmentId', 'validation.invalidReference', 'Department not found in current company');
    }

    if (dto.jobTitleId) {
      const jobTitle = await c.jobTitle.findFirst({
        where: { id: dto.jobTitleId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!jobTitle) throw this.validationError('jobTitleId', 'validation.invalidReference', 'Job title not found in current company');
    }

    if (dto.branchId) {
      const branch = await c.branch.findFirst({
        where: { id: dto.branchId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!branch) throw this.validationError('branchId', 'validation.invalidReference', 'Branch not found in current company');
    }

    if (department?.branchId && department.branchId !== (dto.branchId ?? null)) {
      throw this.validationError('departmentId', 'validation.invalidBranchHierarchy', 'Department does not belong to the selected branch');
    }

    if (dto.administrationId) {
      const admin = await c.administration.findFirst({
        where: {
          id: dto.administrationId,
          deletedAt: null,
          branch: { companyId: ctx.companyId, deletedAt: null },
        },
      });
      if (!admin) throw this.validationError('administrationId', 'validation.invalidReference', 'Administration not found in current company');
      if (dto.branchId && admin.branchId !== dto.branchId) {
        throw this.validationError('administrationId', 'validation.invalidBranchHierarchy', 'Administration does not belong to the selected branch');
      }
      if (department?.administrationId && department.administrationId !== admin.id) {
        throw this.validationError('administrationId', 'validation.invalidReference', 'Administration does not own the selected department');
      }
    }

    if (dto.personnelId) {
      const person = await c.operationalPerson.findFirst({
        where: { id: dto.personnelId, isActive: true },
      });
      if (!person) throw this.validationError('personnelId', 'validation.invalidReference', 'Operational person not found or inactive');
    }
  }
}
