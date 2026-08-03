import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import {
  CreateProductionOperationalAssignmentDto,
  UpdateProductionOperationalAssignmentDto,
  ProductionOperationalAssignmentQueryDto,
} from './dto/create-production-operational-assignment.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class ProductionOperationalAssignmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ messageKey: 'production.operationalAssignmentNotFound', message: 'Production operational assignment not found' });
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const assignment = await this.prisma.productionOperationalAssignment.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!assignment) throw this.notFound();
    return assignment;
  }

  private parseDates(effectiveFrom: string, effectiveTo?: string): { effectiveFrom: Date; effectiveTo: Date | null } {
    const from = new Date(effectiveFrom);
    if (isNaN(from.getTime())) throw this.validationError('effectiveFrom', 'production.invalidDate', 'effectiveFrom is not a valid date');
    let to: Date | null = null;
    if (effectiveTo !== undefined && effectiveTo !== null && effectiveTo !== '') {
      to = new Date(effectiveTo);
      if (isNaN(to.getTime())) throw this.validationError('effectiveTo', 'production.invalidDate', 'effectiveTo is not a valid date');
      if (to.getTime() < from.getTime()) throw this.validationError('effectiveTo', 'production.invalidDateRange', 'effectiveTo must not be before effectiveFrom');
    }
    return { effectiveFrom: from, effectiveTo: to };
  }

  private async validateResources(
    resourceType: string,
    machineId: string | undefined,
    productionLineId: string | undefined,
    productionUnitId: string | undefined,
    ctx: ActiveOperationalContext,
  ): Promise<{ machineId: string | null; productionLineId: string | null; productionUnitId: string | null }> {
    const type = resourceType.toUpperCase();
    if (type === 'MACHINE') {
      if (!machineId || productionLineId || productionUnitId) {
        throw this.validationError('machineId', 'production.resourceConflict', 'MACHINE assignment requires machineId and no line/unit');
      }
      const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      if (machine.companyId && machine.companyId !== ctx.companyId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another company');
      }
      if (machine.branchId && machine.branchId !== ctx.branchId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another branch');
      }
      return { machineId, productionLineId: null, productionUnitId: null };
    }
    if (type === 'LINE') {
      if (!productionLineId || machineId || productionUnitId) {
        throw this.validationError('productionLineId', 'production.resourceConflict', 'LINE assignment requires productionLineId and no machine/unit');
      }
      const line = await this.prisma.productionLine.findFirst({
        where: { id: productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!line) throw this.validationError('productionLineId', 'validation.invalidReference', 'Production line not found in tenant context');
      return { machineId: null, productionLineId, productionUnitId: null };
    }
    if (type === 'UNIT') {
      if (!productionUnitId || machineId || productionLineId) {
        throw this.validationError('productionUnitId', 'production.resourceConflict', 'UNIT assignment requires productionUnitId and no machine/line');
      }
      const unit = await this.prisma.productionUnit.findFirst({
        where: { id: productionUnitId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!unit) throw this.validationError('productionUnitId', 'validation.invalidReference', 'Production unit not found in tenant context');
      return { machineId: null, productionLineId: null, productionUnitId };
    }
    throw this.validationError('resourceType', 'production.invalidResourceType', 'resourceType must be MACHINE, LINE or UNIT');
  }

  private async validateShift(shiftId: string | undefined, ctx: ActiveOperationalContext): Promise<void> {
    if (!shiftId) return;
    const shift = await this.prisma.productionShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!shift) throw this.validationError('shiftId', 'validation.invalidReference', 'Production shift not found in tenant context');
  }

  private assignmentIncludes() {
    return {
      machine: { select: { id: true, code: true, name: true } },
      productionLine: { select: { id: true, code: true, name: true } },
      productionUnit: { select: { id: true, code: true, name: true } },
      shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
    };
  }

  async create(dto: CreateProductionOperationalAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    const resource = await this.validateResources(dto.resourceType, dto.machineId, dto.productionLineId, dto.productionUnitId, ctx);
    await this.validateShift(dto.shiftId, ctx);
    const dates = this.parseDates(dto.effectiveFrom, dto.effectiveTo);

    const code = dto.code?.trim() ?? (await this.numberingService.generateNumberAtomic('PRODUCTION_OPERATIONAL_ASSIGNMENT'));
    const codeExists = await this.prisma.productionOperationalAssignment.findUnique({ where: { code } });
    if (codeExists) throw this.validationError('code', 'production.codeExists', 'Assignment code already exists');

    const resourceWhere = {
      machineId: resource.machineId,
      productionLineId: resource.productionLineId,
      productionUnitId: resource.productionUnitId,
    };
    const conflict = await this.prisma.productionOperationalAssignment.findFirst({
      where: {
        resourceType: dto.resourceType.toUpperCase(),
        ...resourceWhere,
        deletedAt: null,
        status: 'ACTIVE',
        effectiveFrom: { lte: dates.effectiveTo ?? dates.effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dates.effectiveFrom } }],
      },
    });
    if (conflict) {
      throw new BadRequestException({
        messageKey: 'production.operationalAssignmentConflict',
        message: 'Resource already has an overlapping operational assignment for this period',
        errors: [{ field: 'effectivePeriod', code: 'production.operationalAssignmentConflict', message: 'Overlapping operational assignment for the same resource' }],
      });
    }

    const assignment = await this.prisma.productionOperationalAssignment.create({
      data: {
        code,
        resourceType: dto.resourceType.toUpperCase(),
        machineId: resource.machineId,
        productionLineId: resource.productionLineId,
        productionUnitId: resource.productionUnitId,
        shiftId: dto.shiftId ?? null,
        capacityPerShift: dto.capacityPerShift ?? null,
        effectiveFrom: dates.effectiveFrom,
        effectiveTo: dates.effectiveTo,
        isPrimary: dto.isPrimary ?? false,
        notes: dto.notes ?? null,
        createdById: userId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
      },
      include: this.assignmentIncludes(),
    });
    await this.audit.log(userId, 'CREATE', 'ProductionOperationalAssignment', assignment.id, { code: assignment.code, resourceType: assignment.resourceType });
    return assignment;
  }

  async findAll(query: ProductionOperationalAssignmentQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { machine: { is: { name: { contains: query.search } } } },
        { productionLine: { is: { name: { contains: query.search } } } },
        { productionUnit: { is: { name: { contains: query.search } } } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.resourceType) where.resourceType = query.resourceType.toUpperCase();
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.productionUnitId) where.productionUnitId = query.productionUnitId;
    if (query.shiftId) where.shiftId = query.shiftId;

    if (query.effectiveOn) {
      const on = new Date(query.effectiveOn);
      if (isNaN(on.getTime())) throw this.validationError('effectiveOn', 'production.invalidDate', 'effectiveOn is not a valid date');
      const resolvedWhere: any = {
        ...where,
        status: query.status ?? 'ACTIVE',
        effectiveFrom: { lte: on },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
      };
      const [data, total] = await Promise.all([
        this.prisma.productionOperationalAssignment.findMany({
          where: resolvedWhere, skip, take: limit, orderBy: { effectiveFrom: 'desc' },
          include: this.assignmentIncludes(),
        }),
        this.prisma.productionOperationalAssignment.count({ where: resolvedWhere }),
      ]);
      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    const [data, total] = await Promise.all([
      this.prisma.productionOperationalAssignment.findMany({
        where, skip, take: limit, orderBy: { effectiveFrom: 'desc' },
        include: this.assignmentIncludes(),
      }),
      this.prisma.productionOperationalAssignment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const assignment = await this.findOwned(id, ctx);
    return this.prisma.productionOperationalAssignment.findUnique({
      where: { id: assignment.id },
      include: this.assignmentIncludes(),
    });
  }

  async update(id: string, dto: UpdateProductionOperationalAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwned(id, ctx);
    const resource = await this.validateResources(
      existing.resourceType,
      dto.machineId ?? existing.machineId ?? undefined,
      dto.productionLineId ?? existing.productionLineId ?? undefined,
      dto.productionUnitId ?? existing.productionUnitId ?? undefined,
      ctx,
    );
    await this.validateShift(dto.shiftId !== undefined ? dto.shiftId || undefined : existing.shiftId ?? undefined, ctx);
    const dates = this.parseDates(
      dto.effectiveFrom ?? existing.effectiveFrom.toISOString(),
      dto.effectiveTo !== undefined ? (dto.effectiveTo || undefined) : existing.effectiveTo?.toISOString(),
    );

    const conflict = await this.prisma.productionOperationalAssignment.findFirst({
      where: {
        id: { not: id },
        resourceType: existing.resourceType,
        machineId: resource.machineId,
        productionLineId: resource.productionLineId,
        productionUnitId: resource.productionUnitId,
        deletedAt: null,
        status: 'ACTIVE',
        effectiveFrom: { lte: dates.effectiveTo ?? dates.effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dates.effectiveFrom } }],
      },
    });
    if (conflict) {
      throw new BadRequestException({
        messageKey: 'production.operationalAssignmentConflict',
        message: 'Resource already has an overlapping operational assignment for this period',
        errors: [{ field: 'effectivePeriod', code: 'production.operationalAssignmentConflict', message: 'Overlapping operational assignment for the same resource' }],
      });
    }

    const assignment = await this.prisma.productionOperationalAssignment.update({
      where: { id },
      data: {
        machineId: resource.machineId,
        productionLineId: resource.productionLineId,
        productionUnitId: resource.productionUnitId,
        shiftId: dto.shiftId !== undefined ? (dto.shiftId || null) : existing.shiftId,
        capacityPerShift: dto.capacityPerShift !== undefined ? dto.capacityPerShift : existing.capacityPerShift,
        effectiveFrom: dates.effectiveFrom,
        effectiveTo: dates.effectiveTo,
        isPrimary: dto.isPrimary !== undefined ? dto.isPrimary : existing.isPrimary,
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
      },
      include: this.assignmentIncludes(),
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionOperationalAssignment', id, { code: assignment.code });
    return assignment;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    await this.prisma.productionOperationalAssignment.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(userId, 'DELETE', 'ProductionOperationalAssignment', id);
    return { message: 'Production operational assignment deleted successfully' };
  }

  async findCurrent(
    resourceType: string,
    options: { machineId?: string; productionLineId?: string; productionUnitId?: string; on?: string },
    ctx: ActiveOperationalContext,
  ): Promise<{ data: any[]; count: number }> {
    const type = resourceType.toUpperCase();
    const reference = options.on ? new Date(options.on) : new Date();
    if (isNaN(reference.getTime())) throw this.validationError('on', 'production.invalidDate', 'on is not a valid date');

    const resourceWhere: any = {};
    if (type === 'MACHINE') {
      if (!options.machineId) throw this.validationError('machineId', 'production.resourceRequired', 'machineId is required for MACHINE resolution');
      resourceWhere.machineId = options.machineId;
    } else if (type === 'LINE') {
      if (!options.productionLineId) throw this.validationError('productionLineId', 'production.resourceRequired', 'productionLineId is required for LINE resolution');
      resourceWhere.productionLineId = options.productionLineId;
    } else if (type === 'UNIT') {
      if (!options.productionUnitId) throw this.validationError('productionUnitId', 'production.resourceRequired', 'productionUnitId is required for UNIT resolution');
      resourceWhere.productionUnitId = options.productionUnitId;
    } else {
      throw this.validationError('resourceType', 'production.invalidResourceType', 'resourceType must be MACHINE, LINE or UNIT');
    }

    const assignments = await this.prisma.productionOperationalAssignment.findMany({
      where: {
        resourceType: type,
        ...resourceWhere,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
        status: 'ACTIVE',
        effectiveFrom: { lte: reference },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: reference } }],
      },
      orderBy: [{ isPrimary: 'desc' }, { effectiveFrom: 'desc' }],
      include: this.assignmentIncludes(),
    });
    return { data: assignments, count: assignments.length };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const assignment = await this.prisma.productionOperationalAssignment.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'ProductionOperationalAssignment', id);
    return assignment;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const assignment = await this.prisma.productionOperationalAssignment.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'ProductionOperationalAssignment', id);
    return assignment;
  }
}