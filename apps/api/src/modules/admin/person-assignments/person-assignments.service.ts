import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreatePersonAssignmentDto } from './dto/create-person-assignment.dto';
import { UpdatePersonAssignmentDto } from './dto/update-person-assignment.dto';
import { TransferPersonAssignmentDto } from './dto/transfer-person-assignment.dto';
import { TransferPreviewDto } from './dto/transfer-preview.dto';
import { TransferApplyDto, RelationshipResolutionDto } from './dto/transfer-apply.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { intervalsOverlap, isEffectivelyActive, assertBranchCompatible } from '../supervisor-assignments/supervisor-assignments.service';
import { Prisma } from '@prisma/client';

const LEADERSHIP_LEVELS = ['NONE', 'TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'] as const;
const LEADERSHIP_REQUIRES_DEPARTMENT = ['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD'] as const;

@Injectable()
export class PersonAssignmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
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

  private async enforceLeadershipUniqueness(level: string, assignmentType: string, departmentId: string | undefined, administrationId: string | undefined, effectiveFrom: string, effectiveTo?: string | null, excludeId?: string) {
    if (level === 'NONE' || level === 'TEAM_LEAD' || level === 'SUPERVISOR') return;

    if (level === 'DEPARTMENT_HEAD' && (assignmentType === 'PRIMARY' || assignmentType === 'ACTING') && departmentId) {
      await this.checkExistingLeadershipHolder(level, assignmentType, 'departmentId', departmentId, effectiveFrom, effectiveTo, excludeId);
    }

    if (level === 'ADMINISTRATION_MANAGER' && (assignmentType === 'PRIMARY' || assignmentType === 'ACTING') && administrationId) {
      await this.checkExistingLeadershipHolder(level, assignmentType, 'administrationId', administrationId, effectiveFrom, effectiveTo, excludeId);
    }
  }

  private async checkExistingLeadershipHolder(level: string, assignmentType: string, scopeField: string, scopeId: string, effectiveFrom: string, effectiveTo?: string | null, excludeId?: string) {
    const effectiveFromDate = new Date(effectiveFrom);
    const effectiveToDate = effectiveTo ? new Date(effectiveTo) : null;

    const where: any = {
      leadershipLevel: level,
      assignmentType,
      deletedAt: null,
      [scopeField]: scopeId,
    };
    if (excludeId) where.NOT = { id: excludeId };

    const existing = await this.prisma.operationalPersonAssignment.findFirst({ where });

    if (existing) {
      const existingEnd = existing.effectiveTo;
      const newStart = effectiveFromDate;
      const newEnd = effectiveToDate;

      const overlaps = !newEnd
        ? (!existingEnd || existingEnd > newStart)
        : (!existingEnd
            ? newEnd > existing.effectiveFrom
            : newEnd > existing.effectiveFrom && newStart < existingEnd);

      if (overlaps) {
        const scopeLabel = scopeField === 'departmentId' ? 'Department' : 'Administration';
        const typeLabel = assignmentType === 'ACTING' ? 'ACTING' : 'PRIMARY';
        throw this.validationError(
          'leadershipLevel',
          level === 'ADMINISTRATION_MANAGER' ? 'validation.primaryAdministrationManagerOverlap' : 'validation.primaryDepartmentHeadOverlap',
          `Only one current effective ${typeLabel} ${level} is allowed per ${scopeLabel}`,
        );
      }
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
      await this.enforceSinglePrimary(dto.personnelId, dto.effectiveFrom, dto.effectiveTo);
    }

    await this.enforceLeadershipUniqueness(leadershipLevel, assignmentType, dto.departmentId, dto.administrationId, dto.effectiveFrom, dto.effectiveTo);

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
      await this.enforceSinglePrimary(existing.personnelId, effectiveFrom.toISOString(), effectiveTo?.toISOString(), id);
    }

    const finalLevel = data.leadershipLevel ?? existing.leadershipLevel ?? 'NONE';
    const finalType = data.assignmentType ?? existing.assignmentType;
    const finalDept = data.departmentId ?? existing.departmentId;
    const finalAdmin = data.administrationId ?? existing.administrationId;
    const finalFrom = data.effectiveFrom ?? existing.effectiveFrom;
    const finalTo = data.effectiveTo !== undefined ? data.effectiveTo : existing.effectiveTo;

    if (finalLevel !== 'NONE') {
      this.validateLeadershipStructure(finalLevel, { departmentId: finalDept, administrationId: finalAdmin });
      await this.enforceLeadershipUniqueness(finalLevel, finalType, finalDept, finalAdmin, finalFrom.toISOString(), finalTo?.toISOString(), id);
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
    const current = await this.findOne(id, ctx);

    if (current.assignmentType !== 'PRIMARY') {
      throw this.validationError('assignmentId', 'validation.invalidOperation', 'Transfer is only available for PRIMARY assignments');
    }

    if (current.effectiveTo) {
      throw this.validationError('assignmentId', 'validation.invalidOperation', 'Cannot transfer an already closed assignment');
    }

    if (dto.effectiveFrom <= current.effectiveFrom.toISOString()) {
      throw this.validationError('effectiveFrom', 'validation.invalidRange', 'Transfer date must be after the original assignment start date');
    }

    await this.validateReferences({ ...current, ...dto } as any, ctx);

    const transferType = dto.assignmentType ?? 'PRIMARY';
    const transferLeadership = dto.leadershipLevel ?? 'NONE';

    if (transferLeadership !== 'NONE') {
      this.validateLeadershipStructure(transferLeadership, dto);
      await this.enforceLeadershipUniqueness(transferLeadership, transferType, dto.departmentId, dto.administrationId, dto.effectiveFrom, dto.effectiveTo);
    }

    const transferDate = new Date(dto.effectiveFrom);
    const affectedRelationships = await this.discoverAffectedRelationships(id, transferDate, ctx);

    const currentInbound = affectedRelationships.filter(r => r.direction === 'INBOUND' && r.temporalCategory === 'CURRENT');
    const currentOutbound = affectedRelationships.filter(r => r.direction === 'OUTBOUND' && r.temporalCategory === 'CURRENT');
    const futureRelationships = affectedRelationships.filter(r => r.temporalCategory === 'FUTURE');
    const totalAffected = currentInbound.length + currentOutbound.length + futureRelationships.length;

    if (totalAffected > 0) {
      if (!dto.relationshipResolutions || dto.relationshipResolutions.length === 0) {
        throw this.validationError('relationshipResolutions', 'validation.reconciliationRequired', `Transfer affects ${totalAffected} supervision relationship(s). Reconciliation required.`);
      }

      this.validateResolutions(dto.relationshipResolutions, affectedRelationships);
    }

    const resolutions = dto.relationshipResolutions ?? [];

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPersonAssignment.update({
        where: { id },
        data: { effectiveTo: transferDate },
      });

      if (transferType === 'PRIMARY') {
        await this.enforceSinglePrimaryInTx(tx, current.personnelId, dto.effectiveFrom, dto.effectiveTo);
      }

      const newAssignment = await tx.operationalPersonAssignment.create({
        data: {
          companyId: ctx.companyId,
          branchId: dto.branchId ?? current.branchId ?? ctx.branchId ?? null,
          administrationId: dto.administrationId ?? current.administrationId ?? null,
          departmentId: dto.departmentId,
          jobTitleId: dto.jobTitleId ?? current.jobTitleId ?? null,
          personnelId: current.personnelId,
          assignmentType: transferType,
          leadershipLevel: transferLeadership,
          effectiveFrom: transferDate,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
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

      let endedCount = 0;
      let continuedCount = 0;

      for (const resolution of resolutions) {
        const relationship = affectedRelationships.find(r => r.id === resolution.relationshipId);
        if (!relationship) continue;

        if (resolution.action === 'END_AT_TRANSFER') {
          await this.closeRelationshipInTx(tx, resolution.relationshipId, transferDate);
          await this.auditService.logWithClient(tx, {
            userId: userId ?? 'system',
            action: 'TRANSFER_RELATIONSHIP_END',
            entity: 'SupervisorAssignment',
            entityId: resolution.relationshipId,
            details: JSON.stringify({
              transferAssignmentId: id,
              newAssignmentId: newAssignment.id,
              relationshipType: relationship.relationshipType,
              direction: relationship.direction,
              companyId: ctx.companyId,
            }),
          });
          endedCount++;
        } else if (resolution.action === 'CONTINUE_ON_NEW_ASSIGNMENT') {
          const newRel = await this.createContinuationInTx(
            tx, relationship, newAssignment.id, transferDate, ctx,
          );
          await this.auditService.logWithClient(tx, {
            userId: userId ?? 'system',
            action: 'TRANSFER_RELATIONSHIP_CONTINUE',
            entity: 'SupervisorAssignment',
            entityId: newRel.id,
            details: JSON.stringify({
              transferAssignmentId: id,
              newAssignmentId: newAssignment.id,
              oldRelationshipId: resolution.relationshipId,
              relationshipType: relationship.relationshipType,
              direction: relationship.direction,
              companyId: ctx.companyId,
            }),
          });
          continuedCount++;
        }
      }

      await this.auditService.logWithClient(tx, {
        userId: userId ?? 'system',
        action: 'TRANSFER',
        entity: 'OperationalPersonAssignment',
        entityId: id,
        details: JSON.stringify({
          oldAssignmentId: id,
          newAssignmentId: newAssignment.id,
          fromDepartmentId: current.departmentId,
          toDepartmentId: dto.departmentId,
          personnelId: current.personnelId,
          companyId: ctx.companyId,
          relationshipsEnded: endedCount,
          relationshipsContinued: continuedCount,
        }),
      });

      return {
        newAssignment,
        relationshipsEnded: endedCount,
        relationshipsContinued: continuedCount,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async transferPreview(id: string, dto: TransferPreviewDto, ctx: ActiveOperationalContext) {
    const current = await this.findOne(id, ctx);

    if (current.assignmentType !== 'PRIMARY') {
      throw this.validationError('assignmentId', 'validation.invalidOperation', 'Transfer is only available for PRIMARY assignments');
    }

    if (current.effectiveTo) {
      throw this.validationError('assignmentId', 'validation.invalidOperation', 'Cannot transfer an already closed assignment');
    }

    if (dto.effectiveFrom <= current.effectiveFrom.toISOString()) {
      throw this.validationError('effectiveFrom', 'validation.invalidRange', 'Transfer date must be after the original assignment start date');
    }

    await this.validateReferences({ ...current, ...dto } as any, ctx);

    const transferDate = new Date(dto.effectiveFrom);
    const affectedRelationships = await this.discoverAffectedRelationships(id, transferDate, ctx);

    const historicalUnaffected = affectedRelationships.filter(r => r.temporalCategory === 'HISTORICAL').length;
    const currentInbound = affectedRelationships.filter(r => r.direction === 'INBOUND' && r.temporalCategory === 'CURRENT').length;
    const currentOutbound = affectedRelationships.filter(r => r.direction === 'OUTBOUND' && r.temporalCategory === 'CURRENT').length;
    const futureInbound = affectedRelationships.filter(r => r.direction === 'INBOUND' && r.temporalCategory === 'FUTURE').length;
    const futureOutbound = affectedRelationships.filter(r => r.direction === 'OUTBOUND' && r.temporalCategory === 'FUTURE').length;
    const directCount = affectedRelationships.filter(r => r.relationshipType === 'DIRECT').length;
    const matrixCount = affectedRelationships.filter(r => r.relationshipType === 'MATRIX').length;
    const functionalCount = affectedRelationships.filter(r => r.relationshipType === 'FUNCTIONAL').length;

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
        departmentId: dto.departmentId,
        branchId: dto.branchId ?? current.branchId ?? ctx.branchId ?? null,
        administrationId: dto.administrationId ?? current.administrationId ?? null,
        jobTitleId: dto.jobTitleId ?? current.jobTitleId ?? null,
        assignmentType: dto.assignmentType ?? 'PRIMARY',
        leadershipLevel: dto.leadershipLevel ?? 'NONE',
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
        directCount,
        matrixCount,
        functionalCount,
        totalAffected: currentInbound + currentOutbound + futureInbound + futureOutbound,
      },
      affectedRelationships,
    };
  }

  private async discoverAffectedRelationships(
    assignmentId: string,
    transferDate: Date,
    ctx: ActiveOperationalContext,
  ) {
    const inbound = await this.prisma.supervisorAssignment.findMany({
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

    const outbound = await this.prisma.supervisorAssignment.findMany({
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
          leadershipLevel: rel.supervisorAssignment?.leadershipLevel,
          assignmentId: rel.supervisorAssignmentId,
        },
        allowedResolutions: this.getAllowedResolutions(temporalCategory),
      });
    }

    for (const rel of outbound) {
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
    const resolutionIds = new Set(resolutions.map(r => r.relationshipId));
    const affectedNonHistorical = affectedRelationships.filter(r => r.temporalCategory !== 'HISTORICAL');
    const affectedIds = new Set(affectedNonHistorical.map((r: any) => r.id));

    for (const resolution of resolutions) {
      if (!affectedIds.has(resolution.relationshipId)) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.foreignResolution',
          `Resolution references relationship ${resolution.relationshipId} which is not affected by this transfer`,
        );
      }

      const relationship = affectedNonHistorical.find((r: any) => r.id === resolution.relationshipId);
      if (relationship && !relationship.allowedResolutions.includes(resolution.action)) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidResolution',
          `Action ${resolution.action} is not allowed for relationship ${resolution.relationshipId} with temporal category ${relationship.temporalCategory}`,
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

  private async closeRelationshipInTx(tx: any, relationshipId: string, effectiveTo: Date) {
    await tx.supervisorAssignment.update({
      where: { id: relationshipId },
      data: {
        effectiveTo,
        isActive: false,
      },
    });
  }

  private async createContinuationInTx(
    tx: any,
    relationship: any,
    newAssignmentId: string,
    transferDate: Date,
    ctx: ActiveOperationalContext,
  ) {
    const newEffectiveFrom = relationship.temporalCategory === 'FUTURE'
      ? relationship.effectiveFrom
      : transferDate;
    const newEffectiveTo = relationship.effectiveTo;

    if (relationship.direction === 'INBOUND') {
      const supervisorAssignment = await tx.operationalPersonAssignment.findFirst({
        where: { id: relationship.otherParty.assignmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!supervisorAssignment) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidReference',
          `Supervisor assignment ${relationship.otherParty.assignmentId} not found`,
        );
      }

      if (relationship.relationshipType === 'DIRECT') {
        const existingDirect = await tx.supervisorAssignment.findFirst({
          where: {
            assignmentId: newAssignmentId,
            relationshipType: 'DIRECT',
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, effectiveFrom: true, effectiveTo: true },
        });
        if (existingDirect && intervalsOverlap(existingDirect.effectiveFrom, existingDirect.effectiveTo, newEffectiveFrom, newEffectiveTo)) {
          throw this.validationError(
            'relationshipResolutions',
            'validation.directSupervisorOverlap',
            'New assignment already has an overlapping DIRECT supervisor relationship',
          );
        }
      }

      const subordinateAssignment = await tx.operationalPersonAssignment.findFirst({
        where: { id: newAssignmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!subordinateAssignment) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidReference',
          `New assignment ${newAssignmentId} not found`,
        );
      }

      if (subordinateAssignment.personnelId === supervisorAssignment.personnelId) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.selfReference',
          'A person cannot be their own supervisor',
        );
      }

      assertBranchCompatible(subordinateAssignment.branchId ?? null, supervisorAssignment.branchId ?? null);

      if (relationship.relationshipType === 'DIRECT') {
        const wouldCycle = await this.detectCycleInTx(tx, newAssignmentId, relationship.otherParty.assignmentId, newEffectiveFrom, newEffectiveTo);
        if (wouldCycle) {
          throw this.validationError(
            'relationshipResolutions',
            'validation.cycleDetected',
            'Continuation would create a cycle in the reporting hierarchy',
          );
        }
      }
    } else {
      const subordinateAssignment = await tx.operationalPersonAssignment.findFirst({
        where: { id: relationship.otherParty.assignmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!subordinateAssignment) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidReference',
          `Subordinate assignment ${relationship.otherParty.assignmentId} not found`,
        );
      }

      if (relationship.relationshipType === 'DIRECT') {
        const existingDirect = await tx.supervisorAssignment.findFirst({
          where: {
            assignmentId: relationship.otherParty.assignmentId,
            relationshipType: 'DIRECT',
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, effectiveFrom: true, effectiveTo: true },
        });
        if (existingDirect && intervalsOverlap(existingDirect.effectiveFrom, existingDirect.effectiveTo, newEffectiveFrom, newEffectiveTo)) {
          throw this.validationError(
            'relationshipResolutions',
            'validation.directSupervisorOverlap',
            'Subordinate already has an overlapping DIRECT supervisor relationship',
          );
        }
      }

      const newSupervisorAssignment = await tx.operationalPersonAssignment.findFirst({
        where: { id: newAssignmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!newSupervisorAssignment) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.invalidReference',
          `New assignment ${newAssignmentId} not found`,
        );
      }

      if (subordinateAssignment.personnelId === newSupervisorAssignment.personnelId) {
        throw this.validationError(
          'relationshipResolutions',
          'validation.selfReference',
          'A person cannot be their own supervisor',
        );
      }

      assertBranchCompatible(subordinateAssignment.branchId ?? null, newSupervisorAssignment.branchId ?? null);

      if (relationship.relationshipType === 'DIRECT') {
        const wouldCycle = await this.detectCycleInTx(tx, relationship.otherParty.assignmentId, newAssignmentId, newEffectiveFrom, newEffectiveTo);
        if (wouldCycle) {
          throw this.validationError(
            'relationshipResolutions',
            'validation.cycleDetected',
            'Continuation would create a cycle in the reporting hierarchy',
          );
        }
      }
    }

    return tx.supervisorAssignment.create({
      data: {
        companyId: ctx.companyId,
        assignmentId: relationship.direction === 'INBOUND' ? newAssignmentId : relationship.otherParty.assignmentId,
        supervisorAssignmentId: relationship.direction === 'INBOUND' ? relationship.otherParty.assignmentId : newAssignmentId,
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

  private async detectCycleInTx(
    tx: any,
    subordinateAssignmentId: string,
    proposedSupervisorAssignmentId: string,
    candidateStart: Date,
    candidateEnd: Date | null,
  ): Promise<boolean> {
    const visited = new Set<string>();
    let currentId: string | null = proposedSupervisorAssignmentId;
    let depth = 0;

    while (currentId && depth < 100) {
      if (currentId === subordinateAssignmentId) return true;
      if (visited.has(currentId)) return true;
      visited.add(currentId);

      const sa: {
        supervisorAssignmentId: string | null;
        effectiveFrom: Date;
        effectiveTo: Date | null;
      } | null = await tx.supervisorAssignment.findFirst({
        where: {
          assignmentId: currentId,
          isActive: true,
          deletedAt: null,
          relationshipType: 'DIRECT',
        },
        select: {
          supervisorAssignmentId: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      });

      if (!sa || !sa.supervisorAssignmentId) break;
      if (!intervalsOverlap(sa.effectiveFrom, sa.effectiveTo, candidateStart, candidateEnd)) break;

      currentId = sa.supervisorAssignmentId;
      depth++;
    }

    return false;
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

  private async enforceSinglePrimary(personnelId: string, effectiveFrom: string, effectiveTo?: string | null, excludeId?: string) {
    const where: any = {
      personnelId,
      assignmentType: 'PRIMARY',
      effectiveTo: null,
      deletedAt: null,
    };
    if (excludeId) where.NOT = { id: excludeId };

    const existing = await this.prisma.operationalPersonAssignment.findFirst({ where });
    if (existing) {
      throw this.validationError('assignmentType', 'validation.duplicatePrimary', 'Only one active PRIMARY assignment is allowed per person');
    }
  }

  private async enforceSinglePrimaryInTx(tx: any, personnelId: string, effectiveFrom: string, effectiveTo?: string | null) {
    const where: any = {
      personnelId,
      assignmentType: 'PRIMARY',
      effectiveTo: null,
      deletedAt: null,
    };

    const existing = await tx.operationalPersonAssignment.findFirst({ where });
    if (existing) {
      throw this.validationError('assignmentType', 'validation.duplicatePrimary', 'Only one active PRIMARY assignment is allowed per person');
    }
  }

  private async validateReferences(dto: any, ctx: ActiveOperationalContext) {
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!dept) throw this.validationError('departmentId', 'validation.invalidReference', 'Department not found in current company');
    }

    if (dto.jobTitleId) {
      const jobTitle = await this.prisma.jobTitle.findFirst({
        where: { id: dto.jobTitleId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!jobTitle) throw this.validationError('jobTitleId', 'validation.invalidReference', 'Job title not found in current company');
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!branch) throw this.validationError('branchId', 'validation.invalidReference', 'Branch not found in current company');
    }

    if (dto.administrationId) {
      const admin = await this.prisma.administration.findFirst({
        where: { id: dto.administrationId, deletedAt: null },
      });
      if (!admin) throw this.validationError('administrationId', 'validation.invalidReference', 'Administration not found');
    }

    if (dto.personnelId) {
      const person = await this.prisma.operationalPerson.findFirst({
        where: { id: dto.personnelId, isActive: true },
      });
      if (!person) throw this.validationError('personnelId', 'validation.invalidReference', 'Operational person not found or inactive');
    }
  }
}
