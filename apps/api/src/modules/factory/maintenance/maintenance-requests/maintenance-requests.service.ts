import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
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

  async create(dto: CreateMaintenanceRequestDto, userId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('Machine not found');

    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const seq = await this.prisma.numberSequence.findUnique({ where: { code: 'MAINTENANCE_REQUEST' } });
    if (!seq) throw new NotFoundException('Number sequence MAINTENANCE_REQUEST not configured');

    const { machineId, assignedToId, ...rest } = dto;

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

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    const dataWithSummary = await Promise.all(
      data.map(async (req) => {
        const completedTasks = await this.prisma.maintenanceTask.count({
          where: { requestId: req.id, status: 'DONE' },
        });
        const openTasks = await this.prisma.maintenanceTask.count({
          where: { requestId: req.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        });
        const downtimeAgg = await this.prisma.downtimeLog.aggregate({
          where: { requestId: req.id, cancelledAt: null },
          _sum: { durationMinutes: true },
        });
        const totalDowntimeHours = downtimeAgg._sum.durationMinutes
          ? downtimeAgg._sum.durationMinutes / 60
          : 0;
        return {
          ...req,
          summary: {
            tasksCount: req._count.tasks,
            completedTasksCount: completedTasks,
            openTasksCount: openTasks,
            totalDowntimeHours,
          },
        };
      }),
    );

    return { data: dataWithSummary, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        machine: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        tasks: true,
        downtimeLogs: true,
        schedules: true,
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
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw new NotFoundException('Machine not found');
    }
    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const data: any = { ...dto };
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

    const updated = await this.prisma.maintenanceRequest.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequest', id,
      { oldStatus: req.status, dto });
    return updated;
  }

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
}
