import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceChecklistExecutionDto } from './dto/create-maintenance-checklist-execution.dto';
import { UpdateChecklistExecutionItemDto } from './dto/update-checklist-execution-item.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceChecklistExecutionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string, params?: Record<string, string>): BadRequestException {
    return new BadRequestException({ messageKey: key, message, ...(params ? { params } : {}) });
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

  private async requestAccess(requestId: string | undefined, machineId: string, ctx: ActiveOperationalContext) {
    if (!requestId) return;
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    if (request.machineId !== machineId) {
      throw this.badRequest('maintenance.requestMachineMismatch', 'Maintenance request does not belong to the selected schedule machine');
    }
    const machine = await this.prisma.machine.findUnique({ where: { id: request.machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
  }

  async create(dto: CreateMaintenanceChecklistExecutionDto, userId: string, ctx: ActiveOperationalContext) {
    const schedule = await this.scheduleAccess(dto.scheduleId, ctx);
    await this.requestAccess(dto.requestId, schedule.machineId, ctx);

    const checklistItems = await this.prisma.maintenanceChecklistItem.findMany({
      where: { scheduleId: dto.scheduleId },
      orderBy: { sortOrder: 'asc' },
    });

    const execution = await this.prisma.$transaction(async (tx) => {
      const exec = await tx.maintenanceChecklistExecution.create({
        data: {
          scheduleId: dto.scheduleId,
          requestId: dto.requestId,
          notes: dto.notes,
          startedAt: new Date(),
        },
      });

      if (checklistItems.length > 0) {
        await tx.maintenanceChecklistExecutionItem.createMany({
          data: checklistItems.map((item) => ({
            executionId: exec.id,
            checklistItemId: item.id,
            status: 'PENDING',
            itemTitleSnapshot: item.title,
            itemSortOrderSnapshot: item.sortOrder,
            itemMandatorySnapshot: item.isMandatory,
            resultTypeSnapshot: item.resultType,
            minValueSnapshot: item.minValue ?? null,
            maxValueSnapshot: item.maxValue ?? null,
          })),
        });
      }

      return tx.maintenanceChecklistExecution.findUnique({
        where: { id: exec.id },
        include: {
          items: {
            include: { checklistItem: true },
            orderBy: { itemSortOrderSnapshot: 'asc' },
          },
        },
      });
    });

    if (!execution) throw new Error('Failed to create checklist execution');
    await this.audit.log(userId, 'CREATE', 'MaintenanceChecklistExecution', execution.id,
      { scheduleId: dto.scheduleId, requestId: dto.requestId });
    return execution;
  }

  async findAll(query: { scheduleId?: string; requestId?: string; status?: string }, ctx: ActiveOperationalContext) {
    const where: any = { schedule: { machine: this.machineScopeWhere(ctx) } };
    if (query.scheduleId) {
      await this.scheduleAccess(query.scheduleId, ctx);
      where.scheduleId = query.scheduleId;
    }
    if (query.requestId) {
      const request = await this.prisma.maintenanceRequest.findUnique({
        where: { id: query.requestId },
        include: { machine: { select: { id: true, companyId: true, branchId: true } } },
      });
      if (!request || !this.machineOwns(request.machine, ctx)) {
        throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
      }
      where.requestId = query.requestId;
    }
    if (query.status) where.status = query.status;

    return this.prisma.maintenanceChecklistExecution.findMany({
      where,
      include: {
        schedule: { select: { id: true, title: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        completedBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private machineScopeWhere(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const execution = await this.prisma.maintenanceChecklistExecution.findUnique({
      where: { id },
      include: {
        schedule: { select: { id: true, title: true, type: true, machineId: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        completedBy: { select: { id: true, name: true } },
        items: {
          include: { checklistItem: true },
          orderBy: { itemSortOrderSnapshot: 'asc' },
        },
      },
    });
    if (!execution) throw this.notFound('maintenance.executionNotFound', 'Checklist execution not found');
    const machine = await this.prisma.machine.findUnique({
      where: { id: execution.schedule.machineId },
      select: { companyId: true, branchId: true },
    });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.executionNotFound', 'Checklist execution not found');
    return execution;
  }

  async complete(id: string, userId: string, ctx: ActiveOperationalContext) {
    const execution = await this.findOne(id, ctx);
    if (execution.status !== 'IN_PROGRESS') {
      throw this.badRequest('maintenance.executionNotInProgress', 'Only IN_PROGRESS executions can be completed');
    }

    const pendingItems = execution.items.filter((item: any) => item.status === 'PENDING');
    const pendingMandatory = pendingItems.filter((item: any) =>
      item.itemMandatorySnapshot ?? item.checklistItem?.isMandatory);
    if (pendingMandatory.length > 0) {
      throw this.badRequest('maintenance.mandatoryItemsPending', `Cannot complete checklist: ${pendingMandatory.length} mandatory item(s) still pending. Complete all mandatory items first.`);
    }

    for (const item of execution.items) {
      if (item.status === 'COMPLETED') {
        const resultType = item.resultTypeSnapshot || item.checklistItem?.resultType || 'PASS_FAIL';
        if (['NUMBER', 'READING'].includes(resultType)) {
          const value = item.resultValue !== null && item.resultValue !== undefined ? Number(item.resultValue) : NaN;
          if (Number.isNaN(value)) {
            throw this.badRequest('maintenance.resultValueRequired', `Item "${item.itemTitleSnapshot || item.checklistItem?.title}" requires a numeric result value`);
          }
          const min = item.minValueSnapshot ?? item.checklistItem?.minValue;
          const max = item.maxValueSnapshot ?? item.checklistItem?.maxValue;
          if (min !== null && min !== undefined && value < min) {
            throw this.badRequest('maintenance.resultValueOutOfRange', `Item "${item.itemTitleSnapshot || item.checklistItem?.title}" value is below the allowed minimum`);
          }
          if (max !== null && max !== undefined && value > max) {
            throw this.badRequest('maintenance.resultValueOutOfRange', `Item "${item.itemTitleSnapshot || item.checklistItem?.title}" value is above the allowed maximum`);
          }
        }
      }
    }

    const updated = await this.prisma.maintenanceChecklistExecution.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
    });

    await this.audit.log(userId, 'COMPLETE', 'MaintenanceChecklistExecution', id,
      { scheduleId: execution.scheduleId });
    return updated;
  }

  async updateItemDirect(itemId: string, dto: UpdateChecklistExecutionItemDto, userId: string, ctx: ActiveOperationalContext) {
    const item = await this.prisma.maintenanceChecklistExecutionItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw this.notFound('maintenance.executionItemNotFound', 'Execution item not found');
    return this.updateItem(item.executionId, itemId, dto, userId, ctx);
  }

  async updateItem(executionId: string, itemId: string, dto: UpdateChecklistExecutionItemDto, userId: string, ctx: ActiveOperationalContext) {
    const execution = await this.findOne(executionId, ctx);
    if (execution.status !== 'IN_PROGRESS') {
      throw this.badRequest('maintenance.executionNotInProgress', 'Cannot update items on a completed execution');
    }

    const item = await this.prisma.maintenanceChecklistExecutionItem.findUnique({
      where: { id: itemId },
      include: { checklistItem: true },
    });
    if (!item || item.executionId !== executionId) {
      throw this.notFound('maintenance.executionItemNotFound', 'Execution item not found');
    }

    const resultType = item.resultTypeSnapshot || item.checklistItem?.resultType || 'PASS_FAIL';
    const minValue = item.minValueSnapshot ?? item.checklistItem?.minValue;
    const maxValue = item.maxValueSnapshot ?? item.checklistItem?.maxValue;

    const data: any = {};
    if (dto.resultValue !== undefined) data.resultValue = dto.resultValue;
    if (dto.notes !== undefined) data.notes = dto.notes;

    let completed = false;

    if (resultType === 'PASS_FAIL') {
      if (dto.status) {
        if (!['OK', 'NOT_OK', 'NA'].includes(dto.status)) {
          throw this.badRequest('maintenance.invalidExecutionStatus', 'Invalid status for PASS_FAIL item');
        }
        data.status = dto.status === 'OK' || dto.status === 'NOT_OK' ? 'COMPLETED' : 'COMPLETED';
        data.passed = dto.status === 'OK' ? true : dto.status === 'NOT_OK' ? false : null;
        data.resultValue = dto.status;
        completed = true;
      } else if (dto.passed !== undefined) {
        data.passed = dto.passed;
        data.status = 'COMPLETED';
        data.resultValue = dto.passed ? 'OK' : 'NOT_OK';
        completed = true;
      }
    } else if (resultType === 'BOOLEAN') {
      if (dto.passed !== undefined) {
        data.passed = dto.passed;
        data.resultValue = dto.resultValue ?? String(dto.passed);
        completed = true;
      }
      if (dto.status) {
        if (!['COMPLETED', 'PENDING'].includes(dto.status)) {
          throw this.badRequest('maintenance.invalidExecutionStatus', 'Invalid status for BOOLEAN item');
        }
        data.status = dto.status;
      }
    } else if (resultType === 'NUMBER' || resultType === 'READING') {
      if (dto.resultValue !== undefined) {
        const value = Number(dto.resultValue);
        if (dto.resultValue.trim() === '' || Number.isNaN(value)) {
          throw this.badRequest('maintenance.resultValueRequired', 'Numeric result value is required');
        }
        if (minValue !== null && minValue !== undefined && value < minValue) {
          data.passed = false;
        } else if (maxValue !== null && maxValue !== undefined && value > maxValue) {
          data.passed = false;
        } else {
          data.passed = true;
        }
        data.status = 'COMPLETED';
        completed = true;
      }
      if (dto.status) {
        if (dto.status === 'PENDING') data.status = 'PENDING';
        else if (dto.status === 'COMPLETED') data.status = 'COMPLETED';
        else throw this.badRequest('maintenance.invalidExecutionStatus', 'Invalid status for numeric item');
      }
    } else if (resultType === 'TEXT') {
      if (dto.resultValue !== undefined && dto.resultValue.trim() !== '') {
        data.resultValue = dto.resultValue;
        data.status = 'COMPLETED';
        data.passed = null;
        completed = true;
      }
      if (dto.status) {
        if (dto.status === 'PENDING') data.status = 'PENDING';
        else if (dto.status === 'COMPLETED') data.status = 'COMPLETED';
        else throw this.badRequest('maintenance.invalidExecutionStatus', 'Invalid status for TEXT item');
      }
    }

    if (completed || data.passed !== undefined) {
      data.completedAt = new Date();
      data.completedById = userId;
    }

    const updated = await this.prisma.maintenanceChecklistExecutionItem.update({
      where: { id: itemId },
      data,
    });

    await this.audit.log(userId, 'UPDATE', 'MaintenanceChecklistExecutionItem', itemId,
      { executionId, status: dto.status, passed: dto.passed, resultValue: dto.resultValue });
    return updated;
  }
}
