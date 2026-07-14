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

    await this.audit.log(userId, 'CREATE', 'MaintenanceRequest', request.id, { requestNumber: request.requestNumber });
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
          machine: { select: { id: true, code: true, name: true } },
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
        const downtimeAgg = await this.prisma.downtimeLog.aggregate({
          where: { requestId: req.id },
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
    await this.findOne(id);

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
        where: { requestId: id },
        _sum: { durationMinutes: true },
      });
      if (downtimeAgg._sum.durationMinutes) {
        data.downtimeHours = downtimeAgg._sum.durationMinutes / 60;
      }
    }

    const updated = await this.prisma.maintenanceRequest.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequest', id, { dto });
    return updated;
  }

  async start(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'OPEN') throw new BadRequestException('Only OPEN requests can be started');
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startDate: new Date() },
    });
    await this.audit.log(userId, 'START', 'MaintenanceRequest', id);
    return updated;
  }

  async complete(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'IN_PROGRESS') throw new BadRequestException('Only IN_PROGRESS requests can be completed');

    const downtimeAgg = await this.prisma.downtimeLog.aggregate({
      where: { requestId: id },
      _sum: { durationMinutes: true },
    });
    const downtimeHours = downtimeAgg._sum.durationMinutes
      ? downtimeAgg._sum.durationMinutes / 60
      : null;

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'COMPLETED', endDate: new Date(), downtimeHours },
    });
    await this.audit.log(userId, 'COMPLETE', 'MaintenanceRequest', id);
    return updated;
  }

  async cancel(id: string, userId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'OPEN' && req.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only OPEN or IN_PROGRESS requests can be cancelled');
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log(userId, 'CANCEL', 'MaintenanceRequest', id);
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(userId, 'DELETE', 'MaintenanceRequest', id);
    return { message: 'Maintenance request deleted successfully' };
  }
}
