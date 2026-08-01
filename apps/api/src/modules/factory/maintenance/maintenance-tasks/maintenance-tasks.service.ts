import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { UpdateMaintenanceTaskDto } from './dto/update-maintenance-task.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceTasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message });
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

  async create(dto: CreateMaintenanceTaskDto, userId: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: dto.requestId },
      include: { machine: true },
    });
    if (!request || !this.machineOwns(request.machine, ctx)) {
      throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    }
    if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
      throw this.badRequest('maintenance.cannotAddTaskTerminalRequest', 'Cannot add tasks to completed or cancelled requests');
    }

    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw this.notFound('maintenance.assignedUserNotFound', 'Assigned user not found');
    }

    const task = await this.prisma.maintenanceTask.create({ data: dto as any });
    await this.audit.log(userId, 'CREATE', 'MaintenanceTask', task.id,
      { requestId: dto.requestId });
    return task;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    requestId?: string; assignedToId?: string; status?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { request: { machine: this.machineScope(ctx) } };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.requestId) where.requestId = query.requestId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          request: { select: { id: true, requestNumber: true, title: true, status: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const task = await this.prisma.maintenanceTask.findUnique({
      where: { id },
      include: {
        request: { select: { id: true, requestNumber: true, title: true, status: true, machine: { select: { id: true, companyId: true, branchId: true } } } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    if (!task || !this.machineOwns(task.request.machine, ctx)) {
      throw this.notFound('maintenance.taskNotFound', 'Maintenance task not found');
    }
    return task;
  }

  async update(id: string, dto: UpdateMaintenanceTaskDto, userId: string, ctx: ActiveOperationalContext) {
    const task = await this.findOne(id, ctx);
    if (task.status === 'DONE' || task.status === 'CANCELLED') {
      throw this.badRequest('maintenance.cannotUpdateTerminalTask', 'Cannot update completed or cancelled tasks');
    }

    if (dto.requestId) {
      const request = await this.prisma.maintenanceRequest.findUnique({
        where: { id: dto.requestId },
        include: { machine: true },
      });
      if (!request || !this.machineOwns(request.machine, ctx)) {
        throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
      }
    }
    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw this.notFound('maintenance.assignedUserNotFound', 'Assigned user not found');
    }

    const updated = await this.prisma.maintenanceTask.update({ where: { id }, data: dto as any });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceTask', id,
      { oldStatus: task.status, dto });
    return updated;
  }

  async start(id: string, userId: string, ctx: ActiveOperationalContext) {
    const task = await this.findOne(id, ctx);
    if (task.status !== 'PENDING') throw this.badRequest('maintenance.onlyPendingCanStart', 'Only PENDING tasks can be started');
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    await this.audit.log(userId, 'START', 'MaintenanceTask', id,
      { oldStatus: task.status, newStatus: 'IN_PROGRESS', requestId: task.requestId });
    return updated;
  }

  async complete(id: string, userId: string, ctx: ActiveOperationalContext) {
    const task = await this.findOne(id, ctx);
    if (task.status !== 'IN_PROGRESS') throw this.badRequest('maintenance.onlyInProgressTaskCanComplete', 'Only IN_PROGRESS tasks can be completed');
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { status: 'DONE', completedAt: new Date() },
    });
    await this.audit.log(userId, 'COMPLETE', 'MaintenanceTask', id,
      { oldStatus: task.status, newStatus: 'DONE', requestId: task.requestId });
    return updated;
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const task = await this.findOne(id, ctx);
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
      throw this.badRequest('maintenance.onlyPendingInProgressCanCancelTask', 'Only PENDING or IN_PROGRESS tasks can be cancelled');
    }
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.audit.log(userId, 'CANCEL', 'MaintenanceTask', id,
      { oldStatus: task.status, newStatus: 'CANCELLED', requestId: task.requestId });
    return updated;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const task = await this.findOne(id, ctx);
    if (task.status === 'IN_PROGRESS') {
      throw this.badRequest('maintenance.cannotDeleteInProgressTask', 'Cannot delete an in-progress task');
    }
    await this.prisma.maintenanceTask.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceTask', id,
      { status: task.status });
    return { message: 'Maintenance task deleted successfully' };
  }

  async myTasks(userId: string, query: { page?: number; limit?: number; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { assignedToId: userId, request: { machine: this.machineScope(ctx) } };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          request: { select: { id: true, requestNumber: true, title: true, status: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async byRequest(requestId: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { machine: true },
    });
    if (!request || !this.machineOwns(request.machine, ctx)) {
      throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    }
    const where = { requestId };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async overdue(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const now = new Date();
    // Tasks that are overdue: PENDING or IN_PROGRESS tasks where the request's endDate has passed
    const where = {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      request: { machine: this.machineScope(ctx), endDate: { lt: now }, deletedAt: null },
    };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'asc' },
        include: {
          request: { select: { id: true, requestNumber: true, title: true, status: true, endDate: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async assignTask(id: string, assignedToId: string, userId: string, ctx: ActiveOperationalContext) {
    const task = await this.findOne(id, ctx);
    if (task.status === 'DONE' || task.status === 'CANCELLED') {
      throw this.badRequest('maintenance.cannotAssignTerminalTask', 'Cannot assign completed or cancelled tasks');
    }
    const user = await this.prisma.user.findUnique({ where: { id: assignedToId } });
    if (!user) throw this.notFound('organization.userNotFound', 'User not found');

    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { assignedToId },
    });
    await this.audit.log(userId, 'ASSIGN', 'MaintenanceTask', id,
      { assignedToId, oldAssignedToId: task.assignedToId });
    return updated;
  }
}
