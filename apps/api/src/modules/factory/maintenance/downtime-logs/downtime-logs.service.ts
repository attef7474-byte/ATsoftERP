import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateDowntimeLogDto } from './dto/create-downtime-log.dto';
import { UpdateDowntimeLogDto } from './dto/update-downtime-log.dto';

@Injectable()
export class DowntimeLogsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateDowntimeLogDto, userId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('Machine not found');
    if (dto.requestId) {
      const request = await this.prisma.maintenanceRequest.findUnique({ where: { id: dto.requestId } });
      if (!request) throw new NotFoundException('Maintenance request not found');
    }
    const data: any = { ...dto };
    data.startTime = dto.startTime ? new Date(dto.startTime) : new Date();
    if (dto.endTime) data.endTime = new Date(dto.endTime);
    if (data.endTime && data.endTime <= data.startTime) {
      throw new BadRequestException('End time must be after start time');
    }
    if (data.endTime && !data.durationMinutes) {
      data.durationMinutes = (data.endTime.getTime() - data.startTime.getTime()) / 60000;
    }
    const log = await this.prisma.downtimeLog.create({ data });
    await this.audit.log(userId, 'create', 'DowntimeLog', log.id, { dto });
    return log;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; requestId?: string;
    dateFrom?: string; dateTo?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { reason: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.machineId) where.machineId = query.machineId;
    if (query.requestId) where.requestId = query.requestId;
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.downtimeLog.findMany({
        where, skip, take: limit, orderBy: { startTime: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.downtimeLog.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const log = await this.prisma.downtimeLog.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
      },
    });
    if (!log) throw new NotFoundException('Downtime log not found');
    return log;
  }

  async update(id: string, dto: UpdateDowntimeLogDto, userId: string) {
    const existing = await this.findOne(id);
    const data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) {
      data.endTime = new Date(dto.endTime);
      const start = data.startTime || existing.startTime;
      if (data.endTime <= start) {
        throw new BadRequestException('End time must be after start time');
      }
      data.durationMinutes = (data.endTime.getTime() - start.getTime()) / 60000;
    }
    const log = await this.prisma.downtimeLog.update({ where: { id }, data });
    await this.audit.log(userId, 'update', 'DowntimeLog', id, { dto });
    return log;
  }

  async close(id: string, userId: string) {
    const existing = await this.findOne(id);
    if (existing.endTime) return existing;
    const now = new Date();
    const durationMinutes = (now.getTime() - existing.startTime.getTime()) / 60000;
    const log = await this.prisma.downtimeLog.update({
      where: { id },
      data: { endTime: now, durationMinutes },
    });
    await this.audit.log(userId, 'close', 'DowntimeLog', id, { endTime: now.toISOString(), durationMinutes });
    return log;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.downtimeLog.delete({ where: { id } });
    await this.audit.log(userId, 'delete', 'DowntimeLog', id, {});
    return { message: 'Downtime log deleted successfully' };
  }
}
