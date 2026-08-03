import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateProductionShiftTemplateDto, UpdateProductionShiftTemplateDto, TemplateDayDto } from './dto/create-production-shift-template.dto';
import { ProductionShiftTemplateQueryDto } from './dto/production-shift-template-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class ProductionShiftTemplatesService {
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
    return new NotFoundException({ messageKey: 'production.templateNotFound', message: 'Production shift template not found' });
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const template = await this.prisma.productionShiftTemplate.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!template) throw this.notFound();
    return template;
  }

  private async validateShift(shiftId: string, ctx: ActiveOperationalContext): Promise<void> {
    const shift = await this.prisma.productionShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!shift) throw this.validationError('shiftId', 'validation.invalidReference', 'Production shift not found in tenant context');
    if (shift.status !== 'ACTIVE') {
      throw this.validationError('shiftId', 'validation.invalidReference', 'Production shift is inactive');
    }
  }

  private async validateDays(days: TemplateDayDto[], ctx: ActiveOperationalContext): Promise<void> {
    if (!days || days.length === 0) {
      throw this.validationError('days', 'production.daysRequired', 'At least one template day is required');
    }
    const seen = new Set<number>();
    for (const day of days) {
      if (seen.has(day.dayOfWeek)) {
        throw this.validationError('days', 'production.duplicateDayOfWeek', 'Duplicate day of week in template days');
      }
      seen.add(day.dayOfWeek);
      if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw this.validationError('days', 'production.invalidDayOfWeek', 'dayOfWeek must be between 0 and 6');
      }
      await this.validateShift(day.shiftId, ctx);
    }
  }

  async create(dto: CreateProductionShiftTemplateDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    await this.validateDays(dto.days, ctx);
    const code = dto.code?.trim() ?? (await this.numberingService.generateNumberAtomic('PRODUCTION_SHIFT_TEMPLATE'));
    const existing = await this.prisma.productionShiftTemplate.findFirst({
      where: { code, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'production.templateCodeExists', 'Template code already exists');

    const template = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productionShiftTemplate.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description ?? null,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: 'ACTIVE',
        },
      });
      await tx.productionShiftTemplateDay.createMany({
        data: dto.days.map((day) => ({
          templateId: created.id,
          dayOfWeek: day.dayOfWeek,
          shiftId: day.shiftId,
          isWorkDay: day.isWorkDay ?? true,
          sortOrder: day.sortOrder ?? 0,
        })),
      });
      return created;
    });
    await this.audit.log(userId, 'CREATE', 'ProductionShiftTemplate', template.id, { code: template.code, days: dto.days.length });
    return template;
  }

  async findAll(query: ProductionShiftTemplateQueryDto, ctx: ActiveOperationalContext) {
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

    const [data, total] = await Promise.all([
      this.prisma.productionShiftTemplate.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          days: {
            include: { shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } },
            orderBy: { dayOfWeek: 'asc' },
          },
          _count: { select: { calendars: true } },
        },
      }),
      this.prisma.productionShiftTemplate.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const template = await this.findOwned(id, ctx);
    return this.prisma.productionShiftTemplate.findUnique({
      where: { id: template.id },
      include: {
        days: {
          include: { shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } } },
          orderBy: { dayOfWeek: 'asc' },
        },
        _count: { select: { calendars: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProductionShiftTemplateDto, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    if (dto.days !== undefined) await this.validateDays(dto.days, ctx);

    const template = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.productionShiftTemplate.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          description: dto.description !== undefined ? dto.description : undefined,
        },
      });
      if (dto.days !== undefined) {
        await tx.productionShiftTemplateDay.deleteMany({ where: { templateId: id } });
        await tx.productionShiftTemplateDay.createMany({
          data: dto.days.map((day) => ({
            templateId: id,
            dayOfWeek: day.dayOfWeek,
            shiftId: day.shiftId,
            isWorkDay: day.isWorkDay ?? true,
            sortOrder: day.sortOrder ?? 0,
          })),
        });
      }
      return updated;
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionShiftTemplate', id, { code: template.code });
    return template;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const usedByCalendars = await this.prisma.productionShiftCalendar.count({
      where: { templateId: id, deletedAt: null },
    });
    if (usedByCalendars > 0) {
      throw new ConflictException({ messageKey: 'production.templateInUse', message: 'Template is referenced by shift calendars' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.productionShiftTemplateDay.deleteMany({ where: { templateId: id } });
      await tx.productionShiftTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    await this.audit.log(userId, 'DELETE', 'ProductionShiftTemplate', id);
    return { message: 'Production shift template deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const template = await this.prisma.productionShiftTemplate.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'ProductionShiftTemplate', id);
    return template;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const template = await this.prisma.productionShiftTemplate.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'ProductionShiftTemplate', id);
    return template;
  }
}