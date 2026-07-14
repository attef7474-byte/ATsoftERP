import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { UpdateMaintenanceTaskDto } from './dto/update-maintenance-task.dto';

@Injectable()
export class MaintenanceTasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateMaintenanceTaskDto, userId: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('Maintenance request not found');

    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const task = await this.prisma.maintenanceTask.create({ data: dto as any });
    await this.audit.log(userId, 'CREATE', 'MaintenanceTask', task.id);
    return task;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    requestId?: string; assignedToId?: string; status?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
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

  async findOne(id: string) {
    const task = await this.prisma.maintenanceTask.findUnique({
      where: { id },
      include: {
        request: { select: { id: true, requestNumber: true, title: true, status: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    if (!task) throw new NotFoundException('Maintenance task not found');
    return task;
  }

  async update(id: string, dto: UpdateMaintenanceTaskDto, userId: string) {
    await this.findOne(id);

    if (dto.requestId) {
      const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
      if (!request) throw new NotFoundException('Maintenance request not found');
    }
    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user) throw new NotFoundException('Assigned user not found');
    }

    const updated = await this.prisma.maintenanceTask.update({ where: { id }, data: dto as any });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceTask', id, { dto });
    return updated;
  }

  async start(id: string, userId: string) {
    const task = await this.findOne(id);
    if (task.status !== 'PENDING') throw new BadRequestException('Only PENDING tasks can be started');
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
    await this.audit.log(userId, 'START', 'MaintenanceTask', id);
    return updated;
  }

  async complete(id: string, userId: string) {
    const task = await this.findOne(id);
    if (task.status !== 'IN_PROGRESS') throw new BadRequestException('Only IN_PROGRESS tasks can be completed');
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { status: 'DONE' },
    });
    await this.audit.log(userId, 'COMPLETE', 'MaintenanceTask', id);
    return updated;
  }

  async cancel(id: string, userId: string) {
    const task = await this.findOne(id);
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only PENDING or IN_PROGRESS tasks can be cancelled');
    }
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log(userId, 'CANCEL', 'MaintenanceTask', id);
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.maintenanceTask.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceTask', id);
    return { message: 'Maintenance task deleted successfully' };
  }
}
