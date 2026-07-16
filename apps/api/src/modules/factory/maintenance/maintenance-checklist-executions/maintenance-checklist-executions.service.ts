import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceChecklistExecutionDto } from './dto/create-maintenance-checklist-execution.dto';
import { UpdateChecklistExecutionItemDto } from './dto/update-checklist-execution-item.dto';

@Injectable()
export class MaintenanceChecklistExecutionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateMaintenanceChecklistExecutionDto, userId: string) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id: dto.scheduleId },
      include: { checklistItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!schedule) throw new NotFoundException('Maintenance schedule not found');

    if (dto.requestId) {
      const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
      if (!request) throw new NotFoundException('Maintenance request not found');
    }

    const execution = await this.prisma.$transaction(async (tx) => {
      const exec = await tx.maintenanceChecklistExecution.create({
        data: {
          scheduleId: dto.scheduleId,
          requestId: dto.requestId,
          notes: dto.notes,
          startedAt: new Date(),
        },
      });

      if (schedule.checklistItems.length > 0) {
        await tx.maintenanceChecklistExecutionItem.createMany({
          data: schedule.checklistItems.map((item) => ({
            executionId: exec.id,
            checklistItemId: item.id,
            status: 'PENDING',
          })),
        });
      }

      return tx.maintenanceChecklistExecution.findUnique({
        where: { id: exec.id },
        include: {
          items: {
            include: { checklistItem: true },
            orderBy: { checklistItem: { sortOrder: 'asc' } },
          },
        },
      });
    });

    if (!execution) throw new Error('Failed to create checklist execution');
    await this.audit.log(userId, 'CREATE', 'MaintenanceChecklistExecution', execution.id,
      { scheduleId: dto.scheduleId, requestId: dto.requestId });
    return execution;
  }

  async findAll(query: { scheduleId?: string; requestId?: string; status?: string }) {
    const where: any = {};
    if (query.scheduleId) where.scheduleId = query.scheduleId;
    if (query.requestId) where.requestId = query.requestId;
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

  async findOne(id: string) {
    const execution = await this.prisma.maintenanceChecklistExecution.findUnique({
      where: { id },
      include: {
        schedule: { select: { id: true, title: true, type: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        completedBy: { select: { id: true, name: true } },
        items: {
          include: { checklistItem: true },
          orderBy: { checklistItem: { sortOrder: 'asc' } },
        },
      },
    });
    if (!execution) throw new NotFoundException('Checklist execution not found');
    return execution;
  }

  async complete(id: string, userId: string) {
    const execution = await this.findOne(id);
    if (execution.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only IN_PROGRESS executions can be completed');
    }

    const updated = await this.prisma.maintenanceChecklistExecution.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), completedById: userId },
    });

    await this.audit.log(userId, 'COMPLETE', 'MaintenanceChecklistExecution', id,
      { scheduleId: execution.scheduleId });
    return updated;
  }

  async updateItem(executionId: string, itemId: string, dto: UpdateChecklistExecutionItemDto, userId: string) {
    const execution = await this.findOne(executionId);
    if (execution.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Cannot update items on a completed execution');
    }

    const item = await this.prisma.maintenanceChecklistExecutionItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.executionId !== executionId) {
      throw new NotFoundException('Execution item not found');
    }

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.passed !== undefined) data.passed = dto.passed;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status === 'COMPLETED' || dto.passed !== undefined) {
      data.completedAt = new Date();
      data.completedById = userId;
    }

    const updated = await this.prisma.maintenanceChecklistExecutionItem.update({
      where: { id: itemId },
      data,
    });

    await this.audit.log(userId, 'UPDATE', 'MaintenanceChecklistExecutionItem', itemId,
      { executionId, status: dto.status, passed: dto.passed });
    return updated;
  }
}
