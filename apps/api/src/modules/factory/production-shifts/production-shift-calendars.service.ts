import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import {
  CreateProductionShiftCalendarDto,
  UpdateProductionShiftCalendarDto,
  AddCalendarEntryDto,
  UpdateCalendarEntryDto,
  ProductionShiftCalendarQueryDto,
} from './dto/create-production-shift-calendar.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class ProductionShiftCalendarsService {
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
    return new NotFoundException({ messageKey: 'production.calendarNotFound', message: 'Production shift calendar not found' });
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const calendar = await this.prisma.productionShiftCalendar.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!calendar) throw this.notFound();
    return calendar;
  }

  private async validateTemplate(templateId: string | undefined, ctx: ActiveOperationalContext): Promise<void> {
    if (!templateId) return;
    const template = await this.prisma.productionShiftTemplate.findFirst({
      where: { id: templateId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!template) throw this.validationError('templateId', 'validation.invalidReference', 'Template not found in tenant context');
    if (template.status !== 'ACTIVE') {
      throw this.validationError('templateId', 'validation.invalidReference', 'Template is inactive');
    }
  }

  private async validateShift(shiftId: string | undefined, ctx: ActiveOperationalContext): Promise<void> {
    if (!shiftId) return;
    const shift = await this.prisma.productionShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!shift) throw this.validationError('shiftId', 'validation.invalidReference', 'Production shift not found in tenant context');
    if (shift.status !== 'ACTIVE') {
      throw this.validationError('shiftId', 'validation.invalidReference', 'Production shift is inactive');
    }
  }

  private validateEffectiveRange(effectiveFrom: string, effectiveTo?: string): { effectiveFrom: Date; effectiveTo: Date | null } {
    const from = new Date(effectiveFrom);
    if (isNaN(from.getTime())) throw this.validationError('effectiveFrom', 'production.invalidDate', 'effectiveFrom is not a valid date');
    let to: Date | null = null;
    if (effectiveTo !== undefined && effectiveTo !== null) {
      to = new Date(effectiveTo);
      if (isNaN(to.getTime())) throw this.validationError('effectiveTo', 'production.invalidDate', 'effectiveTo is not a valid date');
      if (to < from) throw this.validationError('effectiveTo', 'production.invalidDateRange', 'effectiveTo must not be before effectiveFrom');
    }
    return { effectiveFrom: from, effectiveTo: to };
  }

  private validateDateEntry(date: string, ctx: ActiveOperationalContext): Date {
    const d = new Date(date);
    if (isNaN(d.getTime())) throw this.validationError('date', 'production.invalidDate', 'date is not a valid date');
    return d;
  }

  async create(dto: CreateProductionShiftCalendarDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    await this.validateTemplate(dto.templateId, ctx);
    if (dto.entries) for (const entry of dto.entries) await this.validateShift(entry.shiftId, ctx);
    const range = this.validateEffectiveRange(dto.effectiveFrom, dto.effectiveTo);

    const code = dto.code?.trim() ?? (await this.numberingService.generateNumberAtomic('PRODUCTION_SHIFT_CALENDAR'));
    const existing = await this.prisma.productionShiftCalendar.findFirst({
      where: { code, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'production.calendarCodeExists', 'Calendar code already exists');

    const calendar = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productionShiftCalendar.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description ?? null,
          templateId: dto.templateId ?? null,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          effectiveFrom: range.effectiveFrom,
          effectiveTo: range.effectiveTo,
          status: 'ACTIVE',
        },
      });
      if (dto.entries) {
        const uniqueDates = new Set<string>();
        for (const entry of dto.entries) {
          const normalized = this.validateDateEntry(entry.date, ctx);
          if (uniqueDates.has(normalized.toISOString())) {
            throw new BadRequestException({ messageKey: 'common.validationFailed', message: 'Duplicate date in calendar entries', errors: [{ field: 'entries', code: 'production.duplicateEntryDate', message: 'Duplicate date in calendar entries' }] });
          }
          uniqueDates.add(normalized.toISOString());
        }
        await tx.productionShiftCalendarEntry.createMany({
          data: dto.entries.map((entry) => ({
            calendarId: created.id,
            date: this.validateDateEntry(entry.date, ctx),
            shiftId: entry.shiftId ?? null,
            isWorkDay: entry.isWorkDay ?? true,
            notes: entry.notes ?? null,
          })),
        });
      }
      return created;
    });
    await this.audit.log(userId, 'CREATE', 'ProductionShiftCalendar', calendar.id, { code: calendar.code });
    return calendar;
  }

  async findAll(query: ProductionShiftCalendarQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.effectiveOn) {
      const on = new Date(query.effectiveOn);
      if (isNaN(on.getTime())) throw this.validationError('effectiveOn', 'production.invalidDate', 'effectiveOn is not a valid date');
      where.effectiveFrom = { lte: on };
      where.OR = [
        { effectiveTo: null },
        { effectiveTo: { gte: on } },
      ];
      if (query.search) {
        where.AND = [
          {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
            ],
          },
        ];
        delete where.OR;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.productionShiftCalendar.findMany({
        where, skip, take: limit, orderBy: { effectiveFrom: 'desc' },
        include: {
          template: { select: { id: true, code: true, name: true } },
          _count: { select: { entries: true, shiftAssignments: true } },
        },
      }),
      this.prisma.productionShiftCalendar.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const calendar = await this.findOwned(id, ctx);
    return this.prisma.productionShiftCalendar.findUnique({
      where: { id: calendar.id },
      include: {
        template: { include: { days: { include: { shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } }, orderBy: { dayOfWeek: 'asc' } } } },
        entries: { include: { shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } }, orderBy: { date: 'asc' } },
        _count: { select: { shiftAssignments: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProductionShiftCalendarDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwned(id, ctx);
    if (dto.templateId !== undefined) await this.validateTemplate(dto.templateId || undefined, ctx);
    await this.validateEffectiveRange(
      dto.effectiveFrom ?? existing.effectiveFrom.toISOString(),
      dto.effectiveTo !== undefined ? (dto.effectiveTo ?? existing.effectiveTo?.toISOString()) : existing.effectiveTo?.toISOString(),
    );

    const calendar = await this.prisma.productionShiftCalendar.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        templateId: dto.templateId !== undefined ? (dto.templateId || null) : undefined,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo: dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : undefined,
      },
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionShiftCalendar', id, { code: calendar.code });
    return calendar;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const assignments = await this.prisma.productionShiftAssignment.count({ where: { calendarId: id, deletedAt: null } });
    if (assignments > 0) {
      throw new ConflictException({ messageKey: 'production.calendarInUse', message: 'Calendar is referenced by shift assignments' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.productionShiftCalendarEntry.deleteMany({ where: { calendarId: id } });
      await tx.productionShiftCalendar.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    await this.audit.log(userId, 'DELETE', 'ProductionShiftCalendar', id);
    return { message: 'Production shift calendar deleted successfully' };
  }

  async resolveDay(id: string, date: string, userId: string | undefined, ctx: ActiveOperationalContext) {
    const calendar = await this.findOwned(id, ctx);
    const on = new Date(date);
    if (isNaN(on.getTime())) throw this.validationError('date', 'production.invalidDate', 'date is not a valid date');
    if (on < calendar.effectiveFrom || (calendar.effectiveTo && on > calendar.effectiveTo)) {
      throw new BadRequestException({ messageKey: 'production.dateOutsideRange', message: 'Date is outside the calendar effective range' });
    }

    const entry = await this.prisma.productionShiftCalendarEntry.findUnique({
      where: { calendarId_date: { calendarId: id, date: on } },
      include: { shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } },
    });
    if (entry) {
      await this.audit.log(userId, 'RESOLVE', 'ProductionShiftCalendar', id, { date: on.toISOString(), via: 'entry' });
      return { date: on.toISOString(), source: 'ENTRY', isWorkDay: entry.isWorkDay, shift: entry.shiftId ? entry.shift : null };
    }

    if (!calendar.templateId) {
      return { date: on.toISOString(), source: 'NONE', isWorkDay: false, shift: null };
    }

    const dayOfWeek = on.getDay();
    const templateDay = await this.prisma.productionShiftTemplateDay.findUnique({
      where: { templateId_dayOfWeek: { templateId: calendar.templateId, dayOfWeek } },
      include: { shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } },
    });
    if (!templateDay) {
      return { date: on.toISOString(), source: 'TEMPLATE', isWorkDay: false, shift: null };
    }
    await this.audit.log(userId, 'RESOLVE', 'ProductionShiftCalendar', id, { date: on.toISOString(), via: 'template day', dayOfWeek });
    return {
      date: on.toISOString(),
      source: 'TEMPLATE',
      isWorkDay: templateDay.isWorkDay,
      shift: templateDay.isWorkDay && templateDay.shift ? templateDay.shift : null,
    };
  }

  async addEntry(id: string, dto: AddCalendarEntryDto, userId: string, ctx: ActiveOperationalContext) {
    const calendar = await this.findOwned(id, ctx);
    if (calendar.status !== 'ACTIVE') throw new BadRequestException({ messageKey: 'production.calendarInactive', message: 'Cannot add entries to an inactive calendar' });
    await this.validateShift(dto.shiftId, ctx);
    const date = this.validateDateEntry(dto.date, ctx);
    if (date < calendar.effectiveFrom || (calendar.effectiveTo && date > calendar.effectiveTo)) {
      throw new BadRequestException({ messageKey: 'production.dateOutsideRange', message: 'Entry date is outside the calendar effective range' });
    }

    const duplicate = await this.prisma.productionShiftCalendarEntry.findUnique({
      where: { calendarId_date: { calendarId: id, date } },
    });
    if (duplicate) throw this.validationError('date', 'production.duplicateEntryDate', 'A calendar entry already exists for this date');

    const entry = await this.prisma.productionShiftCalendarEntry.create({
      data: {
        calendarId: id,
        date,
        shiftId: dto.shiftId ?? null,
        isWorkDay: dto.isWorkDay ?? true,
        notes: dto.notes ?? null,
      },
      include: { shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } },
    });
    await this.audit.log(userId, 'CREATE', 'ProductionShiftCalendarEntry', entry.id, { calendarId: id, date: date.toISOString() });
    return entry;
  }

  async updateEntry(id: string, entryId: string, dto: UpdateCalendarEntryDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    await this.validateShift(dto.shiftId, ctx);
    const existing = await this.prisma.productionShiftCalendarEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.calendarId !== id) {
      throw this.notFound();
    }
    const entry = await this.prisma.productionShiftCalendarEntry.update({
      where: { id: entryId },
      data: {
        shiftId: dto.shiftId !== undefined ? (dto.shiftId || null) : existing.shiftId,
        isWorkDay: dto.isWorkDay !== undefined ? dto.isWorkDay : existing.isWorkDay,
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
      },
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionShiftCalendarEntry', entryId, { calendarId: id });
    return entry;
  }

  async removeEntry(id: string, entryId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const existing = await this.prisma.productionShiftCalendarEntry.findUnique({ where: { id: entryId } });
    if (!existing || existing.calendarId !== id) {
      throw this.notFound();
    }
    await this.prisma.productionShiftCalendarEntry.delete({ where: { id: entryId } });
    await this.audit.log(userId, 'DELETE', 'ProductionShiftCalendarEntry', entryId, { calendarId: id });
    return { message: 'Calendar entry deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const calendar = await this.prisma.productionShiftCalendar.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'ProductionShiftCalendar', id);
    return calendar;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const calendar = await this.prisma.productionShiftCalendar.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'ProductionShiftCalendar', id);
    return calendar;
  }
}