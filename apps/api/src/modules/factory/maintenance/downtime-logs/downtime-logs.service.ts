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
    failureCategory?: string; rcaStatus?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { reason: { contains: query.search } },
        { failureCause: { contains: query.search } },
        { rootCause: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }
    if (query.machineId) where.machineId = query.machineId;
    if (query.requestId) where.requestId = query.requestId;
    if (query.failureCategory) where.failureCategory = query.failureCategory;
    if (query.rcaStatus) where.rcaStatus = query.rcaStatus;
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.downtimeLog.findMany({
        where, skip, take: limit, orderBy: { startTime: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true, productionLineId: true } },
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
        machine: { select: { id: true, code: true, name: true, productionLineId: true } },
        request: { select: { id: true, requestNumber: true, title: true } },
        rcaCompletedBy: { select: { id: true, name: true } },
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
      data: { machineId, reason, startTime: new Date(), detectedAt: new Date() },
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

    const [totalLogs, totalDuration, byMachine, byReason, byCause, recentLogs] = await Promise.all([
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
      this.prisma.downtimeLog.groupBy({
        by: ['failureCause'],
        where: { ...where, failureCause: { not: null } },
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

    const machines = await this.prisma.machine.findMany({
      where: { id: { in: byMachine.map(m => m.machineId) } },
      select: { id: true, name: true },
    });
    const machineMap = new Map(machines.map(m => [m.id, m.name]));

    return {
      summary: {
        totalLogs,
        totalDurationHours: (totalDuration._sum.durationMinutes || 0) / 60,
      },
      totalLogs,
      totalDurationMinutes: totalDuration._sum.durationMinutes || 0,
      totalDurationHours: (totalDuration._sum.durationMinutes || 0) / 60,
      byMachine: byMachine.map(m => ({
        machineId: m.machineId,
        machineName: machineMap.get(m.machineId) || null,
        count: m._count,
        totalDurationHours: (m._sum.durationMinutes || 0) / 60,
      })),
      byReason: byReason.map(r => ({
        reason: r.reason,
        count: r._count,
        totalDurationHours: (r._sum.durationMinutes || 0) / 60,
      })),
      byCause: byCause.map(r => ({
        cause: r.failureCause,
        count: r._count,
        totalDurationHours: (r._sum.durationMinutes || 0) / 60,
      })),
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
      data: { endTime: now, durationMinutes, repairCompletedAt: now },
    });
    await this.audit.log(userId, 'END', 'DowntimeLog', id,
      { machineId: existing.machineId, durationMinutes });
    return { ...log, status: 'CLOSED', durationHours: durationMinutes / 60 };
  }

  async classify(id: string, reason: string, category: string | undefined, userId: string) {
    const existing = await this.findOne(id);
    const data: any = {};
    if (reason) data.reason = reason;
    if (category) data.failureCategory = category;

    const log = await this.prisma.downtimeLog.update({
      where: { id },
      data,
    });
    await this.audit.log(userId, 'CLASSIFY', 'DowntimeLog', id,
      { machineId: existing.machineId, reason, category });
    return log;
  }

  // ── RCA Methods ──

  async setFailureCause(id: string, failureCause: string, failureCategory: string | undefined, userId: string) {
    const existing = await this.findOne(id);
    if (existing.cancelledAt) throw new BadRequestException('Cannot update a cancelled downtime log');

    const data: any = { failureCause };
    if (failureCategory) data.failureCategory = failureCategory;

    const log = await this.prisma.downtimeLog.update({ where: { id }, data });
    await this.audit.log(userId, 'SET_FAILURE_CAUSE', 'DowntimeLog', id,
      { failureCause, failureCategory });
    return log;
  }

  async setRca(id: string, dto: { rootCause?: string; correctiveAction?: string; preventiveAction?: string }, userId: string) {
    const existing = await this.findOne(id);
    if (existing.cancelledAt) throw new BadRequestException('Cannot update a cancelled downtime log');
    if (existing.rcaStatus === 'COMPLETED') throw new BadRequestException('RCA is already completed');

    const data: any = {};
    if (dto.rootCause !== undefined) data.rootCause = dto.rootCause;
    if (dto.correctiveAction !== undefined) data.correctiveAction = dto.correctiveAction;
    if (dto.preventiveAction !== undefined) data.preventiveAction = dto.preventiveAction;
    if (existing.rcaStatus === 'PENDING') data.rcaStatus = 'IN_PROGRESS';

    const log = await this.prisma.downtimeLog.update({ where: { id }, data });
    await this.audit.log(userId, 'SET_RCA', 'DowntimeLog', id,
      { rootCause: dto.rootCause, correctiveAction: dto.correctiveAction, preventiveAction: dto.preventiveAction });
    return log;
  }

  async completeRca(id: string, userId: string) {
    const existing = await this.findOne(id);
    if (existing.cancelledAt) throw new BadRequestException('Cannot complete RCA for a cancelled downtime log');
    if (existing.rcaStatus === 'COMPLETED') throw new BadRequestException('RCA is already completed');

    const log = await this.prisma.downtimeLog.update({
      where: { id },
      data: {
        rcaStatus: 'COMPLETED',
        rcaCompletedByUserId: userId,
        rcaCompletedAt: new Date(),
      },
    });
    await this.audit.log(userId, 'COMPLETE_RCA', 'DowntimeLog', id,
      { userId });
    return log;
  }

  async getRca(id: string) {
    const existing = await this.findOne(id);
    return {
      id: existing.id,
      failureCause: existing.failureCause,
      failureCategory: existing.failureCategory,
      rootCause: existing.rootCause,
      correctiveAction: existing.correctiveAction,
      preventiveAction: existing.preventiveAction,
      rcaStatus: existing.rcaStatus,
      rcaCompletedBy: existing.rcaCompletedBy,
      rcaCompletedAt: existing.rcaCompletedAt,
      isRepeatFailure: existing.isRepeatFailure,
      repeatedFailureGroupId: existing.repeatedFailureGroupId,
    };
  }

  // ── Reliability KPI Methods ──

  async getMttr(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { endTime: { not: null }, cancelledAt: null, durationMinutes: { not: null } };
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) {
      const machines = await this.prisma.machine.findMany({
        where: { productionLineId: query.productionLineId },
        select: { id: true },
      });
      where.machineId = { in: machines.map(m => m.id) };
    }
    if (query.dateFrom || query.dateTo) {
      where.endTime = {};
      if (query.dateFrom) where.endTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.endTime.lte = new Date(query.dateTo);
    }

    const result = await this.prisma.downtimeLog.aggregate({
      where,
      _avg: { durationMinutes: true },
      _count: true,
    });
    return {
      mttrMinutes: result._avg.durationMinutes || 0,
      mttrHours: (result._avg.durationMinutes || 0) / 60,
      totalEvents: result._count,
    };
  }

  async getMtbf(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { cancelledAt: null };
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) {
      const machines = await this.prisma.machine.findMany({
        where: { productionLineId: query.productionLineId },
        select: { id: true },
      });
      where.machineId = { in: machines.map(m => m.id) };
    }
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const [totalEvents, firstEvent, lastEvent] = await Promise.all([
      this.prisma.downtimeLog.count({ where }),
      this.prisma.downtimeLog.findFirst({ where, orderBy: { startTime: 'asc' }, select: { startTime: true } }),
      this.prisma.downtimeLog.findFirst({ where, orderBy: { startTime: 'desc' }, select: { startTime: true } }),
    ]);

    if (totalEvents < 2 || !firstEvent || !lastEvent) {
      return { mtbfMinutes: 0, mtbfHours: 0, totalEvents };
    }

    const totalHours = (lastEvent.startTime.getTime() - firstEvent.startTime.getTime()) / 3600000;
    const mtbfHours = totalHours / (totalEvents - 1);
    return {
      mtbfMinutes: mtbfHours * 60,
      mtbfHours,
      totalEvents,
    };
  }

  async getTotalDowntime(query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { cancelledAt: null };
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) {
      const machines = await this.prisma.machine.findMany({
        where: { productionLineId: query.productionLineId },
        select: { id: true },
      });
      where.machineId = { in: machines.map(m => m.id) };
    }
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const result = await this.prisma.downtimeLog.aggregate({
      where,
      _sum: { durationMinutes: true },
      _count: true,
    });
    return {
      totalMinutes: result._sum.durationMinutes || 0,
      totalHours: (result._sum.durationMinutes || 0) / 60,
      totalEvents: result._count,
    };
  }

  async getDowntimeByMachine(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    const where: any = { cancelledAt: null };
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const grouped = await this.prisma.downtimeLog.groupBy({
      by: ['machineId'],
      where,
      _sum: { durationMinutes: true },
      _count: true,
      orderBy: { _sum: { durationMinutes: 'desc' } },
      take: query.limit || 10,
    });

    const machines = await this.prisma.machine.findMany({
      where: { id: { in: grouped.map(g => g.machineId) } },
      select: { id: true, code: true, name: true, productionLineId: true },
    });

    const machineMap = new Map(machines.map(m => [m.id, m]));
    return grouped.map(g => ({
      machine: machineMap.get(g.machineId) || null,
      totalMinutes: g._sum.durationMinutes || 0,
      totalHours: (g._sum.durationMinutes || 0) / 60,
      eventCount: g._count,
    }));
  }

  async getDowntimeByProductionLine(query: { dateFrom?: string; dateTo?: string }) {
    const where: any = { cancelledAt: null };
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const allLogs = await this.prisma.downtimeLog.findMany({
      where,
      select: {
        id: true,
        machineId: true,
        durationMinutes: true,
        machine: { select: { productionLineId: true } },
      },
    });

    const lineMap = new Map<string, { totalMinutes: number; count: number }>();
    for (const log of allLogs) {
      const lineId = log.machine?.productionLineId || 'UNKNOWN';
      const entry = lineMap.get(lineId) || { totalMinutes: 0, count: 0 };
      entry.totalMinutes += log.durationMinutes || 0;
      entry.count += 1;
      lineMap.set(lineId, entry);
    }

    const productionLines = await this.prisma.productionLine.findMany({
      where: { id: { in: Array.from(lineMap.keys()).filter(k => k !== 'UNKNOWN') } },
      select: { id: true, code: true, name: true },
    });
    const lineMap2 = new Map(productionLines.map(l => [l.id, l]));

    return Array.from(lineMap.entries())
      .map(([lineId, data]) => ({
        productionLine: lineId === 'UNKNOWN' ? null : (lineMap2.get(lineId) || null),
        totalMinutes: data.totalMinutes,
        totalHours: data.totalMinutes / 60,
        eventCount: data.count,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  async getDowntimeByCause(query: { dateFrom?: string; dateTo?: string }) {
    const where: any = { cancelledAt: null, failureCause: { not: null } };
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const grouped = await this.prisma.downtimeLog.groupBy({
      by: ['failureCause'],
      where,
      _sum: { durationMinutes: true },
      _count: true,
      orderBy: { _sum: { durationMinutes: 'desc' } },
      take: 10,
    });

    return grouped.map(g => ({
      failureCause: g.failureCause,
      totalMinutes: g._sum.durationMinutes || 0,
      totalHours: (g._sum.durationMinutes || 0) / 60,
      eventCount: g._count,
    }));
  }

  async getRepeatFailures(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    const where: any = { isRepeatFailure: true, cancelledAt: null };
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const logs = await this.prisma.downtimeLog.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: query.limit || 20,
      include: {
        machine: { select: { id: true, code: true, name: true } },
      },
    });

    return logs.map((log: any) => ({
      ...log,
      status: log.cancelledAt ? 'CANCELLED' : log.endTime ? 'CLOSED' : 'ACTIVE',
      durationHours: log.durationMinutes ? log.durationMinutes / 60 : null,
    }));
  }

  async getEmergencyResponseTime(query: { dateFrom?: string; dateTo?: string }) {
    const where: any = { detectedAt: { not: null }, responseStartedAt: { not: null }, cancelledAt: null };
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const logs = await this.prisma.downtimeLog.findMany({
      where,
      select: { detectedAt: true, responseStartedAt: true, startTime: true },
    });

    if (logs.length === 0) {
      return { avgResponseTimeMinutes: 0, avgResponseTimeHours: 0, totalEvents: 0 };
    }

    let totalResponseMinutes = 0;
    let count = 0;
    for (const log of logs) {
      const responseTime = log.responseStartedAt!.getTime() - log.detectedAt!.getTime();
      if (responseTime > 0) {
        totalResponseMinutes += responseTime / 60000;
        count++;
      }
    }

    return {
      avgResponseTimeMinutes: count > 0 ? totalResponseMinutes / count : 0,
      avgResponseTimeHours: count > 0 ? totalResponseMinutes / count / 60 : 0,
      totalEvents: count,
    };
  }

  async getTopMachines(query: { dateFrom?: string; dateTo?: string; limit?: number }) {
    return this.getDowntimeByMachine({ ...query, limit: query.limit || 5 });
  }

  async getTopCauses(query: { dateFrom?: string; dateTo?: string }) {
    return this.getDowntimeByCause(query);
  }
}
