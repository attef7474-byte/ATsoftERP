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

    const activeDowntime = await this.prisma.downtimeLog.findFirst({
      where: { machineId: dto.machineId, endTime: null, cancelledAt: null },
    });
    if (activeDowntime) {
      throw new BadRequestException('Machine already has an active downtime log. Close it before creating a new one.');
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
    await this.audit.log(userId, 'CREATE', 'DowntimeLog', log.id,
      { machineId: dto.machineId, startTime: data.startTime.toISOString() });
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

    const enriched = data.map((log: any) => ({
      ...log,
      status: log.cancelledAt ? 'CANCELLED' : log.endTime ? 'CLOSED' : 'ACTIVE',
      durationHours: log.durationMinutes ? log.durationMinutes / 60 : null,
    }));

    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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
    return {
      ...log,
      status: log.cancelledAt ? 'CANCELLED' : log.endTime ? 'CLOSED' : 'ACTIVE',
      durationHours: log.durationMinutes ? log.durationMinutes / 60 : null,
    };
  }

  async update(id: string, dto: UpdateDowntimeLogDto, userId: string) {
    const existing = await this.findOne(id);
    if (existing.endTime || existing.cancelledAt) {
      throw new BadRequestException('Cannot update a closed or cancelled downtime log');
    }

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
    await this.audit.log(userId, 'UPDATE', 'DowntimeLog', id,
      { dto });
    return log;
  }

  async close(id: string, userId: string) {
    const existing = await this.findOne(id);
    if (existing.cancelledAt) {
      throw new BadRequestException('Cannot close a cancelled downtime log');
    }
    if (existing.endTime) {
      throw new BadRequestException('Downtime log is already closed');
    }

    const now = new Date();
    const durationMinutes = (now.getTime() - new Date(existing.startTime).getTime()) / 60000;
    if (durationMinutes <= 0) {
      throw new BadRequestException('Duration must be positive');
    }

    const log = await this.prisma.downtimeLog.update({
      where: { id },
      data: { endTime: now, durationMinutes },
    });
    await this.audit.log(userId, 'CLOSE', 'DowntimeLog', id,
      { machineId: existing.machineId, durationMinutes, endTime: now.toISOString() });
    return { ...log, status: 'CLOSED', durationHours: durationMinutes / 60 };
  }

  async cancel(id: string, userId: string) {
    const existing = await this.findOne(id);
    if (existing.cancelledAt) {
      throw new BadRequestException('Downtime log is already cancelled');
    }
    if (existing.endTime) {
      throw new BadRequestException('Cannot cancel a closed downtime log');
    }

    const log = await this.prisma.downtimeLog.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });
    await this.audit.log(userId, 'CANCEL', 'DowntimeLog', id,
      { machineId: existing.machineId, reason: existing.reason });
    return { ...log, status: 'CANCELLED' };
  }

  async remove(id: string, userId: string) {
    const existing = await this.findOne(id);
    if (!existing.endTime && !existing.cancelledAt) {
      throw new BadRequestException('Close or cancel the downtime log before deleting');
    }
    await this.prisma.downtimeLog.delete({ where: { id } });
    await this.audit.log(userId, 'DELETE', 'DowntimeLog', id,
      { status: existing.cancelledAt ? 'CANCELLED' : 'CLOSED' });
    return { message: 'Downtime log deleted successfully' };
  }

  async startDowntime(machineId: string, reason: string, userId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Machine not found');

    const activeDowntime = await this.prisma.downtimeLog.findFirst({
      where: { machineId, endTime: null, cancelledAt: null },
    });
    if (activeDowntime) {
      throw new BadRequestException('Machine already has an active downtime log');
    }

    const log = await this.prisma.downtimeLog.create({
      data: { machineId, reason, startTime: new Date() },
    });
    await this.audit.log(userId, 'START', 'DowntimeLog', log.id,
      { machineId, reason });
    return { ...log, status: 'ACTIVE' };
  }

  async getCurrent(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { endTime: null, cancelledAt: null };

    const [data, total] = await Promise.all([
      this.prisma.downtimeLog.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { startTime: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.downtimeLog.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAnalysis(query: { dateFrom?: string; dateTo?: string; machineId?: string }) {
    const where: any = { cancelledAt: null };
    if (query.machineId) where.machineId = query.machineId;
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const [totalLogs, totalDuration, byMachine, byReason, recentLogs] = await Promise.all([
      this.prisma.downtimeLog.count({ where }),
      this.prisma.downtimeLog.aggregate({ where, _sum: { durationMinutes: true } }),
      this.prisma.downtimeLog.groupBy({
        by: ['machineId'],
        where,
        _sum: { durationMinutes: true },
        _count: true,
        orderBy: { _sum: { durationMinutes: 'desc' } },
        take: 10,
      }),
      this.prisma.downtimeLog.groupBy({
        by: ['reason'],
        where,
        _sum: { durationMinutes: true },
        _count: true,
        orderBy: { _sum: { durationMinutes: 'desc' } },
        take: 10,
      }),
      this.prisma.downtimeLog.findMany({
        where, orderBy: { startTime: 'desc' }, take: 20,
        include: { machine: { select: { id: true, name: true, code: true } } },
      }),
    ]);

    return {
      totalLogs,
      totalDurationMinutes: totalDuration._sum.durationMinutes || 0,
      totalDurationHours: (totalDuration._sum.durationMinutes || 0) / 60,
      byMachine: byMachine.map(m => ({ machineId: m.machineId, count: m._count, totalMinutes: m._sum.durationMinutes || 0 })),
      byReason: byReason.map(r => ({ reason: r.reason, count: r._count, totalMinutes: r._sum.durationMinutes || 0 })),
      recentLogs,
    };
  }

  async getByMachine(machineId: string, query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where = { machineId };

    const [data, total] = await Promise.all([
      this.prisma.downtimeLog.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { startTime: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          request: { select: { id: true, requestNumber: true, title: true } },
        },
      }),
      this.prisma.downtimeLog.count({ where }),
    ]);

    const enriched = data.map((log: any) => ({
      ...log,
      status: log.cancelledAt ? 'CANCELLED' : log.endTime ? 'CLOSED' : 'ACTIVE',
      durationHours: log.durationMinutes ? log.durationMinutes / 60 : null,
    }));

    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getLogSummary(id: string) {
    const log = await this.findOne(id);
    const relatedRequests = log.requestId
      ? await this.prisma.maintenanceRequest.findUnique({
          where: { id: log.requestId },
          select: { id: true, requestNumber: true, title: true, status: true },
        })
      : null;
    return { ...log, relatedRequest: relatedRequests };
  }

  async endDowntime(id: string, userId: string) {
    const existing = await this.findOne(id);
    if (existing.endTime) throw new BadRequestException('Downtime log is already ended');
    if (existing.cancelledAt) throw new BadRequestException('Cannot end a cancelled downtime log');

    const now = new Date();
    const durationMinutes = (now.getTime() - new Date(existing.startTime).getTime()) / 60000;

    const log = await this.prisma.downtimeLog.update({
      where: { id },
      data: { endTime: now, durationMinutes },
    });
    await this.audit.log(userId, 'END', 'DowntimeLog', id,
      { machineId: existing.machineId, durationMinutes });
    return { ...log, status: 'CLOSED', durationHours: durationMinutes / 60 };
  }

  async classify(id: string, reason: string, category: string | undefined, userId: string) {
    const existing = await this.findOne(id);
    const data: any = {};
    if (reason) data.reason = reason;
    if (category) data.notes = category;

    const log = await this.prisma.downtimeLog.update({
      where: { id },
      data,
    });
    await this.audit.log(userId, 'CLASSIFY', 'DowntimeLog', id,
      { machineId: existing.machineId, reason, category });
    return log;
  }
}
