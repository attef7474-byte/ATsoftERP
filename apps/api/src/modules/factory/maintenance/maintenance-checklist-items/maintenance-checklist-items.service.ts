import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceChecklistItemDto } from './dto/create-maintenance-checklist-item.dto';
import { UpdateMaintenanceChecklistItemDto } from './dto/update-maintenance-checklist-item.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { normalizeChecklistItemConfig } from './checklist-item-validation';

@Injectable()
export class MaintenanceChecklistItemsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async scheduleAccess(scheduleId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id: scheduleId },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!schedule || !this.machineOwns(schedule.machine, ctx)) {
      throw this.notFound('maintenance.scheduleNotFound', 'Maintenance schedule not found');
    }
    return schedule;
  }

  private async itemAccess(id: string, ctx: ActiveOperationalContext) {
    const item = await this.prisma.maintenanceChecklistItem.findUnique({
      where: { id },
      include: { schedule: { include: { machine: { select: { id: true, companyId: true, branchId: true } } } } },
    });
    if (!item || !this.machineOwns(item.schedule.machine, ctx)) {
      throw this.notFound('maintenance.checklistItemNotFound', 'Checklist item not found');
    }
    return item;
  }

  async create(dto: CreateMaintenanceChecklistItemDto, userId: string, ctx: ActiveOperationalContext) {
    await this.scheduleAccess(dto.scheduleId, ctx);
    const config = normalizeChecklistItemConfig(dto, false);
    const item = await this.prisma.maintenanceChecklistItem.create({
      data: {
        scheduleId: dto.scheduleId,
        title: config.title as string,
        description: config.description,
        sortOrder: dto.sortOrder ?? 0,
        isMandatory: dto.isMandatory ?? false,
        resultType: config.resultType,
        minValue: config.minValue,
        maxValue: config.maxValue,
        unit: config.unit,
        isActive: true,
      },
    });
    await this.audit.log(userId, 'create', 'MaintenanceChecklistItem', item.id, { dto });
    return item;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; scheduleId?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { schedule: { machine: this.machineScopeWhere(ctx) } };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.scheduleId) {
      await this.scheduleAccess(query.scheduleId, ctx);
      where.scheduleId = query.scheduleId;
    }

    const [data, total] = await Promise.all([
      this.prisma.maintenanceChecklistItem.findMany({
        where, skip, take: limit, orderBy: { sortOrder: 'asc' },
        include: { schedule: { select: { id: true, title: true } } },
      }),
      this.prisma.maintenanceChecklistItem.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private machineScopeWhere(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const item = await this.itemAccess(id, ctx);
    const { schedule, ...rest } = item as any;
    return { ...rest, schedule: { id: schedule.id, title: schedule.title } };
  }

  async update(id: string, dto: UpdateMaintenanceChecklistItemDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.itemAccess(id, ctx);
    const config = normalizeChecklistItemConfig({ ...(existing as any), ...dto }, false);
    if (dto.scheduleId) await this.scheduleAccess(dto.scheduleId, ctx);
    const data: any = {
      title: config.title as string,
      description: config.description,
      resultType: config.resultType,
      minValue: config.minValue,
      maxValue: config.maxValue,
      unit: config.unit,
    };
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isMandatory !== undefined) data.isMandatory = dto.isMandatory;
    if (dto.scheduleId !== undefined) data.scheduleId = dto.scheduleId;
    const item = await this.prisma.maintenanceChecklistItem.update({ where: { id }, data });
    await this.audit.log(userId, 'update', 'MaintenanceChecklistItem', id, { dto });
    return item;
  }

  /** Soft-retire keeps historical execution snapshots and item history intact. */
  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.itemAccess(id, ctx);
    await this.prisma.maintenanceChecklistItem.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log(userId, 'retire', 'MaintenanceChecklistItem', id, { isActive: false });
    return { message: 'Checklist item retired successfully' };
  }
}
