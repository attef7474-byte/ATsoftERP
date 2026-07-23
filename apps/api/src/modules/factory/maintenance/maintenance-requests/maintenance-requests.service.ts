import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';

@Injectable()
export class MaintenanceRequestsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async validateOperationalContext(dto: { machineId: string; productionLineId?: string; machineComponentId?: string; operationTypeId?: string; costCenterId?: string }, requestId?: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('Machine not found');

    if (dto.productionLineId) {
      const pl = await this.prisma.productionLine.findUnique({ where: { id: dto.productionLineId } });
      if (!pl) throw new NotFoundException('Production line not found');
      if (machine.productionLineId && dto.productionLineId !== machine.productionLineId) {
        throw new BadRequestException('Production line does not match machine');
      }
    }
    if (dto.machineComponentId) {
      const comp = await this.prisma.machineComponent.findUnique({ where: { id: dto.machineComponentId } });
      if (!comp) throw new NotFoundException('Machine component not found');
      if (comp.machineId !== dto.machineId) {
        throw new BadRequestException('Component does not belong to selected machine');
      }
    }
    if (dto.operationTypeId) {
      const ot = await this.prisma.operationType.findUnique({ where: { id: dto.operationTypeId } });
      if (!ot) throw new NotFoundException('Operation type not found');
    }
    if (dto.costCenterId) {
      const cc = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
      if (!cc) throw new NotFoundException('Cost center not found');
    }
    return machine;
  }

  async create(dto: CreateMaintenanceRequestDto, userId: string) {
    const machine = await this.validateOperationalContext(dto);

    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'MAINTENANCE_REQUEST' } });
    if (!seq) throw new NotFoundException('Number sequence MAINTENANCE_REQUEST not configured');

    const { machineId, assignedToId, requiredParts, ...rest } = dto;

    const request = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: 1 } },
      });
      const requestNumber = `${updated.prefix}${String(updated.currentNumber).padStart(updated.padding, '0')}`;

      return tx.maintenanceRequest.create({
        data: {
          ...rest,
          requestNumber,
          machineId,
          assignedToId,
          requestedById: userId,
          priority: dto.priority || 'MEDIUM',
          requiredParts: requiredParts && requiredParts.length > 0 ? {
            create: requiredParts.map(p => ({
              sparePartId: p.sparePartId,
              machineComponentId: p.machineComponentId,
              machineId: p.machineId,
              quantity: p.quantity,
              unit: p.unit,
              usageNote: p.usageNote,
              isPrimary: p.isPrimary,
            })),
          } : undefined,
        },
      });
    });

    await this.audit.log(userId, 'CREATE', 'MaintenanceRequest', request.id,
      { requestNumber: request.requestNumber, machineId });
    return request;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; status?: string; type?: string; priority?: string;
    requestedById?: string; assignedToId?: string;
    productionLineId?: string; machineComponentId?: string; operationTypeId?: string; costCenterId?: string; sparePartId?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { requestNumber: { contains: query.search } },
      ];
    }
    if (query.machineId) where.machineId = query.machineId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;
    if (query.requestedById) where.requestedById = query.requestedById;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.operationTypeId) where.operationTypeId = query.operationTypeId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.sparePartId) {
      where.requiredParts = { some: { sparePartId: query.sparePartId } };
    }

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          productionLine: { select: { id: true, code: true, name: true } },
          machineComponent: { select: { id: true, code: true, name: true } },
          operationType: { select: { id: true, code: true, name: true } },
          costCenter: { select: { id: true, code: true, name: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { tasks: true, requiredParts: true } },
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    const requestIds = data.map(r => r.id);
    const [completedTasksByReq, openTasksByReq, downtimeByReq] = requestIds.length > 0
      ? await Promise.all([
          this.prisma.maintenanceTask.groupBy({
            by: ['requestId'], where: { requestId: { in: requestIds }, status: 'DONE' }, _count: true,
          }),
          this.prisma.maintenanceTask.groupBy({
            by: ['requestId'], where: { requestId: { in: requestIds }, status: { in: ['PENDING', 'IN_PROGRESS'] } }, _count: true,
          }),
          this.prisma.downtimeLog.groupBy({
            by: ['requestId'], where: { requestId: { in: requestIds }, cancelledAt: null }, _sum: { durationMinutes: true },
          }),
        ])
      : [[], [], []];

    const completedMap = Object.fromEntries(completedTasksByReq.map(r => [r.requestId, r._count]));
    const openMap = Object.fromEntries(openTasksByReq.map(r => [r.requestId, r._count]));
    const downtimeMap = Object.fromEntries(downtimeByReq.map(r => [r.requestId, r._sum.durationMinutes || 0]));

    const dataWithSummary = data.map((req) => ({
      ...req,
      summary: {
        tasksCount: req._count.tasks,
        requiredPartsCount: req._count.requiredParts,
        completedTasksCount: completedMap[req.id] || 0,
        openTasksCount: openMap[req.id] || 0,
        totalDowntimeHours: (downtimeMap[req.id] || 0) / 60,
      },
    }));

    return { data: dataWithSummary, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        machine: true,
        productionLine: true,
        machineComponent: true,
        operationType: true,
        costCenter: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        tasks: true,
        downtimeLogs: true,
        schedules: true,
        requiredParts: {
          include: {
            sparePart: true,
            machineComponent: { select: { id: true, code: true, name: true } },
            machine: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!request || request.deletedAt) throw new NotFoundException('Maintenance request not found');
    return request;
  }

  async update(id: string, dto: UpdateMaintenanceRequestDto, userId: string) {
    const req = await this.findOne(id);
    if (req.status === 'COMPLETED' || req.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update completed or cancelled requests');
    }

    if (dto.machineId) {
      await this.validateOperationalContext(dto as any, id);
    } else {
      if (dto.productionLineId || dto.machineComponentId || dto.operationTypeId || dto.costCenterId) {
        const currentMachineId = dto.machineId || req.machineId;
        await this.validateOperationalContext({ machineId: currentMachineId, ...dto } as any, id);
      }
    }

    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const { requiredParts, ...rest } = dto as any;
    const data: any = { ...rest };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    if (data.endDate) {
      const downtimeAgg = await this.prisma.downtimeLog.aggregate({
        where: { requestId: id, cancelledAt: null },
        _sum: { durationMinutes: true },
      });
      if (downtimeAgg._sum.durationMinutes) {
        data.downtimeHours = downtimeAgg._sum.durationMinutes / 60;
      }
    }

    if (requiredParts) {
      await this.prisma.maintenanceRequestRequiredPart.deleteMany({
        where: { maintenanceRequestId: id },
      });
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...data,
        requiredParts: requiredParts && requiredParts.length > 0 ? {
          create: requiredParts.map((p: any) => ({
            sparePartId: p.sparePartId,
            machineComponentId: p.machineComponentId,
            machineId: p.machineId,
            quantity: p.quantity,
            unit: p.unit,
            usageNote: p.usageNote,
            isPrimary: p.isPrimary,
          })),
        } : requiredParts !== undefined ? { deleteMany: {} } : undefined,
      },
    });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequest', id,
      { oldStatus: req.status });
    return updated;
  }

  // -- Required Parts sub-resource --

  async getRequiredParts(requestId: string) {
    const req = await this.findOne(requestId);
    return this.prisma.maintenanceRequestRequiredPart.findMany({
      where: { maintenanceRequestId: requestId },
      include: {
        sparePart: true,
        machineComponent: { select: { id: true, code: true, name: true } },
        machine: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async addRequiredPart(requestId: string, dto: { sparePartId: string; machineComponentId?: string; machineId?: string; quantity: number; unit?: string; usageNote?: string; isPrimary?: boolean }, userId: string) {
    const req = await this.findOne(requestId);
    if (req.status === 'COMPLETED' || req.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add parts to completed or cancelled requests');
    }

    const sparePart = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
    if (!sparePart) throw new NotFoundException('Spare part not found');
    if (sparePart.status !== 'ACTIVE') throw new BadRequestException('Inactive spare part cannot be requested');

    const existing = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { maintenanceRequestId_sparePartId: { maintenanceRequestId: requestId, sparePartId: dto.sparePartId } },
    });
    if (existing) throw new BadRequestException('This spare part is already added to the request');

    if (dto.machineComponentId) {
      const comp = await this.prisma.machineComponent.findUnique({ where: { id: dto.machineComponentId } });
      if (!comp) throw new NotFoundException('Machine component not found');
      if (comp.machineId !== req.machineId) throw new BadRequestException('Component does not belong to selected machine');
    }
    if (dto.machineId && dto.machineId !== req.machineId) {
      throw new BadRequestException('Machine does not match request machine');
    }

    const part = await this.prisma.maintenanceRequestRequiredPart.create({
      data: {
        maintenanceRequestId: requestId,
        sparePartId: dto.sparePartId,
        machineComponentId: dto.machineComponentId,
        machineId: dto.machineId || req.machineId,
        quantity: dto.quantity,
        unit: dto.unit,
        usageNote: dto.usageNote,
        isPrimary: dto.isPrimary,
      },
    });
    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestRequiredPart', part.id,
      { requestId, sparePartId: dto.sparePartId });
    return part;
  }

  async updateRequiredPart(id: string, dto: { quantity?: number; unit?: string; usageNote?: string; isPrimary?: boolean }, userId: string) {
    const part = await this.prisma.maintenanceRequestRequiredPart.findUnique({ where: { id }, include: { maintenanceRequest: true } });
    if (!part) throw new NotFoundException('Required part not found');
    if (part.maintenanceRequest.status === 'COMPLETED' || part.maintenanceRequest.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update parts on completed or cancelled requests');
    }
    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id },
      data: dto,
    });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestRequiredPart', id, dto);
    return updated;
  }

  async cancelRequiredPart(id: string, userId: string) {
    const part = await this.prisma.maintenanceRequestRequiredPart.findUnique({ where: { id }, include: { maintenanceRequest: true } });
    if (!part) throw new NotFoundException('Required part not found');
    if (part.status === 'CANCELLED') throw new BadRequestException('Part is already cancelled');
    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log(userId, 'CANCEL', 'MaintenanceRequestRequiredPart', id, { oldStatus: part.status });
    return updated;
  }

  // -- Existing methods unchanged below --

  async start(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'OPEN') throw new BadRequestException('Only OPEN requests can be started');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.machine.update({
        where: { id: req.machineId },
        data: { status: 'UNDER_MAINTENANCE' },
      });
      return tx.maintenanceRequest.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startDate: new Date() },
      });
    });

    await this.audit.log(userId, 'START', 'MaintenanceRequest', id,
      { oldStatus: req.status, newStatus: 'IN_PROGRESS', machineId: req.machineId });
    return updated;
  }

  async complete(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'IN_PROGRESS') throw new BadRequestException('Only IN_PROGRESS requests can be completed');

    const downtimeAgg = await this.prisma.downtimeLog.aggregate({
      where: { requestId: id, cancelledAt: null },
      _sum: { durationMinutes: true },
    });
    const downtimeHours = downtimeAgg._sum.durationMinutes
      ? downtimeAgg._sum.durationMinutes / 60
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const activeRequests = await tx.maintenanceRequest.count({
        where: { machineId: req.machineId, status: 'IN_PROGRESS', id: { not: id }, deletedAt: null },
      });
      if (activeRequests === 0) {
        await tx.machine.update({
          where: { id: req.machineId },
          data: { status: 'ACTIVE' },
        });
      }
      return tx.maintenanceRequest.update({
        where: { id },
        data: { status: 'COMPLETED', endDate: new Date(), downtimeHours },
      });
    });

    await this.audit.log(userId, 'COMPLETE', 'MaintenanceRequest', id,
      { oldStatus: req.status, newStatus: 'COMPLETED', machineId: req.machineId, downtimeHours });
    return updated;
  }

  async cancel(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'OPEN' && req.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only OPEN or IN_PROGRESS requests can be cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (req.status === 'IN_PROGRESS') {
        const activeRequests = await tx.maintenanceRequest.count({
          where: { machineId: req.machineId, status: 'IN_PROGRESS', id: { not: id }, deletedAt: null },
        });
        if (activeRequests === 0) {
          await tx.machine.update({
            where: { id: req.machineId },
            data: { status: 'ACTIVE' },
          });
        }
      }
      return tx.maintenanceRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    await this.audit.log(userId, 'CANCEL', 'MaintenanceRequest', id,
      { oldStatus: req.status, newStatus: 'CANCELLED', machineId: req.machineId });
    return updated;
  }

  async assign(id: string, assignedToId: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status === 'COMPLETED' || req.status === 'CANCELLED') {
      throw new BadRequestException('Cannot assign completed or cancelled requests');
    }

    const user = await this.prisma.user.findUnique({ where: { id: assignedToId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { assignedToId },
    });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequest', id,
      { action: 'assign', assignedToId, oldAssignedToId: req.assignedToId });
    return updated;
  }

  async remove(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status === 'IN_PROGRESS') {
      throw new BadRequestException('Cannot delete an in-progress request');
    }
    await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(userId, 'DELETE', 'MaintenanceRequest', id,
      { status: req.status });
    return { message: 'Maintenance request deleted successfully' };
  }

  async reopen(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'COMPLETED' && req.status !== 'CANCELLED') {
      throw new BadRequestException('Only completed or cancelled requests can be reopened');
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'OPEN', endDate: null, downtimeHours: null },
    });
    await this.audit.log(userId, 'REOPEN', 'MaintenanceRequest', id,
      { oldStatus: req.status, newStatus: 'OPEN' });
    return updated;
  }

  async getWorkflow(id: string) {
    const req = await this.findOne(id);
    const transitions: { from: string; to: string; action: string; permission: string }[] = [];
    switch (req.status) {
      case 'OPEN':
        transitions.push({ from: 'OPEN', to: 'IN_PROGRESS', action: 'start', permission: 'maintenance-request:start' });
        transitions.push({ from: 'OPEN', to: 'CANCELLED', action: 'cancel', permission: 'maintenance-request:cancel' });
        break;
      case 'IN_PROGRESS':
        transitions.push({ from: 'IN_PROGRESS', to: 'COMPLETED', action: 'complete', permission: 'maintenance-request:complete' });
        transitions.push({ from: 'IN_PROGRESS', to: 'CANCELLED', action: 'cancel', permission: 'maintenance-request:cancel' });
        break;
      case 'COMPLETED':
      case 'CANCELLED':
        transitions.push({ from: req.status, to: 'OPEN', action: 'reopen', permission: 'maintenance-request:reopen' });
        break;
    }
    return { currentStatus: req.status, transitions };
  }

  async getActivity(id: string, query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entity: 'MaintenanceRequest', entityId: id },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { entity: 'MaintenanceRequest', entityId: id } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAttachments(id: string) {
    await this.findOne(id);
    return this.prisma.attachment.findMany({
      where: { entityName: 'MAINTENANCE_REQUEST', entityId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPrintData(id: string) {
    const req = await this.findOne(id);
    const [parts, costs, tasks, downtimes] = await Promise.all([
      this.prisma.maintenanceRequestPartUsage.findMany({
        where: { requestId: id },
        include: { product: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.maintenanceRequestCostEntry.findMany({ where: { requestId: id } }),
      this.prisma.maintenanceTask.findMany({
        where: { requestId: id },
        include: { assignedTo: { select: { id: true, name: true } } },
      }),
      this.prisma.downtimeLog.findMany({
        where: { requestId: id },
        include: { machine: { select: { id: true, name: true, code: true } } },
      }),
    ]);
    return { ...req, parts, costs, tasks, downtimes };
  }

  async getChecklists(id: string) {
    await this.findOne(id);
    return this.prisma.maintenanceChecklistExecution.findMany({
      where: { requestId: id },
      include: {
        schedule: { select: { id: true, title: true } },
        completedBy: { select: { id: true, name: true } },
        items: {
          include: { checklistItem: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createChecklist(id: string, scheduleId: string, userId: string) {
    await this.findOne(id);
    const schedule = await this.prisma.maintenanceSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new NotFoundException('Schedule not found');

    const checklistItems = await this.prisma.maintenanceChecklistItem.findMany({
      where: { scheduleId },
      orderBy: { sortOrder: 'asc' },
    });

    const execution = await this.prisma.maintenanceChecklistExecution.create({
      data: {
        scheduleId,
        requestId: id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        completedById: userId,
        items: {
          create: checklistItems.map(item => ({
            checklistItemId: item.id,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.log(userId, 'CREATE', 'MaintenanceChecklistExecution', execution.id,
      { requestId: id, scheduleId });
    return execution;
  }

  async getRequestSummary(id: string) {
    const req = await this.findOne(id);
    const [partsCount, costsCount, tasksCount, downtimeCount, totalCost] = await Promise.all([
      this.prisma.maintenanceRequestPartUsage.count({ where: { requestId: id } }),
      this.prisma.maintenanceRequestCostEntry.count({ where: { requestId: id } }),
      this.prisma.maintenanceTask.count({ where: { requestId: id } }),
      this.prisma.downtimeLog.count({ where: { requestId: id } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: { requestId: id }, _sum: { amount: true } }),
    ]);
    return {
      ...req,
      summary: { partsCount, costsCount, tasksCount, downtimeCount, totalCost: totalCost._sum.amount || 0 },
    };
  }
}
