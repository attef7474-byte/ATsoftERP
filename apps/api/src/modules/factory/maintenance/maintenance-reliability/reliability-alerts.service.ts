import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CurrentUserType } from '../../../../modules/auth/types/current-user.type';
import { MaintenanceRequestsService } from '../maintenance-requests/maintenance-requests.service';
import { computeExpectedLife, computeServiceLifeMs } from './reliability-calculations';
import { InstalledPartReliabilityService, ReliabilityRow } from './installed-part-reliability.service';
import { ReliabilityAlertThresholdsService } from './reliability-alert-thresholds.service';
import {
  deriveAlerts,
  computeAlertEligibility,
  recommendedActionFor,
  ReliabilityAlert,
  ReliabilityAlertType,
  ReliabilityAlertSeverity,
} from './reliability-alert-calculations';
import {
  AlertByIdQueryDto,
  CreateAlertMaintenanceRequestDto,
  PlanningCandidateQueryDto,
  QueryReliabilityAlertsDto,
} from './dto/reliability-alert.dto';

const SEVERITY_ORDER: ReliabilityAlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Deterministic provenance token. Never trust a client-supplied alert identity. */
export function alertSourceToken(alert: ReliabilityAlert): string {
  return `source=reliability-alerts | alertId=${alert.id}`;
}

/**
 * Reliability alerts + preventive-planning candidate.
 *
 * READ-ONLY. Alerts are DERIVED from the canonical installed-part reliability
 * layer; this service never writes lifecycle, inventory, execution, request or
 * work-order rows. Planning is delegated to the existing canonical PM form
 * (no new write endpoint exists here).
 */
@Injectable()
export class ReliabilityAlertsService {
  constructor(
    private prisma: PrismaService,
    private installedPartReliability: InstalledPartReliabilityService,
    private thresholds: ReliabilityAlertThresholdsService,
    private maintenanceRequests: MaintenanceRequestsService,
    private audit: AuditService,
  ) {}

  /** Single-process, per-alert lock prevents concurrent duplicate request creation. */
  private readonly requestInFlight = new Map<string, Promise<unknown>>();

  private notFound(key: string, message: string) {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string) {
    return new BadRequestException({ messageKey: key, message });
  }

  private async deriveForRows(rows: ReliabilityRow[], ctx: ActiveOperationalContext): Promise<ReliabilityAlert[]> {
    const componentIds = [
      ...new Set(rows.map((r) => r.machineComponent?.id).filter((v): v is string => !!v)),
    ];
    const components = componentIds.length
      ? await this.prisma.machineComponent.findMany({
          where: {
            id: { in: componentIds },
            OR: [
              {
                companyId: ctx.companyId,
                OR: [{ branchId: ctx.branchId }, { branchId: null }],
              },
              // Legacy global components carry no tenant ownership.
              { companyId: null, branchId: null },
            ],
          },
          select: { id: true, criticality: true },
        })
      : [];
    const componentCriticalityById = new Map<string, string>(
      (components as any[]).map((c) => [c.id, c.criticality]),
    );
    const thresholds = await this.thresholds.load();
    return deriveAlerts(rows, { componentCriticalityById, thresholds, referenceDate: new Date() });
  }

