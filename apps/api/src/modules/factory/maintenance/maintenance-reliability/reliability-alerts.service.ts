import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
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
import { QueryReliabilityAlertsDto, PlanningCandidateQueryDto } from './dto/reliability-alert.dto';

const SEVERITY_ORDER: ReliabilityAlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

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
  ) {}

  private notFound(key: string, message: string) {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string) {
    return new BadRequestException({ messageKey: key, message });
  }

  private async deriveForRows(rows: ReliabilityRow[]): Promise<ReliabilityAlert[]> {
    const componentIds = [
      ...new Set(rows.map((r) => r.machineComponent?.id).filter((v): v is string => !!v)),
    ];
    const components = componentIds.length
      ? await this.prisma.machineComponent.findMany({
          where: { id: { in: componentIds } },
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
    const alerts = await this.deriveForRows(rows);
    return this.applyFilters(alerts, query);
  }

  async listAlerts(query: QueryReliabilityAlertsDto, ctx: ActiveOperationalContext) {
    const alerts = await this.buildFilteredAlerts(query, ctx);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;
    return {
      data: alerts.slice(skip, skip + limit),
      meta: { page, limit, total: alerts.length, totalPages: Math.ceil(alerts.length / limit) },
    };
  }

  async getSummary(query: QueryReliabilityAlertsDto, ctx: ActiveOperationalContext) {
    const rows = await this.installedPartReliability.buildRows(query, ctx);
    const alerts = await this.deriveForRows(rows);
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
      where: { machineId: query.machineId, status: 'ACTIVE', type: 'PREVENTIVE' },
      select: { id: true, title: true, type: true, frequency: true, status: true, nextDueDate: true },
      orderBy: { createdAt: 'desc' },
    });

    const installedPartId = query.installedPartId ?? row.current?.id ?? null;
    const sourceReference = [
      `source=reliability-alerts`,
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
}
