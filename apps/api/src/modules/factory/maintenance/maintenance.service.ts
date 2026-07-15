import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateMachineDto, UpdateMachineDto, CreateMachinePartDto, CreateMachineDocumentDto } from './dto/maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async createMachine(dto: CreateMachineDto) {
    const existing = await this.prisma.machine.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Machine code already exists');
    const { purchaseDate, warrantyEnd, ...rest } = dto;
    return this.prisma.machine.create({
      data: {
        ...rest,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : undefined,
      },
    });
  }

  async findAllMachines(query: { page?: number; limit?: number; search?: string; categoryId?: string; companyId?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { serialNumber: { contains: query.search } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.companyId) where.companyId = query.companyId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.machine.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.machine.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneMachine(id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        parts: true,
        documents: true,
        _count: { select: { maintenanceReqs: true, schedules: true, downtimeLogs: true } },
      },
    });
    if (!machine) throw new NotFoundException('Machine not found');
    return machine;
  }

  async updateMachine(id: string, dto: UpdateMachineDto) {
    await this.findOneMachine(id);
    const { purchaseDate, warrantyEnd, ...rest } = dto as any;
    const data: any = { ...rest };
    if (purchaseDate) data.purchaseDate = new Date(purchaseDate);
    if (warrantyEnd) data.warrantyEnd = new Date(warrantyEnd);
    return this.prisma.machine.update({ where: { id }, data });
  }

  async removeMachine(id: string) {
    await this.findOneMachine(id);
    await this.prisma.machine.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Machine deleted successfully' };
  }

  async createPart(dto: CreateMachinePartDto) {
    return this.prisma.machinePart.create({ data: dto });
  }

  async findParts(machineId?: string) {
    const where: any = {};
    if (machineId) where.machineId = machineId;
    return this.prisma.machinePart.findMany({
      where,
      include: { machine: { select: { id: true, name: true, code: true } }, product: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updatePart(id: string, dto: Partial<CreateMachinePartDto>) {
    const part = await this.prisma.machinePart.findUnique({ where: { id } });
    if (!part) throw new NotFoundException('Part not found');
    return this.prisma.machinePart.update({ where: { id }, data: dto });
  }

  async removePart(id: string) {
    const part = await this.prisma.machinePart.findUnique({ where: { id } });
    if (!part) throw new NotFoundException('Part not found');
    return this.prisma.machinePart.delete({ where: { id } });
  }

  async createDocument(dto: CreateMachineDocumentDto) {
    return this.prisma.machineDocument.create({ data: dto });
  }

  async findDocuments(machineId: string) {
    return this.prisma.machineDocument.findMany({
      where: { machineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequestSummary() {
    const [total, open, inProgress, completed, cancelled, overdueCount] = await Promise.all([
      this.prisma.maintenanceRequest.count({ where: { deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { status: 'OPEN', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { status: 'IN_PROGRESS', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { status: 'COMPLETED', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({ where: { status: 'CANCELLED', deletedAt: null } }),
      this.prisma.maintenanceRequest.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, endDate: null, deletedAt: null },
      }),
    ]);
    return { total, open, inProgress, completed, cancelled, overdue: overdueCount };
  }

  async getDowntimeSummary() {
    const [total, active, closed, cancelled, agg] = await Promise.all([
      this.prisma.downtimeLog.count(),
      this.prisma.downtimeLog.count({ where: { endTime: null, cancelledAt: null } }),
      this.prisma.downtimeLog.count({ where: { endTime: { not: null } } }),
      this.prisma.downtimeLog.count({ where: { cancelledAt: { not: null } } }),
      this.prisma.downtimeLog.aggregate({
        where: { cancelledAt: null },
        _sum: { durationMinutes: true },
      }),
    ]);
    const totalDurationHours = agg._sum.durationMinutes
      ? Math.round((agg._sum.durationMinutes / 60) * 100) / 100
      : 0;
    return { total, active, closed, cancelled, totalDurationHours };
  }

  async getScheduleSummary() {
    const now = new Date();
    const [total, active, inactive, overdue, dueSoon, notDue, expired] = await Promise.all([
      this.prisma.maintenanceSchedule.count(),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'INACTIVE' } }),
      this.prisma.maintenanceSchedule.count({ where: { status: 'ACTIVE', startDate: { lte: now } } }),
      this.prisma.maintenanceSchedule.count({
        where: { status: 'ACTIVE', startDate: { gt: now, lte: new Date(now.getTime() + 7 * 86400000) } },
      }),
      this.prisma.maintenanceSchedule.count({
        where: { status: 'ACTIVE', startDate: { gt: new Date(now.getTime() + 7 * 86400000) } },
      }),
      this.prisma.maintenanceSchedule.count({
        where: { status: 'ACTIVE', endDate: { not: null, lte: now } },
      }),
    ]);
    return { total, active, inactive, overdue, dueSoon, notDue, expired };
  }

  async removeDocument(id: string) {
    const doc = await this.prisma.machineDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.machineDocument.delete({ where: { id } });
  }

  async getMachineSummary(id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, code: true } },
      },
    });
    if (!machine) throw new NotFoundException('Machine not found');

    const activeRequests = await this.prisma.maintenanceRequest.count({
      where: { machineId: id, status: 'IN_PROGRESS', deletedAt: null },
    });
    const openTasks = await this.prisma.maintenanceTask.count({
      where: { request: { machineId: id }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    const activeDowntime = await this.prisma.downtimeLog.count({
      where: { machineId: id, endTime: null, cancelledAt: null },
    });
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const downtimeAgg = await this.prisma.downtimeLog.aggregate({
      where: { machineId: id, cancelledAt: null, startTime: { gte: currentMonth } },
      _sum: { durationMinutes: true },
    });
    const totalDowntimeHours = downtimeAgg._sum.durationMinutes
      ? Math.round((downtimeAgg._sum.durationMinutes / 60) * 100) / 100
      : 0;
    const nextSchedule = await this.prisma.maintenanceSchedule.findFirst({
      where: { machineId: id, status: 'ACTIVE', startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
    });

    return {
      id: machine.id,
      code: machine.code,
      name: machine.name,
      status: machine.status,
      category: machine.category,
      activeRequests: activeRequests,
      openTasks: openTasks,
      activeDowntime: activeDowntime,
      totalDowntimeHoursThisMonth: totalDowntimeHours,
      nextMaintenanceDueDate: nextSchedule?.startDate || null,
      nextMaintenanceTitle: nextSchedule?.title || null,
      dueStatus: nextSchedule
        ? new Date(nextSchedule.startDate) > new Date() ? 'notDue' : 'overdue'
        : null,
    };
  }

  async getOperationalSummary() {
    const machines = await this.prisma.machine.findMany({
      where: { deletedAt: null },
      include: { category: { select: { id: true, name: true, code: true } } },
    });

    const summaries = await Promise.all(machines.map((m) => this.getMachineSummary(m.id)));

    const totalActiveRequests = summaries.reduce((s, m) => s + m.activeRequests, 0);
    const totalOpenTasks = summaries.reduce((s, m) => s + m.openTasks, 0);
    const totalActiveDowntime = summaries.reduce((s, m) => s + m.activeDowntime, 0);
    const totalDowntimeHours = summaries.reduce((s, m) => s + m.totalDowntimeHoursThisMonth, 0);

    return {
      machines: summaries,
      totals: {
        totalMachines: machines.length,
        totalActiveRequests,
        totalOpenTasks,
        totalActiveDowntime,
        totalDowntimeHoursThisMonth: Math.round(totalDowntimeHours * 100) / 100,
      },
    };
  }
}
