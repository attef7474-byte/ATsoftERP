import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateProductionShiftAssignmentDto, UpdateProductionShiftAssignmentDto, ProductionShiftAssignmentQueryDto } from './dto/create-production-shift-assignment.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class ProductionShiftAssignmentsService {
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
    return new NotFoundException({ messageKey: 'production.shiftAssignmentNotFound', message: 'Production shift assignment not found' });
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const assignment = await this.prisma.productionShiftAssignment.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!assignment) throw this.notFound();
    return assignment;
  }

  private async validateShift(shiftId: string, ctx: ActiveOperationalContext): Promise<void> {
    const shift = await this.prisma.productionShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!shift) throw this.validationError('shiftId', 'validation.invalidReference', 'Production shift not found in tenant context');
    if (shift.status !== 'ACTIVE') throw this.validationError('shiftId', 'validation.invalidReference', 'Production shift is inactive');
  }

  private async validateCalendar(calendarId: string | undefined, ctx: ActiveOperationalContext): Promise<void> {
    if (!calendarId) return;
    const calendar = await this.prisma.productionShiftCalendar.findFirst({
      where: { id: calendarId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!calendar) throw this.validationError('calendarId', 'validation.invalidReference', 'Calendar not found in tenant context');
  }

  private async validatePerson(operationalPersonId: string): Promise<void> {
    const person = await this.prisma.operationalPerson.findUnique({ where: { id: operationalPersonId } });
    if (!person) throw this.validationError('operationalPersonId', 'validation.invalidReference', 'Operational person not found');
    if (!person.isActive) throw this.validationError('operationalPersonId', 'validation.invalidReference', 'Operational person is inactive');
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

  private assignmentIncludes() {
    return {
      shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
      calendar: { select: { id: true, code: true, name: true } },
      operationalPerson: { select: { id: true, code: true, name: true, category: true } },
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
    };
  }

  async create(dto: CreateProductionShiftAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    await this.validateShift(dto.shiftId, ctx);
    await this.validateCalendar(dto.calendarId, ctx);
    await this.validatePerson(dto.operationalPersonId);
    const dates = this.parseDates(dto.effectiveFrom, dto.effectiveTo);

    const code = dto.code?.trim() ?? (await this.numberingService.generateNumberAtomic('PRODUCTION_SHIFT_ASSIGNMENT'));
    const codeExists = await this.prisma.productionShiftAssignment.findUnique({ where: { code } });
    if (codeExists) throw this.validationError('code', 'production.codeExists', 'Assignment code already exists');

    const conflict = await this.prisma.productionShiftAssignment.findFirst({
      where: {
        operationalPersonId: dto.operationalPersonId,
        deletedAt: null,
        status: 'ACTIVE',
        effectiveFrom: { lte: dates.effectiveTo ?? dates.effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dates.effectiveFrom } }],
      },
    });
    if (conflict) {
      throw new BadRequestException({
        messageKey: 'production.shiftAssignmentConflict',
        message: 'Operational person already has an overlapping shift assignment for this period',
        errors: [{ field: 'effectivePeriod', code: 'production.shiftAssignmentConflict', message: 'Overlapping shift assignment detected for the same person' }],
      });
    }

    const assignment = await this.prisma.productionShiftAssignment.create({
      data: {
        code,
        shiftId: dto.shiftId,
        calendarId: dto.calendarId ?? null,
        operationalPersonId: dto.operationalPersonId,
        effectiveFrom: dates.effectiveFrom,
        effectiveTo: dates.effectiveTo,
        isPrimary: dto.isPrimary ?? false,
        notes: dto.notes ?? null,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
      },
      include: this.assignmentIncludes(),
    });
    await this.audit.log(userId, 'CREATE', 'ProductionShiftAssignment', assignment.id, { code: assignment.code });
    return assignment;
  }

  async findAll(query: ProductionShiftAssignmentQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { operationalPerson: { is: { name: { contains: query.search } } } },
        { operationalPerson: { is: { code: { contains: query.search } } } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.operationalPersonId) where.operationalPersonId = query.operationalPersonId;

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
        this.prisma.productionShiftAssignment.findMany({
          where: resolvedWhere, skip, take: limit, orderBy: { effectiveFrom: 'desc' },
          include: this.assignmentIncludes(),
        }),
        this.prisma.productionShiftAssignment.count({ where: resolvedWhere }),
      ]);
      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    const [data, total] = await Promise.all([
      this.prisma.productionShiftAssignment.findMany({
        where, skip, take: limit, orderBy: { effectiveFrom: 'desc' },
        include: this.assignmentIncludes(),
      }),
      this.prisma.productionShiftAssignment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const assignment = await this.findOwned(id, ctx);
    return this.prisma.productionShiftAssignment.findUnique({
      where: { id: assignment.id },
      include: this.assignmentIncludes(),
    });
  }

  async update(id: string, dto: UpdateProductionShiftAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwned(id, ctx);
    const nextShiftId = dto.shiftId ?? existing.shiftId;
    const nextCalendarId = dto.calendarId !== undefined ? (dto.calendarId || null) : existing.calendarId;
    const dates = this.parseDates(
      dto.effectiveFrom ?? existing.effectiveFrom.toISOString(),
      dto.effectiveTo !== undefined ? (dto.effectiveTo || undefined) : existing.effectiveTo?.toISOString(),
    );

    await this.validateShift(nextShiftId, ctx);
    if (dto.calendarId !== undefined) await this.validateCalendar(dto.calendarId || undefined, ctx);

    const conflict = await this.prisma.productionShiftAssignment.findFirst({
      where: {
        id: { not: id },
        operationalPersonId: existing.operationalPersonId,
        deletedAt: null,
        status: 'ACTIVE',
        effectiveFrom: { lte: dates.effectiveTo ?? dates.effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dates.effectiveFrom } }],
      },
    });
    if (conflict) {
      throw new BadRequestException({
        messageKey: 'production.shiftAssignmentConflict',
        message: 'Operational person already has an overlapping shift assignment for this period',
        errors: [{ field: 'effectivePeriod', code: 'production.shiftAssignmentConflict', message: 'Overlapping shift assignment for the same person' }],
      });
    }

    const assignment = await this.prisma.productionShiftAssignment.update({
      where: { id },
      data: {
        shiftId: nextShiftId,
        calendarId: nextCalendarId,
        effectiveFrom: dates.effectiveFrom,
        effectiveTo: dates.effectiveTo,
        isPrimary: dto.isPrimary !== undefined ? dto.isPrimary : existing.isPrimary,
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
      },
      include: this.assignmentIncludes(),
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionShiftAssignment', id, { code: assignment.code });
    return assignment;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    await this.prisma.productionShiftAssignment.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(userId, 'DELETE', 'ProductionShiftAssignment', id);
    return { message: 'Production shift assignment deleted successfully' };
  }

  async findCurrent(personId: string, on?: string, ctx?: ActiveOperationalContext): Promise<{ data: any[]; count: number }> {
    const reference = on ? new Date(on) : new Date();
    if (isNaN(reference.getTime())) throw this.validationError('date', 'production.invalidDate', 'date is not a valid date');
    await this.validatePerson(personId);

    const where: any = {
      operationalPersonId: personId,
      deletedAt: null,
      status: 'ACTIVE',
      effectiveFrom: { lte: reference },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: reference } }],
    };
    if (ctx) {
      where.companyId = ctx.companyId;
      where.branchId = ctx.branchId;
    }
    const assignments = await this.prisma.productionShiftAssignment.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { effectiveFrom: 'desc' }],
      include: this.assignmentIncludes(),
    });
    return { data: assignments, count: assignments.length };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const assignment = await this.prisma.productionShiftAssignment.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'ProductionShiftAssignment', id);
    return assignment;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const assignment = await this.prisma.productionShiftAssignment.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'ProductionShiftAssignment', id);
    return assignment;
  }
}