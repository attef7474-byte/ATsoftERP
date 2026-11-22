import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';
import { ScheduleChecklistItemDto } from './dto/schedule-checklist-item.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { PreventiveScheduleDuplicateGuard } from './preventive-schedule-duplicate.guard';
import { normalizeChecklistItemConfig, withDeterministicSortOrder } from '../maintenance-checklist-items/checklist-item-validation';
import { MaintenanceChecklistStartAuthorityService } from '../maintenance-checklist-executions/maintenance-checklist-start-authority.service';
import { calculateNextDueDate, dueStatusWhere, effectiveDueCompare, generationClaimWhere, getEffectiveDueDate, withDueAuthority } from './schedule-due-authority';

interface PreparedChecklistItem {
  id?: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isMandatory: boolean;
  resultType: string;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
}

@Injectable()
export class MaintenanceSchedulesService {
  private readonly startAuthority: MaintenanceChecklistStartAuthorityService;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private duplicateGuard: PreventiveScheduleDuplicateGuard,
  ) {
    this.startAuthority = new MaintenanceChecklistStartAuthorityService(prisma, audit);
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string, params?: Record<string, string>): BadRequestException {
    return new BadRequestException({ messageKey: key, message, ...(params ? { params } : {}) });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private prepareChecklistItems(items: ScheduleChecklistItemDto[] | undefined): PreparedChecklistItem[] {
    if (!items) return [];
    return withDeterministicSortOrder(items.map((item) => {
      const config = normalizeChecklistItemConfig(item, false);
      return {
        id: item.id,
        title: config.title as string,
        description: config.description,
        resultType: config.resultType,
        minValue: config.minValue,
        maxValue: config.maxValue,
        unit: config.unit,
        isMandatory: item.isMandatory ?? false,
        sortOrder: item.sortOrder ?? 0,
      };
    }));
  }

  private templateCreateData(scheduleId: string, item: PreparedChecklistItem) {
    return {
      scheduleId,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      isMandatory: item.isMandatory,
      resultType: item.resultType,
      minValue: item.minValue,
      maxValue: item.maxValue,
      unit: item.unit,
      isActive: true,
    };
  }

  private async validateScheduleMachine(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  private async validateRequest(requestId: string | undefined, machineId: string, ctx: ActiveOperationalContext) {
    if (!requestId) return;
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    if (request.machineId !== machineId) {
      throw this.badRequest('maintenance.requestMachineMismatch', 'Maintenance request does not belong to the selected machine');
    }
    const machine = await this.prisma.machine.findUnique({ where: { id: request.machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
  }

  private computeDueStatus(schedule: any, now: Date = new Date()): string {
    return withDueAuthority(schedule, now).dueStatus;
  }

  async create(dto: CreateMaintenanceScheduleDto, userId: string, ctx: ActiveOperationalContext) {
    await this.validateScheduleMachine(dto.machineId, ctx);
    await this.validateRequest(dto.requestId, dto.machineId, ctx);
    const prepared = this.prepareChecklistItems(dto.checklistItems);

    const data: any = { ...dto };
    delete data.checklistItems;
    data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    data.nextDueDate = data.startDate;

    const identity = {
      machineId: dto.machineId,
      type: dto.type,
      frequency: dto.frequency,
      intervalDays: dto.intervalDays ?? null,
    };

    const schedule = await this.prisma.$transaction(async (tx) => {
      await this.duplicateGuard.acquireLock(tx as any, identity);
      await this.duplicateGuard.assertNoEquivalentActive(tx as any, identity);
      const created = await tx.maintenanceSchedule.create({ data });
      if (prepared.length) {
        await tx.maintenanceChecklistItem.createMany({
          data: prepared.map((item) => this.templateCreateData(created.id, item)),
        });
      }
      return created;
    }, { maxWait: 5000, timeout: 10000 });

    await this.audit.log(userId, 'CREATE', 'MaintenanceSchedule', schedule.id,
      { machineId: dto.machineId, checklistItemCount: prepared.length });
    return schedule;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; status?: string; type?: string;
    dueBefore?: string; dueStatus?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: any = { machine: this.machineScope(ctx) };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.machineId) {
      await this.validateScheduleMachine(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.dueBefore) {
      where.AND = [...(where.AND || []), effectiveDueCompare('lte', new Date(query.dueBefore))];
    }
    if (query.dueStatus) {
      where.AND = [...(where.AND || []), dueStatusWhere(query.dueStatus, now)];
    }

    const [data, total] = await Promise.all([
      this.prisma.maintenanceSchedule.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.maintenanceSchedule.count({ where }),
    ]);

    const enriched = data.map((item: any) => withDueAuthority(item, now));

    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true, status: true, companyId: true, branchId: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        // The editor and start snapshot use only current active template items;
        // retired items remain available only through historical snapshots.
        checklistItems: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!schedule) throw this.notFound('maintenance.scheduleNotFound', 'Maintenance schedule not found');
    if (!this.machineOwns(schedule.machine, ctx)) throw this.notFound('maintenance.scheduleNotFound', 'Maintenance schedule not found');
    return withDueAuthority(schedule);
  }

  async update(id: string, dto: UpdateMaintenanceScheduleDto, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    if (dto.machineId && dto.machineId !== schedule.machineId) {
      await this.validateScheduleMachine(dto.machineId, ctx);
      await this.validateRequest(dto.requestId, dto.machineId, ctx);
    } else if (dto.requestId) {
      await this.validateRequest(dto.requestId, schedule.machineId, ctx);
    }
    const hasChecklist = dto.checklistItems !== undefined;
    const prepared = this.prepareChecklistItems(dto.checklistItems);

    const data: any = { ...dto };
    delete data.checklistItems;
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    const identity = {
      machineId: dto.machineId ?? schedule.machineId,
      type: dto.type ?? schedule.type,
      frequency: dto.frequency ?? schedule.frequency,
      intervalDays: dto.intervalDays !== undefined ? dto.intervalDays : (schedule.intervalDays ?? null),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      if (schedule.status === 'ACTIVE') {
        await this.duplicateGuard.acquireLock(tx as any, identity);
        await this.duplicateGuard.assertNoEquivalentActive(tx as any, identity, id);
      }
      const result = await tx.maintenanceSchedule.update({ where: { id }, data });
      if (hasChecklist) {
        const existing = await tx.maintenanceChecklistItem.findMany({
          where: { scheduleId: id },
          select: { id: true },
        });
        const desiredIds = new Set(prepared.filter((item) => !!item.id).map((item) => item.id as string));
        const retiredIds = existing
          .map((item: any) => item.id as string)
          .filter((itemId: string) => !desiredIds.has(itemId));
        if (retiredIds.length) {
          await tx.maintenanceChecklistItem.updateMany({
            where: { scheduleId: id, id: { in: retiredIds } },
            data: { isActive: false },
          });
        }
        for (const item of prepared) {
          if (item.id) {
            const owned = await tx.maintenanceChecklistItem.findFirst({
              where: { id: item.id, scheduleId: id },
              select: { id: true },
            });
            if (!owned) throw this.notFound('maintenance.checklistItemNotFound', 'Checklist item not found');
            await tx.maintenanceChecklistItem.update({
              where: { id: item.id },
              data: {
                title: item.title,
                description: item.description,
                sortOrder: item.sortOrder,
                isMandatory: item.isMandatory,
                resultType: item.resultType,
                minValue: item.minValue,
                maxValue: item.maxValue,
                unit: item.unit,
                isActive: true,
              },
            });
          } else {
            await tx.maintenanceChecklistItem.create({ data: this.templateCreateData(id, item) });
          }
        }
      }
      return result;
    }, { maxWait: 5000, timeout: 10000 });

    await this.audit.log(userId, 'UPDATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, checklistItemsChanged: hasChecklist, checklistItemCount: prepared.length });
    return updated;
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    const identity = {
      machineId: schedule.machineId,
      type: schedule.type,
      frequency: schedule.frequency,
      intervalDays: schedule.intervalDays ?? null,
    };
    await this.prisma.$transaction(async (tx) => {
      await this.duplicateGuard.acquireLock(tx as any, identity);
      await this.duplicateGuard.assertNoEquivalentActive(tx as any, identity, id);
      await tx.maintenanceSchedule.update({ where: { id }, data: { status: 'ACTIVE' } });
    }, { maxWait: 5000, timeout: 10000 });
    await this.audit.log(userId, 'ACTIVATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, newStatus: 'ACTIVE' });
    return this.findOne(id, ctx);
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'MaintenanceSchedule', id,
      { oldStatus: schedule.status, newStatus: 'INACTIVE' });
    return this.findOne(id, ctx);
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    await this.prisma.maintenanceSchedule.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceSchedule', id,
      { status: schedule.status });
    return { message: 'Maintenance schedule deactivated successfully' };
  }

  async execute(id: string, requestId: string | undefined, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    if (requestId) await this.validateRequest(requestId, schedule.machineId, ctx);
    // All start paths delegate to the single canonical authority.
    const execution = await this.startAuthority.start({
      scheduleId: id,
      requestId: requestId || undefined,
      userId,
      ctx,
      source: 'SCHEDULE',
    });
    await this.audit.log(userId, 'EXECUTE', 'MaintenanceSchedule', id,
      { executionId: execution.id, requestId });
    return execution;
  }

  async generateRequest(id: string, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.findOne(id, ctx);
    const now = new Date();
    if (schedule.status !== 'ACTIVE') throw new BadRequestException('Only active schedules can generate requests');

    const effectiveDueDate = getEffectiveDueDate(schedule);
    if (effectiveDueDate.getTime() > now.getTime()) {
      throw new ConflictException('This schedule occurrence is not due yet; nextDueDate has already been advanced.');
    }
    const endDate = schedule.endDate ? new Date(schedule.endDate) : null;
    if (endDate && endDate.getTime() < now.getTime()) {
      throw new BadRequestException('This schedule has expired and cannot generate requests');
    }

    const existingRequest = await this.prisma.maintenanceRequest.findFirst({
      where: {
        machineId: schedule.machineId,
        type: schedule.type,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        deletedAt: null,
      },
    });
    if (existingRequest) throw new ConflictException('An active request already exists for this schedule. Complete or cancel the existing request before generating a new one.');

    const generatedAt = new Date();
    let advancedNextDue: Date | null = null;
    const request = await this.prisma.$transaction(async (tx) => {
      // Optimistic occurrence claim: a concurrent/retried call that still sees
      // the same nextDueDate + lastGeneratedAt may advance it; a loser cannot.
      const claim = await tx.maintenanceSchedule.updateMany({
        where: generationClaimWhere(schedule),
        data: { lastGeneratedAt: generatedAt },
      });
      if (claim.count !== 1) {
        throw new ConflictException('This due occurrence was already generated by another request.');
      }

      const requestNumber = await this.numberingService.generateNumberAtomicWithClient('MAINTENANCE_REQUEST', tx);
      const nextDue = calculateNextDueDate(schedule, generatedAt);
      advancedNextDue = nextDue;

      await tx.maintenanceSchedule.update({
        where: { id },
        data: { lastGeneratedAt: generatedAt, nextDueDate: nextDue, requestId: null },
      });

      return tx.maintenanceRequest.create({
        data: {
          requestNumber,
          machineId: schedule.machineId,
          type: schedule.type || 'PREVENTIVE',
          priority: 'MEDIUM',
          title: `Preventive: ${schedule.title}`,
          description: `Auto-generated from schedule ${schedule.title}`,
          requestedById: userId,
          status: 'OPEN',
        },
      });
    });

    await this.audit.log(userId, 'GENERATE', 'MaintenanceSchedule', id, {
      requestId: request.id,
      previousEffectiveDueDate: effectiveDueDate,
      previousNextDueDate: schedule.nextDueDate ?? null,
      nextDueDate: advancedNextDue,
      lastGeneratedAt: generatedAt,
    });
    return request;
  }

  async getHistory(id: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    const page = query.page || 1;
    const limit = query.limit || 10;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceChecklistExecution.findMany({
        where: { scheduleId: id },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          request: { select: { id: true, requestNumber: true, title: true } },
          startedBy: { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
          items: {
            include: {
              checklistItem: { select: { id: true, title: true } },
              completedBy: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.maintenanceChecklistExecution.count({ where: { scheduleId: id } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
