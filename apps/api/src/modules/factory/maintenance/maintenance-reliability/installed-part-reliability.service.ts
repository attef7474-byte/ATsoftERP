import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import {
  computeServiceLifeMs,
  computeExpectedLife,
  classifyTermination,
  classifyPremature,
  computeMtbf,
  computeMttr,
  isRepeatedEarlyFailure,
  LifeCycleInstance,
  ExpectedLife,
  DurationValue,
  TerminationClass,
} from './reliability-calculations';
import { QueryInstalledPartReliabilityDto } from './dto/installed-part-reliability.dto';

const MAX_POPULATIONS = 2000;

export interface ReliabilityRow {
  key: string;
  machine: { id: string; code: string; name: string };
  productionLine: { id: string; code: string; name: string } | null;
  machineComponent: { id: string; code: string; name: string } | null;
  sparePart: { id: string; code: string; name: string; partNumber: string | null; manufacturer: string | null; isCritical: boolean; unit: string | null };
  current: {
    id: string;
    status: string;
    installedAt: Date | null;
    installedQuantity: number;
    serialNumber: string | null;
    installedCondition: string;
    serviceLife: DurationValue;
    expectedLife: ExpectedLife;
  } | null;
  lastFailureAt: Date | null;
  replacementCount: number;
  failureEventCount: number;
  prematureFailureCount: number;
  repeatedEarlyFailure: boolean;
  mtbf: ReturnType<typeof computeMtbf>;
  mttr: ReturnType<typeof computeMttr>;
}

/**
 * Part-level (machine + spare part) reliability analytics.
 *
 * READ-ONLY. This service never writes lifecycle, inventory, or execution rows;
 * it only reads and aggregates. It does NOT redefine the pre-existing
 * machine-level downtime KPIs (see maintenance-reliability.service.ts).
 */
@Injectable()
export class InstalledPartReliabilityService {
  constructor(private prisma: PrismaService) {}

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

