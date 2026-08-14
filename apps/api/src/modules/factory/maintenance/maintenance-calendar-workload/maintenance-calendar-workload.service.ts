import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MaintenanceCalendarWorkloadService {
  constructor(private prisma: PrismaService) {}

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private isMachineInScope(
    machine: { companyId?: string | null; branchId?: string | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async findRequestOrFail(id: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      select: { id: true, notes: true, status: true, machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!request || !request.machine || !this.isMachineInScope(request.machine, ctx)) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async getCalendarEvents(params: {
    startDate?: string;
    endDate?: string;
    personnelId?: string;
    machineId?: string;
    productionLineId?: string;
    type?: string;
    status?: string;
    priority?: string;
    slaStatus?: string;
  }, ctx: ActiveOperationalContext) {
    if (!params.startDate || !params.endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const where: any = { deletedAt: null, machine: this.machineScope(ctx) };
    if (params.machineId) where.machineId = params.machineId;
    if (params.productionLineId) where.productionLineId = params.productionLineId;
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.slaStatus) where.slaStatus = params.slaStatus;

    const [requests, schedules] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: {
          ...where,
          OR: [
            { startDate: { gte: start, lte: end } },
            { endDate: { gte: start, lte: end } },
            { startDate: { lte: start }, endDate: { gte: end } },
          ],
        },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          productionLine: { select: { id: true, code: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          assignments: {
            include: {
              maintenancePersonnel: {
                select: { id: true, role: true, operationalPerson: { select: { id: true, code: true, name: true } } },
              },
            },
          },
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.maintenanceSchedule.findMany({
        where: {
          status: 'ACTIVE',
          startDate: { lte: end },
          OR: [
            { endDate: null },
            { endDate: { gte: start } },
          ],
          machine: this.machineScope(ctx),
          ...(params.machineId ? { machineId: params.machineId } : {}),
        },
        include: {
          machine: { select: { id: true, code: true, name: true } },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    const personnelFilter = params.personnelId;
    const filteredRequests = personnelFilter
      ? requests.filter(r => r.assignments.some(a => a.maintenancePersonnelId === personnelFilter) || r.assignedToId === personnelFilter)
      : requests;

    const events = filteredRequests.map(r => ({
      id: r.id,
      title: r.title,
      eventType: 'MAINTENANCE_REQUEST',
      requestId: r.id,
      scheduleId: null,
      machineId: r.machineId,
      machineName: r.machine?.name || null,
      productionLineId: r.productionLineId,
      productionLineName: r.productionLine?.name || null,
      assignedPersonnelId: r.assignedToId,
      assignedPersonnelName: r.assignedTo?.name || null,
      status: r.status,
      priority: r.priority,
      plannedStartAt: r.startDate,
      plannedEndAt: r.endDate,
      dueAt: r.completeDueAt,
      slaStatus: r.slaStatus,
      escalationLevel: r.escalationLevel,
      targetRoute: `/admin/maintenance/requests/${r.id}`,
      color: this.getEventColor(r.status, r.type, r.priority),
      isCompleted: r.status === 'COMPLETED' || r.status === 'CANCELLED' || r.status === 'CLOSED',
      createdAt: r.createdAt,
    }));

    const scheduleEvents = schedules.map(s => ({
      id: s.id,
      title: s.title,
      eventType: 'SCHEDULE',
      requestId: null,
      scheduleId: s.id,
      machineId: s.machineId,
      machineName: s.machine?.name || null,
      productionLineId: null,
      productionLineName: null,
      assignedPersonnelId: null,
      assignedPersonnelName: null,
      status: s.status,
      priority: 'MEDIUM',
      plannedStartAt: s.startDate,
      plannedEndAt: s.endDate,
      dueAt: s.nextDueDate,
      slaStatus: null,
      escalationLevel: null,
      targetRoute: `/admin/maintenance/schedules/${s.id}`,
      color: '#3B82F6',
      isCompleted: s.status === 'COMPLETED' || s.status === 'INACTIVE',
      createdAt: s.createdAt,
    }));

    return [...events, ...scheduleEvents];
  }

  async getCalendarFilters(ctx: ActiveOperationalContext) {
    const [personnel, machines, productionLines] = await Promise.all([
      this.prisma.maintenancePersonnel.findMany({
        where: { isActive: true },
        select: { id: true, role: true, operationalPerson: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.machine.findMany({
        where: { deletedAt: null, ...this.machineScope(ctx) },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.productionLine.findMany({
        where: { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      personnel: personnel.map(p => ({
        id: p.id,
        code: p.operationalPerson?.code || null,
        name: p.operationalPerson?.name || null,
        role: p.role,
      })),
      machines,
      productionLines,
      types: ['PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'PREDICTIVE', 'CALIBRATION'],
      statuses: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED'],
      priorities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      slaStatuses: ['ON_TRACK', 'AT_RISK', 'OVERDUE', 'BREACHED'],
    };
  }

  async getWorkloadSummary(date: string | undefined, ctx: ActiveOperationalContext) {
    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) throw new BadRequestException('Invalid date');

    const now = new Date();
    const activeStatuses = ['OPEN', 'IN_PROGRESS'];
    const nonCompletedStatuses = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];
    const scope = this.machineScope(ctx);

    const [
      personnel,
      allActiveRequests,
      activeAssignments,
      overdueRequests,
      slaDueRequests,
      machines,
      productionLines,
    ] = await Promise.all([
      this.prisma.maintenancePersonnel.findMany({
        where: { isActive: true },
        select: {
          id: true, role: true, dailyCapacityMinutes: true,
          operationalPerson: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.maintenanceRequest.findMany({
        where: { status: { in: activeStatuses }, deletedAt: null, machine: scope },
        select: { id: true, estimatedDurationMinutes: true, machineId: true, productionLineId: true, type: true, priority: true, startDate: true, endDate: true, assignedToId: true },
      }),
      this.prisma.maintenanceRequestAssignment.findMany({
        where: { status: { in: nonCompletedStatuses }, maintenanceRequest: { machine: scope } },
        select: { id: true, maintenancePersonnelId: true, maintenanceRequestId: true },
      }),
      this.prisma.maintenanceRequest.count({
        where: { status: { in: activeStatuses }, endDate: { lt: now }, deletedAt: null, machine: scope },
      }),
      this.prisma.maintenanceRequest.count({
        where: { status: { in: activeStatuses }, completeDueAt: { lte: now }, deletedAt: null, machine: scope },
      }),
      this.prisma.machine.findMany({ where: { deletedAt: null, ...scope }, select: { id: true, code: true, name: true, productionLineId: true } }),
      this.prisma.productionLine.findMany({ where: { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId }, select: { id: true, code: true, name: true } }),
    ]);

    const duration = (r: typeof allActiveRequests[0]) => r.estimatedDurationMinutes || 120;

    const workloadByPersonnel = personnel.map(p => {
      const assignedIds = activeAssignments.filter(a => a.maintenancePersonnelId === p.id).map(a => a.maintenanceRequestId);
      const assignedReqs = allActiveRequests.filter(r => assignedIds.includes(r.id) || r.assignedToId === p.id);
      const totalMinutes = assignedReqs.reduce((sum, r) => sum + duration(r), 0);
      const capacity = p.dailyCapacityMinutes || 480;
      const pct = capacity > 0 ? Math.round((totalMinutes / capacity) * 100) : 0;
      return {
        personnelId: p.id,
        personnelName: p.operationalPerson?.name || null,
        role: p.role,
        assignedCount: assignedReqs.length,
        totalEstimatedMinutes: totalMinutes,
        dailyCapacityMinutes: capacity,
        workloadPercent: pct,
        status: pct > 100 ? 'OVERLOADED' : pct > 80 ? 'HIGH' : 'NORMAL',
      };
    });

    const workloadByMachine = machines.map(m => {
      const reqs = allActiveRequests.filter(r => r.machineId === m.id);
      const totalMinutes = reqs.reduce((sum, r) => sum + duration(r), 0);
      return { machineId: m.id, machineCode: m.code, machineName: m.name, productionLineId: m.productionLineId, activeRequestCount: reqs.length, totalEstimatedMinutes: totalMinutes };
    });

    const workloadByProductionLine = productionLines.map(pl => {
      const lineMachines = machines.filter(m => m.productionLineId === pl.id);
      const lineMachineIds = lineMachines.map(m => m.id);
      const reqs = allActiveRequests.filter(r => r.productionLineId === pl.id || lineMachineIds.includes(r.machineId));
      const totalMinutes = reqs.reduce((sum, r) => sum + duration(r), 0);
      return { productionLineId: pl.id, productionLineName: pl.name, machineCount: lineMachines.length, activeRequestCount: reqs.length, totalEstimatedMinutes: totalMinutes };
    });

    const unassignedCount = allActiveRequests.filter(r => !r.assignedToId && !activeAssignments.some(a => a.maintenanceRequestId === r.id)).length;
    const emergencyCount = allActiveRequests.filter(r => r.type === 'EMERGENCY' || r.type === 'emergency').length;
    const preventiveCount = allActiveRequests.filter(r => r.type === 'PREVENTIVE' || r.type === 'preventive').length;
    const overloadedCount = workloadByPersonnel.filter(w => w.status === 'OVERLOADED').length;
    const highCount = workloadByPersonnel.filter(w => w.status === 'HIGH').length;

    const conflicts = await this.detectConflictsRaw(activeAssignments, allActiveRequests);

    return {
      totalActiveRequests: allActiveRequests.length,
      totalPersonnel: personnel.length,
      activeAssignmentsCount: activeAssignments.length,
      unassignedCount,
      overdueCount: overdueRequests,
      slaDueCount: slaDueRequests,
      emergencyCount,
      preventiveCount,
      overloadedCount,
      highWorkloadCount: highCount,
      conflictCount: conflicts.length,
      workloadByPersonnel,
      workloadByMachine,
      workloadByProductionLine,
      conflicts,
    };
  }

  async getWorkloadByPersonnel(date: string | undefined, ctx: ActiveOperationalContext) {
    const summary = await this.getWorkloadSummary(date, ctx);
    return summary.workloadByPersonnel;
  }

  async getWorkloadByMachine(date: string | undefined, ctx: ActiveOperationalContext) {
    const summary = await this.getWorkloadSummary(date, ctx);
    return summary.workloadByMachine;
  }

  async getWorkloadByProductionLine(date: string | undefined, ctx: ActiveOperationalContext) {
    const summary = await this.getWorkloadSummary(date, ctx);
    return summary.workloadByProductionLine;
  }

  async getWorkloadByDate(startDate: string, endDate: string, ctx: ActiveOperationalContext) {
    if (!startDate || !endDate) throw new BadRequestException('startDate and endDate are required');
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('Invalid date');

    const requests = await this.prisma.maintenanceRequest.findMany({
      where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, machine: this.machineScope(ctx), OR: [{ startDate: { gte: start, lte: end } }, { endDate: { gte: start, lte: end } }] },
      select: { id: true, startDate: true, endDate: true, estimatedDurationMinutes: true, machineId: true, productionLineId: true, type: true, assignedToId: true },
    });

    const daily: Record<string, { count: number; estimatedMinutes: number }> = {};
    let cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      const dayReqs = requests.filter(r => {
        const s = r.startDate ? r.startDate.toISOString().slice(0, 10) : null;
        const e = r.endDate ? r.endDate.toISOString().slice(0, 10) : null;
        return s === key || e === key || (s && e && s <= key && e >= key);
      });
      daily[key] = { count: dayReqs.length, estimatedMinutes: dayReqs.reduce((sum, r) => sum + (r.estimatedDurationMinutes || 120), 0) };
      cursor.setDate(cursor.getDate() + 1);
    }

    return { startDate, endDate, daily };
  }

  async getOverloadedPersonnel(date: string | undefined, ctx: ActiveOperationalContext) {
    const summary = await this.getWorkloadSummary(date, ctx);
    return summary.workloadByPersonnel.filter(w => w.status === 'OVERLOADED');
  }

  async getConflicts(startDate: string | undefined, endDate: string | undefined, ctx: ActiveOperationalContext) {
    const activeStatuses = ['OPEN', 'IN_PROGRESS'];
    const nonCompletedStatuses = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];
    const scope = this.machineScope(ctx);

    const [assignments, requests] = await Promise.all([
      this.prisma.maintenanceRequestAssignment.findMany({
        where: { status: { in: nonCompletedStatuses }, maintenanceRequest: { machine: scope } },
        include: {
          maintenancePersonnel: { select: { id: true, role: true, operationalPerson: { select: { id: true, code: true, name: true } } } },
          maintenanceRequest: { select: { id: true, requestNumber: true, title: true, startDate: true, endDate: true, machineId: true } },
        },
      }),
      this.prisma.maintenanceRequest.findMany({
        where: { status: { in: activeStatuses }, deletedAt: null, machine: scope },
        select: { id: true, requestNumber: true, title: true, startDate: true, endDate: true, machineId: true },
      }),
    ]);

    const conflicts: any[] = [];
    assignments.forEach((a, i) => {
      if (!a.maintenanceRequest.startDate || !a.maintenanceRequest.endDate) return;
      assignments.forEach((b, j) => {
        if (j <= i) return;
        if (a.maintenancePersonnelId !== b.maintenancePersonnelId) return;
        if (!b.maintenanceRequest.startDate || !b.maintenanceRequest.endDate) return;
        if (a.maintenanceRequest.startDate! < b.maintenanceRequest.endDate! && a.maintenanceRequest.endDate! > b.maintenanceRequest.startDate!) {
          conflicts.push({
            type: 'PERSONNEL_CONFLICT',
            personnelId: a.maintenancePersonnelId,
            personnelName: a.maintenancePersonnel.operationalPerson?.name || null,
            requestA: { id: a.maintenanceRequest.id, title: a.maintenanceRequest.title, startDate: a.maintenanceRequest.startDate, endDate: a.maintenanceRequest.endDate },
            requestB: { id: b.maintenanceRequest.id, title: b.maintenanceRequest.title, startDate: b.maintenanceRequest.startDate, endDate: b.maintenanceRequest.endDate },
            severity: 'WARNING',
          });
        }
      });
    });

    requests.forEach((r, i) => {
      if (!r.startDate || !r.endDate) return;
      requests.forEach((s, j) => {
        if (j <= i) return;
        if (r.machineId !== s.machineId) return;
        if (!s.startDate || !s.endDate) return;
        if (r.startDate! < s.endDate! && r.endDate! > s.startDate!) {
          conflicts.push({
            type: 'MACHINE_CONFLICT',
            machineId: r.machineId,
            requestA: { id: r.id, title: r.title, startDate: r.startDate, endDate: r.endDate },
            requestB: { id: s.id, title: s.title, startDate: s.startDate, endDate: s.endDate },
            severity: 'WARNING',
          });
        }
      });
    });

    return conflicts;
  }

  async getUnassignedWork(page = 1, limit = 10, ctx: ActiveOperationalContext) {
    const activeStatuses = ['OPEN', 'IN_PROGRESS'];
    const scope = this.machineScope(ctx);
    const assignedIds = await this.prisma.maintenanceRequestAssignment.findMany({
      where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] }, maintenanceRequest: { machine: scope } },
      select: { maintenanceRequestId: true },
    });
    const assignedRequestIds = [...new Set(assignedIds.map(a => a.maintenanceRequestId))];
    const where = { status: { in: activeStatuses }, deletedAt: null, assignedToId: null, id: { notIn: assignedRequestIds }, machine: scope };
    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: { machine: { select: { id: true, code: true, name: true } }, productionLine: { select: { id: true, name: true } } },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOverduePlannedWork(page = 1, limit = 10, ctx: ActiveOperationalContext) {
    const now = new Date();
    const where = { status: { in: ['OPEN', 'IN_PROGRESS'] }, endDate: { lt: now }, deletedAt: null, machine: this.machineScope(ctx) };
    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { endDate: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getSlaDueWork(page = 1, limit = 10, ctx: ActiveOperationalContext) {
    const now = new Date();
    const where = { status: { in: ['OPEN', 'IN_PROGRESS'] }, completeDueAt: { not: null, lte: now }, deletedAt: null, machine: this.machineScope(ctx) };
    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { completeDueAt: 'asc' },
        include: { machine: { select: { id: true, code: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updatePlanning(requestId: string, body: { plannedStartAt?: string; plannedEndAt?: string; estimatedDurationMinutes?: number }, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);

    const data: any = {};
    if (body.plannedStartAt !== undefined) data.startDate = new Date(body.plannedStartAt);
    if (body.plannedEndAt !== undefined) data.endDate = new Date(body.plannedEndAt);
    if (body.estimatedDurationMinutes !== undefined) data.estimatedDurationMinutes = body.estimatedDurationMinutes;

    return this.prisma.maintenanceRequest.update({ where: { id: requestId }, data, select: { id: true, requestNumber: true, startDate: true, endDate: true, estimatedDurationMinutes: true } });
  }

  async reschedule(requestId: string, body: { plannedStartAt: string; plannedEndAt: string; reason?: string }, ctx: ActiveOperationalContext) {
    if (!body.plannedStartAt || !body.plannedEndAt) throw new BadRequestException('plannedStartAt and plannedEndAt are required');
    const request = await this.findRequestOrFail(requestId, ctx);

    const start = new Date(body.plannedStartAt);
    const end = new Date(body.plannedEndAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('Invalid date format');
    if (start >= end) throw new BadRequestException('plannedStartAt must be before plannedEndAt');

    return this.prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: { startDate: start, endDate: end, notes: body.reason ? `${request.notes || ''}\nRescheduled: ${body.reason}` : undefined },
      select: { id: true, requestNumber: true, startDate: true, endDate: true },
    });
  }

  async assignPlannedWork(requestId: string, personnelId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);

    const personnel = await this.prisma.maintenancePersonnel.findUnique({ where: { id: personnelId }, select: { id: true, isActive: true } });
    if (!personnel) throw new BadRequestException('Personnel not found');
    if (!personnel.isActive) throw new BadRequestException('Personnel is not active');

    const existing = await this.prisma.maintenanceRequestAssignment.findFirst({
      where: { maintenanceRequestId: requestId, maintenancePersonnelId: personnelId, status: { notIn: ['CANCELLED'] } },
    });
    if (existing) throw new BadRequestException('Personnel already assigned to this request');

    return this.prisma.maintenanceRequestAssignment.create({
      data: { maintenanceRequestId: requestId, maintenancePersonnelId: personnelId, assignmentRole: 'ASSISTANT', status: 'ASSIGNED' },
      select: { id: true, maintenanceRequestId: true, maintenancePersonnelId: true, status: true, assignedAt: true },
    });
  }

  async getCapacityInfo(ctx: ActiveOperationalContext) {
    const personnel = await this.prisma.maintenancePersonnel.findMany({
      where: { isActive: true },
      select: { id: true, dailyCapacityMinutes: true, role: true, operationalPerson: { select: { id: true, code: true, name: true } } },
    });
    return {
      defaultCapacityMinutes: 480,
      capacityRule: '8 hours per day per active maintenance personnel (default)',
      personnel: personnel.map(p => ({
        id: p.id,
        name: p.operationalPerson?.name || null,
        role: p.role,
        dailyCapacityMinutes: p.dailyCapacityMinutes,
        dailyCapacityHours: Math.round((p.dailyCapacityMinutes / 60) * 100) / 100,
      })),
    };
  }

  private async detectConflictsRaw(assignments: any[], requests: any[]) {
    const conflicts: any[] = [];
    assignments.forEach((a: any, i: number) => {
      const reqA = requests.find((r: any) => r.id === a.maintenanceRequestId);
      if (!reqA || !reqA.startDate || !reqA.endDate) return;
      assignments.forEach((b: any, j: number) => {
        if (j <= i) return;
        if (a.maintenancePersonnelId !== b.maintenancePersonnelId) return;
        const reqB = requests.find((r: any) => r.id === b.maintenanceRequestId);
        if (!reqB || !reqB.startDate || !reqB.endDate) return;
        if (reqA.startDate < new Date(reqB.endDate) && reqA.endDate > new Date(reqB.startDate)) {
          conflicts.push({ type: 'PERSONNEL', personnelId: a.maintenancePersonnelId, requestAId: reqA.id, requestBId: reqB.id, severity: 'WARNING' });
        }
      });
    });
    return conflicts;
  }

  private getEventColor(status: string, type: string, priority: string): string {
    if (status === 'COMPLETED' || status === 'CLOSED') return '#6B7280';
    if (status === 'CANCELLED') return '#9CA3AF';
    if (priority === 'CRITICAL' || priority === 'HIGH') return '#EF4444';
    if (type === 'EMERGENCY') return '#F97316';
    if (type === 'PREVENTIVE') return '#22C55E';
    if (status === 'IN_PROGRESS') return '#3B82F6';
    return '#EAB308';
  }
}
