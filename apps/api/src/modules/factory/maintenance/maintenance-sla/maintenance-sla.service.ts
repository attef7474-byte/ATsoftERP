import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const AUDIT_ENTITY = 'MaintenanceSlaState';
const AUDIT_SCOPE = 'MAINTENANCE_SLA';

@Injectable()
export class MaintenanceSlaService {
  constructor(private prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  private auditWriter(): AuditService {
    return this.audit ?? new AuditService(this.prisma);
  }

  private async auditWrite(
    userId: string | undefined,
    action: string,
    entityId: string,
    ctx: ActiveOperationalContext,
    previous: Record<string, unknown> | null,
    next: Record<string, unknown>,
    reason: string,
  ) {
    if (!userId) return;
    await this.auditWriter().log(userId, action, AUDIT_ENTITY, entityId, {
      schemaVersion: 1,
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      scope: AUDIT_SCOPE,
      actor: { userId },
      previous,
      next,
      reason,
    });
  }

  private slaSnapshot(state: any) {
    if (!state) return null;
    return {
      slaStatus: state.slaStatus ?? null,
      escalationLevel: state.escalationLevel ?? null,
      responseDueAt: state.responseDueAt?.toISOString?.() ?? null,
      startDueAt: state.startDueAt?.toISOString?.() ?? null,
      completeDueAt: state.completeDueAt?.toISOString?.() ?? null,
      responseOverdueMin: state.responseOverdueMin ?? null,
      startOverdueMin: state.startOverdueMin ?? null,
      completeOverdueMin: state.completeOverdueMin ?? null,
    };
  }

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

  private async assertRequestOwned(requestId: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: { machine: { select: { companyId: true, branchId: true } } },
    });
    if (!request || !this.isMachineInScope(request.machine, ctx)) {
      throw new NotFoundException('Maintenance request not found');
    }
    return request;
  }

  async calculateDeadlines(request: any): Promise<{
    responseDueAt: Date | null;
    startDueAt: Date | null;
    completeDueAt: Date | null;
  }> {
    const createdAt = request.createdAt || new Date();
    const priority = request.priority || 'MEDIUM';
    const type = request.type || 'CORRECTIVE';

    const rule = await this.prisma.maintenanceSlaRule.findFirst({
      where: { isActive: true, priority, type },
      orderBy: { createdAt: 'desc' },
    });

    if (!rule) {
      return { responseDueAt: null, startDueAt: null, completeDueAt: null };
    }

    const responseDueAt = rule.responseHours
      ? new Date(createdAt.getTime() + rule.responseHours * 60 * 60 * 1000)
      : null;
    const startDueAt = rule.startHours
      ? new Date(createdAt.getTime() + rule.startHours * 60 * 60 * 1000)
      : null;
    const completeDueAt = rule.completeHours
      ? new Date(createdAt.getTime() + rule.completeHours * 60 * 60 * 1000)
      : null;

    return { responseDueAt, startDueAt, completeDueAt };
  }

  async createSlaState(requestId: string, ctx: ActiveOperationalContext, userId?: string) {
    const request = await this.assertRequestOwned(requestId, ctx);
    const previous = await this.prisma.maintenanceSlaState.findUnique({
      where: { maintenanceRequestKey: requestId },
    });

    const deadlines = await this.calculateDeadlines(request);

    await this.prisma.maintenanceSlaState.upsert({
      where: { maintenanceRequestKey: requestId },
      create: {
        maintenanceRequestId: requestId,
        maintenanceRequestKey: requestId,
        responseDueAt: deadlines.responseDueAt,
        startDueAt: deadlines.startDueAt,
        completeDueAt: deadlines.completeDueAt,
        slaStatus: 'ON_TRACK',
        escalationLevel: 'NONE',
      },
      update: {
        responseDueAt: deadlines.responseDueAt,
        startDueAt: deadlines.startDueAt,
        completeDueAt: deadlines.completeDueAt,
      },
    });

    await this.prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: { ...deadlines, slaStatus: 'ON_TRACK', escalationLevel: 'NONE' },
    });

    await this.auditWrite(userId, 'SLA_STATE_CREATE', requestId, ctx, this.slaSnapshot(previous), {
      ...this.slaSnapshot(previous),
      responseDueAt: deadlines.responseDueAt?.toISOString() ?? null,
      startDueAt: deadlines.startDueAt?.toISOString() ?? null,
      completeDueAt: deadlines.completeDueAt?.toISOString() ?? null,
      slaStatus: 'ON_TRACK',
      escalationLevel: 'NONE',
    }, 'SLA_DEADLINE_INITIALIZATION');
  }

  async recalculateSla(requestId: string, ctx: ActiveOperationalContext, userId?: string) {
    const request = await this.assertRequestOwned(requestId, ctx);

    const now = new Date();
    const state = await this.prisma.maintenanceSlaState.findUnique({
      where: { maintenanceRequestKey: requestId },
    });
    if (!state) return;

    const responseOverdueMin =
      state.responseDueAt && !state.responseActualAt
        ? Math.max(0, Math.floor((now.getTime() - state.responseDueAt.getTime()) / 60000))
        : null;
    const startOverdueMin =
      state.startDueAt && !state.startActualAt
        ? Math.max(0, Math.floor((now.getTime() - state.startDueAt.getTime()) / 60000))
        : null;
    const completeOverdueMin =
      state.completeDueAt && !state.completeActualAt
        ? Math.max(0, Math.floor((now.getTime() - state.completeDueAt.getTime()) / 60000))
        : null;

    const isOverdue = (responseOverdueMin ?? 0) > 0 || (startOverdueMin ?? 0) > 0 || (completeOverdueMin ?? 0) > 0;
    const slaStatus = isOverdue ? 'OVERDUE' : 'ON_TRACK';

    const rule = await this.prisma.maintenanceSlaRule.findFirst({
      where: { isActive: true, priority: request.priority, type: request.type },
      orderBy: { createdAt: 'desc' },
    });

    let escalationLevel = 'NONE';
    if (isOverdue && rule?.escalationDelayHours && rule?.escalationDelayHours > 0) {
      const maxOverdueMin = Math.max(
        responseOverdueMin || 0,
        startOverdueMin || 0,
        completeOverdueMin || 0,
      );
      const escalationThresholdMs = rule.escalationDelayHours * 60 * 60 * 1000;
      const levels = rule.escalationLevels || 1;
      const levelStep = escalationThresholdMs / levels;
      const levelIndex = Math.min(
        Math.floor((maxOverdueMin * 60000) / levelStep),
        levels,
      );
      escalationLevel = levelIndex > 0 ? `LEVEL_${levelIndex}` : 'NONE';
    }

    await this.prisma.maintenanceSlaState.update({
      where: { maintenanceRequestKey: requestId },
      data: {
        slaStatus,
        escalationLevel,
        responseOverdueMin,
        startOverdueMin,
        completeOverdueMin,
        lastEscalatedAt: escalationLevel !== 'NONE' ? now : state.lastEscalatedAt,
      },
    });

    await this.prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: { slaStatus, escalationLevel },
    });

    await this.auditWrite(userId, 'SLA_RECALCULATE', requestId, ctx, this.slaSnapshot(state), {
      ...this.slaSnapshot(state),
      slaStatus,
      escalationLevel,
      responseOverdueMin,
      startOverdueMin,
      completeOverdueMin,
    }, 'SLA_RECALCULATION');

    return { slaStatus, escalationLevel, responseOverdueMin, startOverdueMin, completeOverdueMin };
  }

  async getSlaSummary(requestId: string, ctx: ActiveOperationalContext) {
    await this.assertRequestOwned(requestId, ctx);
    const state = await this.prisma.maintenanceSlaState.findUnique({
      where: { maintenanceRequestKey: requestId },
    });
    return state;
  }

  async getOverdueRequests(ctx: ActiveOperationalContext) {
    const now = new Date();
    return this.prisma.maintenanceRequest.findMany({
      where: {
        deletedAt: null,
        machine: this.machineScope(ctx),
        status: { notIn: ['CLOSED', 'CANCELLED', 'COMPLETED'] },
        OR: [
          { responseDueAt: { not: null, lte: now } },
          { startDueAt: { not: null, lte: now } },
          { completeDueAt: { not: null, lte: now } },
        ],
      },
      include: {
        machine: true,
        assignedTo: true,
        requestedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSlaStats(ctx: ActiveOperationalContext) {
    const machine = this.machineScope(ctx);
    const [totalOnTrack, totalOverdue, totalEscalated] = await Promise.all([
      this.prisma.maintenanceRequest.count({
        where: { deletedAt: null, slaStatus: 'ON_TRACK', machine },
      }),
      this.prisma.maintenanceRequest.count({
        where: { deletedAt: null, slaStatus: 'OVERDUE', machine },
      }),
      this.prisma.maintenanceRequest.count({
        where: { deletedAt: null, escalationLevel: { not: 'NONE' }, machine },
      }),
    ]);

    return {
      total: totalOnTrack + totalOverdue,
      onTrack: totalOnTrack,
      overdue: totalOverdue,
      escalated: totalEscalated,
      critical: totalEscalated,
    };
  }
}