  private async assertMachineAccess(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
      select: { id: true },
    });
    if (!machine) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
  }

  private async assertLineAccess(productionLineId: string, ctx: ActiveOperationalContext) {
    const line = await this.prisma.productionLine.findFirst({
      where: { id: productionLineId, companyId: ctx.companyId, branchId: ctx.branchId },
      select: { id: true },
    });
    if (!line) throw this.notFound('maintenance.productionLineNotFound', 'Production line not found');
  }

  private async buildWhere(query: QueryInstalledPartReliabilityDto, ctx: ActiveOperationalContext): Promise<any> {
    const where: any = { machine: this.machineScope(ctx) };
    if (query.machineId) {
      await this.assertMachineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.productionLineId) {
      await this.assertLineAccess(query.productionLineId, ctx);
      where.machine = { ...this.machineScope(ctx), productionLineId: query.productionLineId };
    }
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.status) where.status = query.status;
    if (query.lifeStatus) where.lifeStatus = query.lifeStatus;
    const sparePartWhere: any = {};
    if (query.manufacturer) sparePartWhere.manufacturer = query.manufacturer;
    if (query.isCritical === 'true') sparePartWhere.isCritical = true;
    if (Object.keys(sparePartWhere).length) where.sparePart = sparePartWhere;
    if (query.dateFrom || query.dateTo) {
      where.installedAt = {};
      if (query.dateFrom) where.installedAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.installedAt.lte = new Date(query.dateTo);
    }
    return where;
  }

  private collect(rows: ReliabilityRow[], query: QueryInstalledPartReliabilityDto): ReliabilityRow[] {
    let out = rows;
    if (query.onlyEarlyFailure === 'true') out = out.filter((r) => r.prematureFailureCount >= 1);
    if (query.onlyApproachingEol === 'true') {
      out = out.filter((r) => r.current && ['WARNING', 'DUE', 'EXPIRED'].includes(r.current.expectedLife.band));
    }
    return out;
  }

  /** Build every reliability population row for the query (no pagination). */
  async buildRows(query: QueryInstalledPartReliabilityDto, ctx: ActiveOperationalContext): Promise<ReliabilityRow[]> {
    const now = new Date();
    const where = await this.buildWhere(query, ctx);

    const parts = await this.prisma.machineInstalledPart.findMany({
      where,
      include: {
        machine: {
          select: {
            id: true,
            code: true,
            name: true,
            productionLine: { select: { id: true, code: true, name: true } },
          },
        },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: {
          select: { id: true, code: true, name: true, partNumber: true, manufacturer: true, isCritical: true, unit: true },
        },
      },
      orderBy: { installedAt: 'desc' },
    });

    // Group into (machine, sparePart) populations.
    const groups = new Map<string, any[]>();
    for (const p of parts as any[]) {
      const key = `${p.machineId}::${p.sparePartId}`;
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }
    if (groups.size > MAX_POPULATIONS) {
      throw this.badRequest('analytics.resultTooLarge', `The reliability report matches more than ${MAX_POPULATIONS} machine/part populations; narrow the filters`);
    }
    if (groups.size === 0) return [];

    const partIds = (parts as any[]).map((p) => p.id);
    const machineIds = [...new Set((parts as any[]).map((p) => p.machineId))];
    const sparePartIds = [...new Set((parts as any[]).map((p) => p.sparePartId))];

    const [replacements, usages] = await Promise.all([
      this.prisma.sparePartReplacementHistory.findMany({
        where: {
          machineId: { in: machineIds },
          OR: [{ newSparePartId: { in: sparePartIds } }, { oldSparePartId: { in: sparePartIds } }],
        },
        select: {
          id: true, machineId: true,
          oldSparePartId: true, newSparePartId: true, oldInstalledPartId: true, newInstalledPartId: true,
          replacementAction: true, replacedAt: true,
        },
      }),
      this.prisma.maintenanceExecutionPartUsage.findMany({
        where: { installedPartId: { in: partIds } },
        select: { id: true, executionId: true, installedPartId: true, replacementHistoryId: true, usageType: true, usedAt: true },
      }),
    ]);

    const execIds = [...new Set((usages as any[]).map((u) => u.executionId).filter(Boolean))];

    const [tasks, sessions, downtimeLogs] = await Promise.all([
      execIds.length
        ? this.prisma.maintenanceTask.findMany({
            where: { id: { in: execIds } },
            select: { id: true, startedAt: true, completedAt: true, status: true },
          })
        : Promise.resolve([]),
      execIds.length
        ? this.prisma.maintenanceExecutionSession.findMany({
            where: { executionId: { in: execIds } },
            select: { executionId: true, startedAt: true, endedAt: true },
          })
        : Promise.resolve([]),
      this.prisma.downtimeLog.findMany({
        where: { machineId: { in: machineIds }, failureCategory: { not: null }, cancelledAt: null },
        select: { id: true, machineId: true, requestId: true, executionId: true, failureCategory: true, startTime: true, endTime: true, durationMinutes: true },
      }),
    ]);

    const taskById = new Map<string, any>((tasks as any[]).map((t) => [t.id, t]));
    const laborByExec = new Map<string, number>();
    for (const s of sessions as any[]) {
      if (s.startedAt && s.endedAt) {
        const ms = s.endedAt.getTime() - s.startedAt.getTime();
        if (ms > 0) laborByExec.set(s.executionId, (laborByExec.get(s.executionId) ?? 0) + ms);
      }
    }

    const usageByPart = new Map<string, string[]>();
    const usageByHistory = new Map<string, string[]>();
    for (const u of usages as any[]) {
      if (u.installedPartId) {
        const a = usageByPart.get(u.installedPartId) ?? [];
        a.push(u.executionId);
        usageByPart.set(u.installedPartId, a);
      }
      if (u.replacementHistoryId) {
        const a = usageByHistory.get(u.replacementHistoryId) ?? [];
        a.push(u.executionId);
        usageByHistory.set(u.replacementHistoryId, a);
      }
    }
    const historiesByPart = new Map<string, any[]>();
    for (const r of replacements as any[]) {
      for (const pid of [r.oldInstalledPartId, r.newInstalledPartId]) {
        if (!pid) continue;
        const a = historiesByPart.get(pid) ?? [];
        a.push(r);
        historiesByPart.set(pid, a);
      }
    }

    const rows: ReliabilityRow[] = [];
    for (const [key, instancesRaw] of groups.entries()) {
      const instances: any[] = [...instancesRaw].sort(
        (a, b) => (b.installedAt?.getTime() ?? 0) - (a.installedAt?.getTime() ?? 0),
      );
      const first = instances[0];
      const machineId = first.machineId;
      const sparePartId = first.sparePartId;

      const execIdsForPart = (partId: string): Set<string> => {
        const set = new Set<string>(usageByPart.get(partId) ?? []);
        for (const h of historiesByPart.get(partId) ?? []) {
          for (const eid of usageByHistory.get(h.id) ?? []) set.add(eid);
        }
        return set;
      };

      const machineDowntime = (downtimeLogs as any[]).filter((l) => l.machineId === machineId);

      let failureEventCount = 0;
      let prematureFailureCount = 0;
      let lastFailureAt: Date | null = null;
      const failureLivesMs: number[] = [];
      const repairExecIds = new Set<string>();
      const linkedDowntimeIds = new Set<string>();
      let openRepairs = 0;

      let current: ReliabilityRow['current'] = null;

      for (const part of instances) {
        const lifecycle: LifeCycleInstance = {
          status: part.status,
          installedAt: part.installedAt,
          removedAt: part.removedAt,
          expectedLifeValue: part.expectedLifeValue,
          expectedLifeUnit: part.expectedLifeUnit,
          lifeStartDate: part.lifeStartDate,
          lifeStartReading: part.lifeStartReading,
          currentReading: part.currentReading,
          warningThresholdPercent: part.warningThresholdPercent,
        };
        const serviceLife = computeServiceLifeMs(lifecycle, now);
        const expectedLife = computeExpectedLife(lifecycle, now);

        if (part.status === 'ACTIVE' && !current) {
          current = {
            id: part.id,
            status: part.status,
            installedAt: part.installedAt,
            installedQuantity: part.installedQuantity,
            serialNumber: part.serialNumber ?? null,
            installedCondition: part.installedCondition,
            serviceLife,
            expectedLife,
          };
          continue; // ACTIVE is never a failure event
        }

        const pExecIds = execIdsForPart(part.id);
        const linked = machineDowntime.filter(
          (l) =>
            (l.requestId && part.maintenanceRequestId && l.requestId === part.maintenanceRequestId)
            || (l.executionId && pExecIds.has(l.executionId)),
        );
        const classification: TerminationClass = classifyTermination({
          status: part.status,
          linkedFailureCategories: linked.map((l) => l.failureCategory),
        });

        if (classification === 'FAILURE') {
          failureEventCount += 1;
          if (part.removedAt && (!lastFailureAt || part.removedAt > lastFailureAt)) lastFailureAt = part.removedAt;
          if (serviceLife.state === 'OK' && serviceLife.ms !== null) failureLivesMs.push(serviceLife.ms);
          if (classifyPremature({ classification, serviceLife, expected: expectedLife }) === 'YES') {
            prematureFailureCount += 1;
          }
          for (const eid of pExecIds) repairExecIds.add(eid);
          for (const l of linked) linkedDowntimeIds.add(l.id);
        }
      }

      let laborMs = 0;
      const repairDurations: number[] = [];
      for (const eid of repairExecIds) {
        const t = taskById.get(eid);
        if (t && t.startedAt && t.completedAt) {
          const ms = t.completedAt.getTime() - t.startedAt.getTime();
          if (ms >= 0) repairDurations.push(ms);
          laborMs += laborByExec.get(eid) ?? 0;
        } else {
          openRepairs += 1;
        }
      }
      let downtimeMs = 0;
      for (const l of downtimeLogs as any[]) {
        if (!linkedDowntimeIds.has(l.id)) continue;
        if (typeof l.durationMinutes === 'number') downtimeMs += l.durationMinutes * 60_000;
        else if (l.startTime && l.endTime) downtimeMs += l.endTime.getTime() - l.startTime.getTime();
      }

      const replacementCount = (replacements as any[]).filter(
        (r) => r.machineId === machineId && (r.newSparePartId === sparePartId || r.oldSparePartId === sparePartId),
      ).length;

      const component = instances.find((i) => i.machineComponent)?.machineComponent ?? null;

      rows.push({
        key,
        machine: { id: first.machine.id, code: first.machine.code, name: first.machine.name },
        productionLine: first.machine.productionLine ?? null,
        machineComponent: component ? { id: component.id, code: component.code, name: component.name } : null,
        sparePart: {
          id: first.sparePart.id,
          code: first.sparePart.code,
          name: first.sparePart.name,
          partNumber: first.sparePart.partNumber ?? null,
          manufacturer: first.sparePart.manufacturer ?? null,
          isCritical: !!first.sparePart.isCritical,
          unit: first.sparePart.unit ?? null,
        },
        current,
        lastFailureAt,
        replacementCount,
        failureEventCount,
        prematureFailureCount,
        repeatedEarlyFailure: isRepeatedEarlyFailure(failureEventCount, prematureFailureCount),
        mtbf: computeMtbf(failureLivesMs),
        mttr: computeMttr(repairDurations, { laborMs, downtimeMs, openRepairs }),
      });
    }

    const filtered = this.collect(rows, query);
    filtered.sort((a, b) => {
      if (b.failureEventCount !== a.failureEventCount) return b.failureEventCount - a.failureEventCount;
      return (b.lastFailureAt?.getTime() ?? 0) - (a.lastFailureAt?.getTime() ?? 0);
    });
    return filtered;
  }

  async listReliability(query: QueryInstalledPartReliabilityDto, ctx: ActiveOperationalContext) {
    const rows = await this.buildRows(query, ctx);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;
    return {
      data: rows.slice(skip, skip + limit),
      meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
    };
  }

  async getSummary(query: QueryInstalledPartReliabilityDto, ctx: ActiveOperationalContext) {
    const rows = await this.buildRows(query, ctx);
    const activeInstalledParts = rows.filter((r) => r.current).length;
    const nearExpectedEnd = rows.filter((r) => r.current && ['WARNING', 'DUE'].includes(r.current.expectedLife.band)).length;
    const overdueParts = rows.filter((r) => r.current && r.current.expectedLife.band === 'EXPIRED').length;
    const prematureFailures = rows.reduce((s, r) => s + r.prematureFailureCount, 0);

    const mostReplaced = [...rows]
      .filter((r) => r.replacementCount > 0)
      .sort((a, b) => b.replacementCount - a.replacementCount)
      .slice(0, 5)
      .map((r) => ({ machine: r.machine, sparePart: r.sparePart, replacementCount: r.replacementCount }));

    const machinesWithMostFailures = [...rows]
      .filter((r) => r.failureEventCount > 0)
      .sort((a, b) => b.failureEventCount - a.failureEventCount)
      .slice(0, 5)
      .map((r) => ({ machine: r.machine, sparePart: r.sparePart, failureEventCount: r.failureEventCount }));

    return {
      populations: rows.length,
      activeInstalledParts,
      nearExpectedEnd,
      overdueParts,
      prematureFailures,
      mostReplaced,
      machinesWithMostFailures,
      // honesty markers: null (not 0) when there is no measurable population
      hasExpectedLifeData: rows.some((r) => r.current?.expectedLife.configured),
    };
  }

  async getDataQuality(query: QueryInstalledPartReliabilityDto, ctx: ActiveOperationalContext) {
    const where = await this.buildWhere(query, ctx);
    const parts = await this.prisma.machineInstalledPart.findMany({
      where,
      select: {
        id: true, machineId: true, status: true, installedAt: true, removedAt: true,
        expectedLifeValue: true, expectedLifeUnit: true,
      },
    });
    const partIds = (parts as any[]).map((p) => p.id);
    const machineIds = [...new Set((parts as any[]).map((p) => (p as any).machineId).filter(Boolean))];

    const [histories, usages, downtimeLogs] = await Promise.all([
      machineIds.length
        ? this.prisma.sparePartReplacementHistory.findMany({
            where: { machineId: { in: machineIds } },
            select: { id: true, replacementAction: true, oldInstalledPartId: true, newInstalledPartId: true },
          })
        : Promise.resolve([]),
      partIds.length
        ? this.prisma.maintenanceExecutionPartUsage.findMany({
            where: { installedPartId: { in: partIds } },
            select: { installedPartId: true, executionId: true },
          })
        : Promise.resolve([]),
      this.prisma.downtimeLog.findMany({
        where: { machineId: { in: machineIds.length ? machineIds : ['__none__'] }, failureCategory: { not: null }, cancelledAt: null },
        select: { id: true, executionId: true, requestId: true },
      }),
    ]);

    const withInstalledAt = (parts as any[]).filter((p) => p.installedAt).length;
    const terminated = (parts as any[]).filter((p) => p.status !== 'ACTIVE');
    const removedWithRemovedAt = terminated.filter((p) => p.removedAt).length;
    const removedMissingRemovedAt = terminated.length - removedWithRemovedAt;
    const withExpectedLife = (parts as any[]).filter((p) => !!p.expectedLifeValue && p.expectedLifeValue > 0).length;
    const withoutExpectedLife = (parts as any[]).length - withExpectedLife;
    const failureClassifiedEvents = (parts as any[]).filter((p) => p.status === 'FAILED').length;

    return {
      installedPartsTotal: (parts as any[]).length,
      withInstalledAt,
      withoutInstalledAt: (parts as any[]).length - withInstalledAt,
      removedWithRemovedAt,
      removedMissingRemovedAt,
      replacementEvents: (histories as any[]).length,
      failureClassifiedEvents,
      preventiveReplacementEvents: (histories as any[]).filter((h) => h.replacementAction === 'RETURNED_REMOVED_PART' || h.replacementAction === 'NO_REMOVED_PART').length,
      withExpectedLife,
      withoutExpectedLife,
      linkedExecutions: (usages as any[]).length,
      linkedClassifiedDowntime: (downtimeLogs as any[]).length,
    };
  }

  async getPopulationDetail(machineId: string, sparePartId: string, ctx: ActiveOperationalContext) {
    await this.assertMachineAccess(machineId, ctx);
    const now = new Date();
    const instances = await this.prisma.machineInstalledPart.findMany({
      where: { machineId, sparePartId, machine: this.machineScope(ctx) },
      include: {
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
    if (!instances.length) throw this.notFound('maintenance.installedPartNotFound', 'No installed-part history for this machine and spare part');

    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
      select: { id: true, code: true, name: true, productionLine: { select: { id: true, code: true, name: true } } },
    });
    const sparePart = await this.prisma.sparePart.findUnique({
      where: { id: sparePartId },
      select: { id: true, code: true, name: true, partNumber: true, manufacturer: true, isCritical: true, unit: true },
    });

    const partIds = (instances as any[]).map((i) => i.id);
    const [histories, usages] = await Promise.all([
      this.prisma.sparePartReplacementHistory.findMany({
        where: { machineId, OR: [{ newSparePartId: sparePartId }, { oldSparePartId: sparePartId }] },
        include: { maintenanceRequest: { select: { id: true, requestNumber: true, title: true } } },
        orderBy: { replacedAt: 'desc' },
      }),
      this.prisma.maintenanceExecutionPartUsage.findMany({
        where: { installedPartId: { in: partIds } },
        include: { execution: { select: { id: true, title: true, status: true, startedAt: true, completedAt: true } } },
        orderBy: { usedAt: 'desc' },
      }),
    ]);

    const timeline = (instances as any[]).map((part) => {
      const serviceLife = computeServiceLifeMs(part, now);
      const expectedLife = computeExpectedLife(part, now);
      const relatedUsage = (usages as any[]).filter((u) => u.installedPartId === part.id);
      const relatedHistory = (histories as any[]).filter((h) => h.oldInstalledPartId === part.id || h.newInstalledPartId === part.id);
      return {
        instance: {
          id: part.id,
          status: part.status,
          installedAt: part.installedAt,
          removedAt: part.removedAt,
          installedCondition: part.installedCondition,
          removedCondition: part.removedCondition ?? null,
          serialNumber: part.serialNumber ?? null,
          installedQuantity: part.installedQuantity,
        },
        serviceLife,
        expectedLife,
        classification: classifyTermination({ status: part.status, linkedFailureCategories: [] }),
        request: part.maintenanceRequest ?? null,
        usages: relatedUsage.map((u) => ({ usageType: u.usageType, usedAt: u.usedAt, execution: u.execution })),
        replacements: relatedHistory.map((h) => ({
          id: h.id,
          replacementNumber: h.replacementNumber,
          replacementAction: h.replacementAction,
          replacedAt: h.replacedAt,
          request: h.maintenanceRequest ?? null,
        })),
      };
    });

    return { machine, sparePart, timeline };
  }
}
