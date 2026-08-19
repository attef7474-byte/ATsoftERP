import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreatePersonAssignmentDto } from './dto/create-person-assignment.dto';
import { UpdatePersonAssignmentDto } from './dto/update-person-assignment.dto';
import { TransferPersonAssignmentDto } from './dto/transfer-person-assignment.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

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

  async create(dto: CreatePersonAssignmentDto, ctx: ActiveOperationalContext, userId?: string) {
    await this.validateReferences(dto, ctx);

    if (dto.effectiveTo && dto.effectiveTo < dto.effectiveFrom) {
      throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');
    }

    const assignmentType = dto.assignmentType ?? 'PRIMARY';

    if (assignmentType === 'PRIMARY') {
      await this.enforceSinglePrimary(dto.personnelId, dto.effectiveFrom, dto.effectiveTo);
    }

    const assignment = await this.prisma.operationalPersonAssignment.create({
      data: {
        companyId: ctx.companyId,
        branchId: dto.branchId ?? ctx.branchId ?? null,
        administrationId: dto.administrationId ?? null,
        departmentId: dto.departmentId,
        jobTitleId: dto.jobTitleId ?? null,
        personnelId: dto.personnelId,
        assignmentType,
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
      details: JSON.stringify({ personnelId: dto.personnelId, departmentId: dto.departmentId, assignmentType, companyId: ctx.companyId }),
    });

    return assignment;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; personnelId?: string; departmentId?: string; assignmentType?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (query.personnelId) where.personnelId = query.personnelId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.assignmentType) where.assignmentType = query.assignmentType;
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

    if (data.departmentId || data.jobTitleId) {
      await this.validateReferences({ ...existing, ...dto } as any, ctx);
    }

    if (data.assignmentType === 'PRIMARY' || (existing.assignmentType === 'PRIMARY' && !data.assignmentType)) {
      const effectiveFrom = data.effectiveFrom ?? existing.effectiveFrom;
      const effectiveTo = data.effectiveTo ?? existing.effectiveTo;
      await this.enforceSinglePrimary(existing.personnelId, effectiveFrom.toISOString(), effectiveTo?.toISOString(), id);
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

  async transfer(id: string, dto: TransferPersonAssignmentDto, ctx: ActiveOperationalContext, userId?: string) {
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

    return this.prisma.$transaction(async (tx) => {
      await tx.operationalPersonAssignment.update({
        where: { id },
        data: { effectiveTo: new Date(dto.effectiveFrom) },
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
          effectiveFrom: new Date(dto.effectiveFrom),
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

      await this.auditService.log({
        userId: userId ?? 'system',
        action: 'TRANSFER',
        entity: 'OperationalPersonAssignment',
        entityId: id,
        details: JSON.stringify({ fromDepartmentId: current.departmentId, toDepartmentId: dto.departmentId, personnelId: current.personnelId, companyId: ctx.companyId }),
      });

      return newAssignment;
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