  private matchesSearch(a: ReliabilityAlert, needle: string): boolean {
    const hay = [
      a.machine.code, a.machine.name,
      a.machineComponent?.code, a.machineComponent?.name,
      a.sparePart.code, a.sparePart.name, a.sparePart.partNumber,
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(needle);
  }

  private applyFilters(alerts: ReliabilityAlert[], query: QueryReliabilityAlertsDto): ReliabilityAlert[] {
    let out = alerts;
    if (query.alertType) out = out.filter((a) => a.alertType === query.alertType);
    if (query.severity) out = out.filter((a) => a.severity === query.severity);
    if (query.dueState) out = out.filter((a) => a.dueState === query.dueState);
    if (query.isCritical === 'true') out = out.filter((a) => a.criticalitySource !== 'NONE');
    if (query.search && query.search.trim()) {
      const needle = query.search.trim().toLowerCase();
      out = out.filter((a) => this.matchesSearch(a, needle));
    }
    return out;
  }

  private async buildFilteredAlerts(query: QueryReliabilityAlertsDto, ctx: ActiveOperationalContext): Promise<ReliabilityAlert[]> {
    const rows = await this.installedPartReliability.buildRows(query, ctx);
    const alerts = await this.deriveForRows(rows, ctx);
    return this.applyFilters(alerts, query);
  }

  /**
   * Attach derived action status to the current page in two bulk queries.
   * This keeps the grid honest about linked canonical documents without an
   * N+1 lookup per alert.
   */
  private async attachActionStatuses(alerts: ReliabilityAlert[], ctx: ActiveOperationalContext) {
    if (alerts.length === 0) return alerts;
    const prefix = 'source=reliability-alerts | alertId=';
    const machineIds = [...new Set(alerts.map((a) => a.machine.id))];
    const machineScope = this.machineScope(ctx);
    const [requests, schedules] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: {
          machine: machineScope,
          machineId: { in: machineIds },
          deletedAt: null,
          OR: [{ notes: { contains: prefix } }, { description: { contains: prefix } }],
        },
        select: { id: true, requestNumber: true, title: true, status: true, notes: true, description: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.maintenanceSchedule.findMany({
        where: {
          machine: machineScope,
          machineId: { in: machineIds },
          description: { contains: prefix },
        },
        select: { id: true, title: true, status: true, description: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);
    const extractAlertId = (text?: string | null): string | null => {
      const match = text?.match(/alertId=([^ |\r\n]+)/);
      return match?.[1] ?? null;
    };
    const byAlert = new Map<string, { requests: any[]; schedules: any[] }>();
    const push = (alertId: string | null, kind: 'requests' | 'schedules', value: any) => {
      if (!alertId) return;
      const entry = byAlert.get(alertId) ?? { requests: [], schedules: [] };
      entry[kind].push(value);
      byAlert.set(alertId, entry);
    };
    for (const r of requests as any[]) {
      push(extractAlertId(r.notes) ?? extractAlertId(r.description), 'requests', {
        id: r.id, requestNumber: r.requestNumber, title: r.title, status: r.status,
      });
    }
    for (const s of schedules as any[]) {
      push(extractAlertId(s.description), 'schedules', {
        id: s.id, title: s.title, status: s.status,
      });
    }
    return alerts.map((a) => {
      const linked = byAlert.get(a.id) ?? { requests: [], schedules: [] };
      const actionStatus = linked.requests.length > 0 && linked.schedules.length > 0
        ? 'MAINTENANCE_REQUESTED_AND_SCHEDULED'
        : linked.requests.length > 0 ? 'MAINTENANCE_REQUESTED'
          : linked.schedules.length > 0 ? 'SCHEDULED' : 'NO_ACTION';
      return {
        ...a,
        actionStatus,
        linkedRequestNumber: linked.requests[0]?.requestNumber ?? null,
        linkedScheduleTitle: linked.schedules[0]?.title ?? null,
      };
    });
  }

  async listAlerts(query: QueryReliabilityAlertsDto, ctx: ActiveOperationalContext) {
    const alerts = await this.buildFilteredAlerts(query, ctx);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;
    const data = await this.attachActionStatuses(alerts.slice(skip, skip + limit), ctx);
    return {
      data,
      meta: { page, limit, total: alerts.length, totalPages: Math.ceil(alerts.length / limit) },
    };
  }

  async getSummary(query: QueryReliabilityAlertsDto, ctx: ActiveOperationalContext) {
    const rows = await this.installedPartReliability.buildRows(query, ctx);
    const alerts = await this.deriveForRows(rows, ctx);
    const thresholds = await this.thresholds.load();
    const eligibility = computeAlertEligibility(rows, thresholds);

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const a of alerts) {
      byType[a.alertType] = (byType[a.alertType] ?? 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
    }

    return {
      totalAlerts: alerts.length,
      byType,
      bySeverity,
      approaching: alerts.filter((a) => a.alertType === 'LIFE_APPROACHING_DUE').length,
      due: alerts.filter((a) => a.alertType === 'LIFE_DUE').length,
      overdue: alerts.filter((a) => a.alertType === 'LIFE_OVERDUE').length,
      repeatedPrematureFailure: alerts.filter((a) => a.alertType === 'REPEATED_PREMATURE_FAILURE').length,
      highReplacementFrequency: alerts.filter((a) => a.alertType === 'HIGH_REPLACEMENT_FREQUENCY').length,
      criticalAlerts: alerts.filter((a) => a.severity === 'CRITICAL').length,
      eligibility,
      hasAnyEligibleSignal: alerts.length > 0,
    };
  }

  async getDataQuality(query: QueryReliabilityAlertsDto, ctx: ActiveOperationalContext) {
    const rows = await this.installedPartReliability.buildRows(query, ctx);
    const thresholds = await this.thresholds.load();
    const eligibility = computeAlertEligibility(rows, thresholds);

    const reasons: string[] = [];
    if (eligibility.populations === 0) reasons.push('NO_POPULATIONS');
    if (eligibility.activeInstances === 0 && eligibility.populations > 0) reasons.push('NO_ACTIVE_INSTANCES');
    if (eligibility.unknownExpectedLife > 0) reasons.push('EXPECTED_LIFE_UNKNOWN');
    if (!eligibility.replacementFrequencyThresholdConfigured) reasons.push('REPLACEMENT_FREQUENCY_THRESHOLD_NOT_CONFIGURED');

    return {
      ...eligibility,
      notEligibleReasons: reasons,
      // honesty markers
      lifeAlertDataAvailable: eligibility.activeInstances > 0,
      repeatedFailureDataAvailable: eligibility.prematureFailurePopulations > 0,
    };
  }

  /**
   * Planning candidate (§32/§33/§35/§50). Read-only: returns the recommended
   * action/date and a prefill for the existing canonical preventive form, plus
   * any existing open preventive plan for the same machine (§34 detection).
   */
  async getPlanningCandidate(query: PlanningCandidateQueryDto, ctx: ActiveOperationalContext) {
    if (!query.machineId || !query.sparePartId) {
      throw this.badRequest('maintenance.alert.machineAndPartRequired', 'machineId and sparePartId are required');
    }
    const rows = await this.installedPartReliability.buildRows(
      { machineId: query.machineId, sparePartId: query.sparePartId, machineComponentId: query.machineComponentId },
      ctx,
    );
    const row = rows.find((r) => r.sparePart.id === query.sparePartId);
    if (!row) throw this.notFound('maintenance.installedPartNotFound', 'No installed-part history for this machine and spare part');

    const alertType: ReliabilityAlertType = (query.alertType as ReliabilityAlertType) || 'LIFE_DUE';
    const recommendedAction = recommendedActionFor(alertType);
    const recommendedDate = row.current?.expectedLife.expectedExpiryDate
      ? row.current.expectedLife.expectedExpiryDate.toISOString()
      : null;

    const existingOpenPlans = await this.prisma.maintenanceSchedule.findMany({
      where: {
        machine: this.machineScope(ctx),
        machineId: query.machineId,
        status: 'ACTIVE',
        type: 'PREVENTIVE',
      },
      select: { id: true, title: true, type: true, frequency: true, status: true, nextDueDate: true },
      orderBy: { createdAt: 'desc' },
    });

    let installedPartId = row.current?.id ?? null;
    if (query.installedPartId) {
      const scopedPart = await this.prisma.machineInstalledPart.findFirst({
        where: {
          id: query.installedPartId,
          machine: this.machineScope(ctx),
          sparePartId: query.sparePartId,
        },
        select: { id: true },
      });
      if (!scopedPart) {
        throw this.notFound('maintenance.installedPartNotFound', 'Installed part not found in this machine and part population');
      }
      installedPartId = scopedPart.id;
    }
    let sourceToken = '';
    if (query.alertId) {
      const alert = (await this.buildFilteredAlerts({}, ctx)).find((a) => a.id === query.alertId);
      if (!alert || alert.machine.id !== query.machineId || alert.sparePart.id !== query.sparePartId) {
        throw this.notFound('maintenance.reliabilityAlertNotFound', 'Reliability alert not found');
      }
      sourceToken = alertSourceToken(alert);
    }
    const sourceReference = [
      sourceToken || 'source=reliability-alerts',
      `alertType=${alertType}`,
      `machine=${row.machine.code}`,
      `sparePart=${row.sparePart.code}`,
      `installedPart=${installedPartId ?? '-'}`,
    ].join(' | ');

    const suggestedTitle = `PM · ${row.machine.code} · ${row.sparePart.code}`;

    return {
      machine: row.machine,
      productionLine: row.productionLine,
      machineComponent: row.machineComponent,
      sparePart: row.sparePart,
      alertType,
      alertId: query.alertId ?? null,
      sourceToken,
      recommendedAction,
      recommendedDate,
      sourceReference,
      prefill: {
        machineId: row.machine.id,
        machineComponentId: row.machineComponent?.id ?? null,
        sparePartId: row.sparePart.id,
        type: 'PREVENTIVE',
        title: suggestedTitle,
        description: sourceReference,
        startDate: recommendedDate ? recommendedDate.slice(0, 10) : null,
      },
      existingOpenPlans,
      hasExistingOpenPlan: existingOpenPlans.length > 0,
    };
  }

  /** Resolve an alert id only from alerts derived inside the caller's tenant. */
  private async findAlert(query: AlertByIdQueryDto, ctx: ActiveOperationalContext): Promise<ReliabilityAlert> {
    const alerts = await this.buildFilteredAlerts({}, ctx);
    const alert = alerts.find((a) => a.id === query.alertId);
    if (!alert) {
      throw this.notFound('maintenance.reliabilityAlertNotFound', 'Reliability alert not found');
    }
    return alert;
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }

  /** Action status is derived from real linked documents, not a parallel state table. */
  private async linkedActions(alert: ReliabilityAlert, ctx: ActiveOperationalContext) {
    const token = alertSourceToken(alert);
    const machineScope = this.machineScope(ctx);
    const [requests, schedules] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where: {
          machine: machineScope,
          machineId: alert.machine.id,
          deletedAt: null,
          OR: [{ notes: { contains: token } }, { description: { contains: token } }],
        },
        select: { id: true, requestNumber: true, title: true, status: true, priority: true, type: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.maintenanceSchedule.findMany({
        where: {
          machine: machineScope,
          machineId: alert.machine.id,
          description: { contains: token },
        },
        select: { id: true, title: true, type: true, status: true, startDate: true, nextDueDate: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const status = requests.length > 0 && schedules.length > 0
      ? 'MAINTENANCE_REQUESTED_AND_SCHEDULED'
      : requests.length > 0 ? 'MAINTENANCE_REQUESTED'
        : schedules.length > 0 ? 'SCHEDULED' : 'NO_ACTION';
    return { status, sourceToken: token, requests, schedules };
  }

  async getActionStatus(query: AlertByIdQueryDto, ctx: ActiveOperationalContext) {
    const alert = await this.findAlert(query, ctx);
    return this.linkedActions(alert, ctx);
  }

  /** Full evidence view for one derived alert. Strictly read-only. */
  async getAlertDetail(query: AlertByIdQueryDto, ctx: ActiveOperationalContext) {
    const alert = await this.findAlert(query, ctx);
    const now = new Date();

    const [installedPart, rowResult, failedInstances, replacements, sparePart] = await Promise.all([
      alert.installedPartId
        ? this.prisma.machineInstalledPart.findFirst({
            where: { id: alert.installedPartId, machine: this.machineScope(ctx) },
            include: {
              sparePart: {
                select: {
                  id: true, code: true, name: true, isCritical: true, unit: true,
                  defaultExpectedLifeValue: true, defaultExpectedLifeUnit: true,
                  defaultWarningThresholdPercent: true, productId: true,
                  reorderPoint: true, minRecommendedStock: true,
                },
              },
              readings: {
                select: { id: true, readingType: true, readingValue: true, isReset: true, recordedAt: true, notes: true },
                orderBy: { recordedAt: 'desc' },
                take: 20,
              },
            },
          })
        : Promise.resolve(null),
      this.installedPartReliability.buildRows(
        {
          machineId: alert.machine.id,
          sparePartId: alert.sparePart.id,
          ...(alert.machineComponent?.id ? { machineComponentId: alert.machineComponent.id } : {}),
        },
        ctx,
      ),
      this.prisma.machineInstalledPart.findMany({
        where: {
          machineId: alert.machine.id,
          sparePartId: alert.sparePart.id,
          machine: this.machineScope(ctx),
          status: 'FAILED',
        },
        select: {
          id: true, installedAt: true, removedAt: true, serialNumber: true, batchNumber: true,
          status: true, expectedLifeValue: true, expectedLifeUnit: true, lifeStartDate: true,
          lifeStartReading: true, currentReading: true, warningThresholdPercent: true,
          removedReason: true, maintenanceRequest: { select: { requestNumber: true, title: true, status: true } },
        },
        orderBy: { removedAt: 'desc' },
        take: 20,
      }),
      this.prisma.sparePartReplacementHistory.findMany({
        where: {
          machine: this.machineScope(ctx),
          machineId: alert.machine.id,
          OR: [{ newSparePartId: alert.sparePart.id }, { oldSparePartId: alert.sparePart.id }],
        },
        select: { id: true, replacementNumber: true, replacedAt: true, replacementAction: true },
        orderBy: { replacedAt: 'desc' },
        take: 20,
      }),
      this.prisma.sparePart.findUnique({
        where: { id: alert.sparePart.id },
        select: { productId: true, reorderPoint: true, minRecommendedStock: true },
      }),
    ]);

    const row = rowResult.find((r) => r.sparePart.id === alert.sparePart.id);
    const failureHistory = (failedInstances as any[]).map((p) => {
      const lifecycle = {
        status: p.status, installedAt: p.installedAt, removedAt: p.removedAt,
        expectedLifeValue: p.expectedLifeValue, expectedLifeUnit: p.expectedLifeUnit,
        lifeStartDate: p.lifeStartDate, lifeStartReading: p.lifeStartReading,
        currentReading: p.currentReading, warningThresholdPercent: p.warningThresholdPercent,
      };
      const serviceLife = computeServiceLifeMs(lifecycle, now);
      const expectedLife = computeExpectedLife(lifecycle, now);
      return {
        installedPartId: p.id,
        installedAt: p.installedAt ? p.installedAt.toISOString() : null,
        removedAt: p.removedAt ? p.removedAt.toISOString() : null,
        serialNumber: p.serialNumber ?? null,
        batchNumber: p.batchNumber ?? null,
        serviceLifeMs: serviceLife.state === 'OK' ? serviceLife.ms : null,
        expectedLifeValue: expectedLife.configured ? p.expectedLifeValue : null,
        expectedLifeUnit: expectedLife.configured ? p.expectedLifeUnit : null,
        achievedPercent: expectedLife.unit === 'DAYS' && expectedLife.totalMs && serviceLife.ms !== null
          ? Math.round((serviceLife.ms / expectedLife.totalMs) * 10000) / 100
          : null,
        removedReason: p.removedReason ?? null,
        request: p.maintenanceRequest ?? null,
      };
    });

    const balances = sparePart?.productId
      ? await this.prisma.inventoryBalance.findMany({
          where: {
            productId: sparePart.productId,
            warehouse: {
              companyId: ctx.companyId,
              OR: [{ branchId: ctx.branchId }, { branchId: null }],
              deletedAt: null,
            },
          },
          select: {
            quantity: true,
            warehouse: { select: { id: true, code: true, name: true, branchId: true } },
          },
          orderBy: { warehouse: { code: 'asc' } },
        })
      : [];
    const byWarehouse = new Map<string, { warehouseId: string; code: string; name: string; branchId: string | null; quantity: number }>();
    for (const b of balances as any[]) {
      const entry = byWarehouse.get(b.warehouse.id) ?? {
        warehouseId: b.warehouse.id,
        code: b.warehouse.code,
        name: b.warehouse.name,
        branchId: b.warehouse.branchId ?? null,
        quantity: 0,
      };
      entry.quantity += b.quantity;
      byWarehouse.set(b.warehouse.id, entry);
    }
    const warehouses = [...byWarehouse.values()];
    const totalAvailable = warehouses.reduce((s, w) => s + w.quantity, 0);
    const reorderPoint = sparePart?.reorderPoint ?? null;
    const stock = {
      productId: sparePart?.productId ?? null,
      reorderPoint,
      minRecommendedStock: sparePart?.minRecommendedStock ?? null,
      warehouses,
      totalAvailable,
      belowReorderPoint: reorderPoint !== null && totalAvailable < reorderPoint,
    };

    const readingCount = installedPart
      ? await this.prisma.machineInstalledPartReading.count({ where: { installedPartId: installedPart.id } })
      : 0;

    return {
      alert,
      standardLife: {
        value: alert.standardExpectedLifeValue,
        unit: alert.standardExpectedLifeUnit,
        warningThresholdPercent: alert.standardWarningThresholdPercent,
      },
      appliedLife: {
        value: alert.expectedLifeValue,
        unit: alert.expectedLifeUnit,
        warningThresholdPercent: installedPart?.warningThresholdPercent ?? null,
        lifeStartReading: alert.lifeStartReading,
        currentReading: alert.currentReading,
        lifeStartDate: installedPart?.lifeStartDate ? installedPart.lifeStartDate.toISOString() : alert.installedAt,
        expectedDueAt: alert.expectedDueAt,
        expectedDueReading: alert.expectedDueReading,
        remainingMs: alert.remainingMs,
        remainingReading: alert.remainingReading,
        serialNumber: alert.serialNumber,
        batchNumber: alert.batchNumber,
      },
      readings: installedPart?.readings ?? [],
      readingCount,
      failureHistory,
      failureSummary: {
        failureEventCount: row?.failureEventCount ?? alert.failureEventCount,
        prematureFailureCount: row?.prematureFailureCount ?? alert.prematureFailureCount,
        repeatedEarlyFailure: row?.repeatedEarlyFailure ?? false,
        replacementCount: row?.replacementCount ?? alert.replacementCount,
      },
      replacements,
      actions: await this.linkedActions(alert, ctx),
      stock,
    };
  }

  /**
   * Create a canonical MaintenanceRequest from an alert. Never auto-submits or
   * auto-approves; duplicate clicks return the existing linked request.
   */
  async createMaintenanceRequestFromAlert(
    dto: CreateAlertMaintenanceRequestDto,
    user: CurrentUserType,
    ctx: ActiveOperationalContext,
  ) {
    const alert = await this.findAlert(dto, ctx);
    const existing = await this.linkedActions(alert, ctx);
    if (existing.requests.length > 0) {
      return { created: false, alertId: alert.id, sourceToken: existing.sourceToken, request: existing.requests[0] };
    }
    const token = existing.sourceToken;
    const pending = this.requestInFlight.get(token);
    if (pending) return pending as any;

    const task = (async () => {
      const again = await this.linkedActions(alert, ctx);
      if (again.requests.length > 0) {
        return { created: false, alertId: alert.id, sourceToken: token, request: again.requests[0] };
      }
      const priority = alert.severity === 'CRITICAL' ? 'URGENT'
        : alert.severity === 'HIGH' ? 'HIGH'
          : alert.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW';
      const type = dto.type ?? (alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'CORRECTIVE' : 'PREVENTIVE');
      const humanText = dto.description?.trim()
        || `${dto.title?.trim() ? `${dto.title.trim()} — ` : ''}${alert.machine.code} · ${alert.sparePart.code}`;
      const created = await this.maintenanceRequests.create({
        machineId: alert.machine.id,
        machineComponentId: alert.machineComponent?.id ?? undefined,
        productionLineId: alert.productionLine?.id ?? undefined,
        type,
        priority,
        // The token is provenance, not user-facing copy. Canonical request
        // creation derives the title from description, so keep it human-readable.
        description: humanText,
        notes: [token, dto.note?.trim()].filter(Boolean).join(' | '),
        requiredParts: [{
          sparePartId: alert.sparePart.id,
          machineComponentId: alert.machineComponent?.id ?? undefined,
          machineId: alert.machine.id,
          quantity: 1,
          ...(alert.sparePart.unit ? { unit: alert.sparePart.unit } : {}),
          usageNote: token,
          isPrimary: true,
        }],
      } as any, user, ctx);

      await this.audit.log(
        user.id,
        'CREATE_MAINTENANCE_REQUEST_FROM_ALERT',
        'MaintenanceRequest',
        created.id,
        JSON.stringify({ alertId: alert.id, alertType: alert.alertType, severity: alert.severity, sourceToken: token }),
      );

      return {
        created: true,
        alertId: alert.id,
        sourceToken: token,
        request: {
          id: created.id,
          requestNumber: created.requestNumber,
          title: created.title,
          status: created.status,
          priority: created.priority,
          type: created.type,
        },
      };
    })();

    this.requestInFlight.set(token, task);
    try {
      return await task;
    } finally {
      this.requestInFlight.delete(token);
    }
  }
}
