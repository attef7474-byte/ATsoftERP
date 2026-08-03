import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateProductionShiftDto } from './dto/create-production-shift.dto';
import { UpdateProductionShiftDto } from './dto/update-production-shift.dto';
import { ProductionShiftQueryDto } from './dto/production-shift-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class ProductionShiftsService {
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

  private notFound(messageKey = 'production.shiftNotFound', message = 'Production shift not found'): NotFoundException {
    return new NotFoundException({ messageKey, message });
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const shift = await this.prisma.productionShift.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!shift) throw this.notFound();
    return shift;
  }

  private validateTimes(dto: CreateProductionShiftDto): { startTime: string; endTime: string; durationMinutes: number; breakMinutes: number } {
    if (!TIME_PATTERN.test(dto.startTime)) {
      throw this.validationError('startTime', 'production.invalidTimeFormat', 'startTime must be in HH:mm format');
    }
    if (!TIME_PATTERN.test(dto.endTime)) {
      throw this.validationError('endTime', 'production.invalidTimeFormat', 'endTime must be in HH:mm format');
    }
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const start = toMin(dto.startTime);
    const end = toMin(dto.endTime);
    let durationMinutes = dto.durationMinutes;
    if (durationMinutes === undefined) {
      durationMinutes = end >= start ? end - start : 1440 - start + end;
    }
    const breakMinutes = dto.breakMinutes ?? 0;
    if (breakMinutes >= durationMinutes) {
      throw this.validationError('breakMinutes', 'production.invalidBreak', 'break minutes must be less than shift duration');
    }
    return { startTime: dto.startTime, endTime: dto.endTime, durationMinutes, breakMinutes };
  }

  async create(dto: CreateProductionShiftDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    const times = this.validateTimes(dto);
    const code = dto.code?.trim() ?? (await this.numberingService.generateNumberAtomic('PRODUCTION_SHIFT'));
    const existing = await this.prisma.productionShift.findFirst({
      where: { code, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'production.shiftCodeExists', 'Production shift code already exists');

    const shift = await this.prisma.productionShift.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes: times.durationMinutes,
        breakMinutes: times.breakMinutes,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
      },
    });
    await this.audit.log(userId, 'CREATE', 'ProductionShift', shift.id, { code: shift.code });
    return shift;
  }

  async findAll(query: ProductionShiftQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.productionShift.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          _count: {
            select: {
              templateDays: true,
              calendarEntries: true,
              shiftAssignments: true,
              operationalAssignments: true,
            },
          },
        },
      }),
      this.prisma.productionShift.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const shift = await this.findOwned(id, ctx);
    return this.prisma.productionShift.findUnique({
      where: { id: shift.id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            templateDays: true,
            calendarEntries: true,
            shiftAssignments: true,
            operationalAssignments: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateProductionShiftDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwned(id, ctx);
    if (dto.code && dto.code.trim() !== existing.code) {
      const duplicate = await this.prisma.productionShift.findFirst({
        where: { code: dto.code.trim(), companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (duplicate) throw this.validationError('code', 'production.shiftCodeExists', 'Production shift code already exists');
    }

    const nextStart = dto.startTime ?? existing.startTime;
    const nextEnd = dto.endTime ?? existing.endTime;
    if ((dto.startTime || dto.endTime) && !(TIME_PATTERN.test(nextStart) && TIME_PATTERN.test(nextEnd))) {
      throw this.validationError('startTime', 'production.invalidStart', 'start/end time must be in HH:mm format');
    }
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const startMin = toMin(nextStart);
    const endMin = toMin(nextEnd);
    const durationMinutes = dto.durationMinutes ?? (endMin >= startMin ? endMin - startMin : 1440 - startMin + endMin);
    const breakMinutes = dto.breakMinutes ?? existing.breakMinutes;
    if (breakMinutes >= durationMinutes) {
      throw this.validationError('breakMinutes', 'production.invalidBreak', 'break minutes must be less than shift duration');
    }

    const shift = await this.prisma.productionShift.update({
      where: { id },
      data: {
        code: dto.code?.trim() ?? existing.code,
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        description: dto.description !== undefined ? dto.description : existing.description,
        startTime: dto.startTime ?? existing.startTime,
        endTime: dto.endTime ?? existing.endTime,
        durationMinutes: dto.durationMinutes ?? durationMinutes,
        breakMinutes: dto.breakMinutes ?? existing.breakMinutes,
      },
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionShift', id, { code: shift.code });
    return shift;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const usedBy = await this.prisma.$transaction(async (tx) => {
      const [templateDays, calendarEntries, shiftAssignments, operationalAssignments] = await Promise.all([
        tx.productionShiftTemplateDay.count({ where: { shiftId: id } }),
        tx.productionShiftCalendarEntry.count({ where: { shiftId: id } }),
        tx.productionShiftAssignment.count({ where: { shiftId: id, deletedAt: null } }),
        tx.productionOperationalAssignment.count({ where: { shiftId: id, deletedAt: null } }),
      ]);
      return templateDays + calendarEntries + shiftAssignments + operationalAssignments;
    });
    if (usedBy > 0) {
      throw new ConflictException({ messageKey: 'production.shiftInUse', message: 'Shift is referenced by templates, calendars, or assignments' });
    }
    await this.prisma.productionShift.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(userId, 'DELETE', 'ProductionShift', id);
    return { message: 'Production shift deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const shift = await this.prisma.productionShift.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'ProductionShift', id);
    return shift;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const shift = await this.prisma.productionShift.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'ProductionShift', id);
    return shift;
  }
}