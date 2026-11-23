import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceContextService } from '../context/performance-context.service';
import { PreviewPerformanceKpiDto } from '../dto/preview-performance-kpi.dto';
import { KpiPreviewStatus } from '../kpis/performance-kpi.constants';
import { aggregateFactor, availabilityFactor, computeFactor, decimal, idealRatePerHour, oeeProduct, performanceFactor, qualityFactor } from '../../factory/production-analytics/oee-formula.util';
import { clampToPeriod, intersectionMinutes, mergeIntervals, totalDurationMinutes } from '../../factory/production-analytics/downtime-union.util';
import { deriveRunTotals } from '../../factory/production-runs/production-runs.util';

type Evidence = { sourceType: string; sourceId: string; sourceNumber?: string | null; occurredAt?: string | null; contribution?: any; context?: any };

export interface PreviewResult {
  employee: any; performanceProfile: any; kpi: any; period: { from: string; to: string };
  status: KpiPreviewStatus; rawValue: number | null; unit: string; direction: string;
  numerator: number | null; denominator: number | null; evidenceCount: number; evidence: Evidence[];
  excluded: { count: number; reasons: Record<string, number> }; dataQuality: { issues: string[]; notes: string[] };
  calculationVersion: number; explanation: string;
}

@Injectable()
export class PerformanceKpiPreviewService {
  constructor(private prisma: PrismaService, private contextService: PerformanceContextService) {}

  private bad(field: string, code: string, message: string) {
    return new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: [{ field, code, message }] });
  }

  private round(n: number, digits = 4) { return Number(n.toFixed(digits)); }

  private window(dto: PreviewPerformanceKpiDto) {
    const from = new Date(dto.dateFrom);
    const to = new Date(dto.dateTo);
    if (Number.isNaN(from.getTime())) throw this.bad('dateFrom', 'validation.invalidDate', 'Invalid dateFrom');
    if (Number.isNaN(to.getTime())) throw this.bad('dateTo', 'validation.invalidDate', 'Invalid dateTo');
    if (from >= to) throw this.bad('dateFrom', 'validation.invalidRange', 'dateFrom must be before dateTo');
    const days = (to.getTime() - from.getTime()) / 86400000;
    if (days > 366) throw this.bad('dateTo', 'validation.invalidRange', 'Preview window must not exceed 366 days');
    return { from, to };
  }

  private baseResult(employee: any, profile: any, kpi: any, from: Date, to: Date, status: KpiPreviewStatus, explanation: string, extra: Partial<PreviewResult> = {}): PreviewResult {
    return {
      employee, performanceProfile: profile, kpi: { id: kpi.id, code: kpi.code, name: kpi.name, nameAr: kpi.nameAr, nameEn: kpi.nameEn, domain: kpi.domain, measurementUnit: kpi.measurementUnit, direction: kpi.direction, aggregationType: kpi.aggregationType, calculationMode: kpi.calculationMode, sourceContractKey: kpi.sourceContractKey },
      period: { from: from.toISOString(), to: to.toISOString() },
      status, rawValue: null, unit: kpi.measurementUnit, direction: kpi.direction,
      numerator: null, denominator: null, evidenceCount: 0, evidence: [],
      excluded: { count: 0, reasons: {} }, dataQuality: { issues: [], notes: [] },
      calculationVersion: kpi.calculationVersion ?? 1, explanation, ...extra,
    };
  }

  private async getKpi(companyId: string, code: string) {
    const kpi = await this.prisma.performanceKpiDefinition.findFirst({ where: { companyId, code: code.trim().toUpperCase(), deletedAt: null } });
    if (!kpi) throw new NotFoundException({ messageKey: 'performance.kpiNotFound', message: 'KPI definition not found' });
    return kpi;
  }

  private async isEligible(profileId: string | null, kpiId: string, companyId: string, at: Date) {
    if (!profileId) return false;
    const row = await this.prisma.performanceProfileKpiEligibility.findFirst({ where: { companyId, performanceProfileId: profileId, kpiDefinitionId: kpiId, deletedAt: null, isEnabled: true, AND: [ { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: at } }] }, { OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] } ] } });
    return !!row;
  }

  async preview(dto: PreviewPerformanceKpiDto, ctx: ActiveOperationalContext) {
    const { from, to } = this.window(dto);
    const evidenceLimit = Math.min(200, Math.max(1, dto.evidenceLimit ?? 20));
    const personCtx = await this.contextService.resolve(dto.operationalPersonId, ctx, to);
    const kpi = await this.getKpi(ctx.companyId, dto.kpiCode);
    const employee = personCtx.employee;
    const profile = personCtx.performanceProfile;

    if (!kpi.isActive || kpi.status !== 'ACTIVE') {
      return this.baseResult(employee, profile, kpi, from, to, 'CONFIGURATION_MISSING', 'KPI is not active.');
    }

    const eligible = await this.isEligible(profile?.id ?? null, kpi.id, ctx.companyId, to);
    if (!eligible) {
      return this.baseResult(employee, profile, kpi, from, to, 'NOT_APPLICABLE', 'KPI is not eligible for the employee performance profile in this period.', { dataQuality: { issues: ['notEligibleForProfile'], notes: ['Assign KPI eligibility to the resolved performance profile to enable calculation.'] } });
    }

    const handler = this.handlers()[kpi.code];
    if (!handler) {
      return this.baseResult(employee, profile, kpi, from, to, 'SOURCE_UNAVAILABLE', 'No source adapter is registered for this KPI code.', { dataQuality: { issues: ['sourceAdapterMissing'], notes: [`sourceContractKey=${kpi.sourceContractKey}`] } });
    }

    const result = await handler({ dto, ctx, from, to, employee, profile, kpi, personCtx, evidenceLimit });
    // cap evidence
    if (result.evidence.length > evidenceLimit) result.evidence = result.evidence.slice(0, evidenceLimit);
    return result;
  }

  private handlers(): Record<string, (args: any) => Promise<PreviewResult>> {
    return {
      MAINT_RESPONSE_TIME_AVG: (a) => this.maintResponseTime(a),
      MAINT_REPAIR_TIME_AVG: (a) => this.maintRepairTime(a),
      MAINT_REPEAT_FAILURE_RATE: (a) => this.maintRepeatFailureRate(a),
      PROD_OUTPUT_TOTAL: (a) => this.prodOutput(a, 'TOTAL'),
      PROD_GOOD_OUTPUT: (a) => this.prodOutput(a, 'GOOD'),
      PROD_REJECT_RATE: (a) => this.prodRejectRate(a),
      PROD_WASTE_RATE: (a) => this.prodWasteRate(a),
      PROD_OEE: (a) => this.prodOeeFactor(a, 'OEE'),
      PROD_AVAILABILITY: (a) => this.prodOeeFactor(a, 'AVAILABILITY'),
      PROD_PERFORMANCE: (a) => this.prodOeeFactor(a, 'PERFORMANCE'),
      PROD_QUALITY: (a) => this.prodOeeFactor(a, 'QUALITY'),
    };
  }

  private async resolveMaintenanceExecutorUserIds(personnelId: string | null, operationalPersonId: string) {
    // Best-effort: link operational person through maintenancePersonnel -> no direct userId on personnel; execution sessions use technicianUserId.
    // We cannot safely attribute DowntimeLog execution to OperationalPerson unless we can map to a user. Return empty to force ambiguity/insufficient.
    return { userIds: [] as string[], personnelId };
  }

  private async maintResponseTime({ ctx, from, to, employee, profile, kpi, personCtx, evidenceLimit }: any): Promise<PreviewResult> {
    const base = this.baseResult(employee, profile, kpi, from, to, 'INSUFFICIENT_DATA', 'No calculable response-time evidence for this employee in the selected period.');
    // Attribution path: execution sessions of the linked maintenance task performed by a user mapped from the operational person? OperationalPerson has userId.
    const person = await this.prisma.operationalPerson.findFirst({ where: { id: employee.id }, select: { userId: true } });
    const userId = person?.userId;
    if (!userId) {
      base.status = 'ATTRIBUTION_AMBIGUOUS';
      base.explanation = 'Employee has no linked user identity for maintenance execution attribution; response time cannot be safely attributed.';
      base.dataQuality.issues.push('missingUserLink');
      return base;
    }

    const logs = await this.prisma.downtimeLog.findMany({
      where: {
        cancelledAt: null, corrections: { none: {} },
        machine: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] },
        startTime: { gte: from, lte: to },
        detectedAt: { not: null },
        execution: { sessions: { some: { technicianUserId: userId } } },
      },
      select: { id: true, startTime: true, detectedAt: true, responseStartedAt: true, machine: { select: { code: true, name: true } }, requestId: true, executionId: true, execution: { select: { sessions: { select: { technicianUserId: true } } } } },
      orderBy: { startTime: 'asc' },
      take: 500,
    });

    const excludedReasons: Record<string, number> = {};
    const values: number[] = [];
    const evidence: Evidence[] = [];
    for (const log of logs) {
      if (!log.detectedAt || !log.responseStartedAt) { excludedReasons['missingTimestamps'] = (excludedReasons['missingTimestamps'] || 0) + 1; continue; }
      const rawMinutes = (log.responseStartedAt.getTime() - log.detectedAt.getTime()) / 60000;
      if (rawMinutes <= 0) { excludedReasons['nonPositiveResponseTime'] = (excludedReasons['nonPositiveResponseTime'] || 0) + 1; continue; }
      const techs = new Set(((log as any).execution?.sessions || []).map((s: any) => s.technicianUserId).filter(Boolean));
      const split = Math.max(1, techs.size);
      const minutes = rawMinutes / split;
      if (split > 1) excludedReasons['splitAcrossTechnicians'] = (excludedReasons['splitAcrossTechnicians'] || 0) + 1;
      values.push(minutes);
      if (evidence.length < evidenceLimit) evidence.push({ sourceType: 'DowntimeLog', sourceId: log.id, occurredAt: log.startTime.toISOString(), contribution: { responseMinutes: this.round(minutes, 2), rawResponseMinutes: this.round(rawMinutes, 2), technicianCount: split }, context: { machine: log.machine?.code, requestId: log.requestId, executionId: log.executionId } });
    }
    base.excluded = { count: Object.values(excludedReasons).reduce((a,b)=>a+b,0), reasons: excludedReasons };
    base.evidence = evidence;
    base.evidenceCount = values.length;
    if (values.length === 0) {
      base.status = 'INSUFFICIENT_DATA';
      base.explanation = 'No eligible response-time events with direct execution attribution were found.';
      if (logs.length === 0) base.dataQuality.issues.push('noAttributedEvents');
      return base;
    }
    const avg = values.reduce((a,b)=>a+b,0) / values.length;
    base.status = 'CALCULABLE';
    base.rawValue = this.round(avg, 2);
    base.numerator = this.round(values.reduce((a,b)=>a+b,0), 2);
    base.denominator = values.length;
    base.explanation = `${values.length} eligible downtime events attributed by direct execution session. Average response time = ${base.rawValue} minutes.`;
    return base;
  }

  private async maintRepairTime({ ctx, from, to, employee, profile, kpi, evidenceLimit }: any): Promise<PreviewResult> {
    const base = this.baseResult(employee, profile, kpi, from, to, 'INSUFFICIENT_DATA', 'No calculable repair-time evidence for this employee in the selected period.');
    const person = await this.prisma.operationalPerson.findFirst({ where: { id: employee.id }, select: { userId: true } });
    const userId = person?.userId;
    if (!userId) {
      base.status = 'ATTRIBUTION_AMBIGUOUS';
      base.explanation = 'Employee has no linked user identity for maintenance execution attribution; repair time cannot be safely attributed.';
      base.dataQuality.issues.push('missingUserLink');
      return base;
    }
    const logs = await this.prisma.downtimeLog.findMany({
      where: {
        cancelledAt: null, corrections: { none: {} },
        machine: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] },
        startTime: { gte: from, lte: to },
        OR: [{ repairStartedAt: { not: null } }, { repairCompletedAt: { not: null } }],
        execution: { sessions: { some: { technicianUserId: userId } } },
      },
      select: { id: true, startTime: true, repairStartedAt: true, repairCompletedAt: true, machine: { select: { code: true, name: true } }, requestId: true, executionId: true, execution: { select: { sessions: { select: { technicianUserId: true } } } } },
      orderBy: { startTime: 'asc' }, take: 500,
    });
    const excludedReasons: Record<string, number> = {};
    const values: number[] = [];
    const evidence: Evidence[] = [];
    for (const log of logs) {
      if (!log.repairStartedAt || !log.repairCompletedAt) { excludedReasons['missingTimestamps'] = (excludedReasons['missingTimestamps'] || 0) + 1; continue; }
      const rawMinutes = (log.repairCompletedAt.getTime() - log.repairStartedAt.getTime()) / 60000;
      if (rawMinutes <= 0) { excludedReasons['nonPositiveRepairTime'] = (excludedReasons['nonPositiveRepairTime'] || 0) + 1; continue; }
      const techs = new Set(((log as any).execution?.sessions || []).map((s: any) => s.technicianUserId).filter(Boolean));
      const split = Math.max(1, techs.size);
      const minutes = rawMinutes / split;
      if (split > 1) excludedReasons['splitAcrossTechnicians'] = (excludedReasons['splitAcrossTechnicians'] || 0) + 1;
      values.push(minutes);
      if (evidence.length < evidenceLimit) evidence.push({ sourceType: 'DowntimeLog', sourceId: log.id, occurredAt: log.startTime.toISOString(), contribution: { repairMinutes: this.round(minutes, 2), rawRepairMinutes: this.round(rawMinutes, 2), technicianCount: split }, context: { machine: log.machine?.code, requestId: log.requestId, executionId: log.executionId } });
    }
    base.excluded = { count: Object.values(excludedReasons).reduce((a,b)=>a+b,0), reasons: excludedReasons };
    base.evidence = evidence;
    base.evidenceCount = values.length;
    if (values.length === 0) { base.dataQuality.issues.push('noAttributedEvents'); return base; }
    const avg = values.reduce((a,b)=>a+b,0) / values.length;
    base.status = 'CALCULABLE';
    base.rawValue = this.round(avg, 2);
    base.numerator = this.round(values.reduce((a,b)=>a+b,0), 2);
    base.denominator = values.length;
    base.explanation = `${values.length} eligible downtime events attributed by direct execution session. Average repair time = ${base.rawValue} minutes.`;
    return base;
  }

  private async maintRepeatFailureRate({ ctx, from, to, employee, profile, kpi, evidenceLimit }: any): Promise<PreviewResult> {
    const base = this.baseResult(employee, profile, kpi, from, to, 'INSUFFICIENT_DATA', 'No eligible responsible-asset repeat-failure evidence in the selected period.');
    // Responsibility-scope attribution via MachineResponsibilityAssignment
    const personnel = await this.prisma.maintenancePersonnel.findFirst({ where: { operationalPersonId: employee.id, isActive: true }, select: { id: true } });
    if (!personnel) {
      base.status = 'NOT_APPLICABLE';
      base.explanation = 'Employee is not an active maintenance personnel record; responsible-asset repeat failure rate is not applicable.';
      base.dataQuality.issues.push('noMaintenancePersonnel');
      return base;
    }
    const responsibilities = await this.prisma.machineResponsibilityAssignment.findMany({
      where: { maintenancePersonnelId: personnel.id, status: 'ACTIVE', startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gt: from } }] },
      select: { id: true, machineId: true, startDate: true, endDate: true },
    });
    const machineIds = [...new Set(responsibilities.map(r => r.machineId).filter(Boolean))] as string[];
    if (machineIds.length === 0) {
      base.status = 'INSUFFICIENT_DATA';
      base.explanation = 'No active machine responsibility assignments overlap the selected period.';
      base.dataQuality.issues.push('noResponsibleMachines');
      return base;
    }
    const logs = await this.prisma.downtimeLog.findMany({
      where: { cancelledAt: null, corrections: { none: {} }, machineId: { in: machineIds }, machine: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] }, startTime: { gte: from, lte: to } },
      select: { id: true, machineId: true, startTime: true, isRepeatFailure: true, reason: true },
      orderBy: { startTime: 'asc' }, take: 1000,
    });
    // filter by responsibility window per log
    const excludedReasons: Record<string, number> = {};
    let total = 0; let repeat = 0;
    const evidence: Evidence[] = [];
    for (const log of logs) {
      const covered = responsibilities.some(r => r.machineId === log.machineId && r.startDate <= log.startTime && (!r.endDate || r.endDate > log.startTime));
      if (!covered) { excludedReasons['outsideResponsibilityWindow'] = (excludedReasons['outsideResponsibilityWindow'] || 0) + 1; continue; }
      total += 1;
      const isRepeat = log.isRepeatFailure === true;
      if (isRepeat) repeat += 1;
      if (evidence.length < evidenceLimit) evidence.push({ sourceType: 'DowntimeLog', sourceId: log.id, occurredAt: log.startTime.toISOString(), contribution: { isRepeatFailure: isRepeat }, context: { machineId: log.machineId } });
    }
    base.excluded = { count: Object.values(excludedReasons).reduce((a,b)=>a+b,0), reasons: excludedReasons };
    base.evidence = evidence;
    base.evidenceCount = total;
    base.dataQuality.notes.push('Responsibility-scope KPI: attributed through active MachineResponsibilityAssignment, not direct repair execution.');
    if (total === 0) {
      base.status = 'INSUFFICIENT_DATA';
      base.explanation = 'No eligible downtime events fell within active machine responsibility windows.';
      return base;
    }
    base.status = 'CALCULABLE';
    base.numerator = repeat;
    base.denominator = total;
    base.rawValue = this.round((repeat / total) * 100, 2);
    base.explanation = `${repeat} repeat-failure events out of ${total} eligible responsible-asset downtime events. Repeat failure rate = ${base.rawValue}%.`;
    return base;
  }

  private async loadRunsForPerson(ctx: ActiveOperationalContext, employeeId: string, from: Date, to: Date) {
    return this.prisma.productionRun.findMany({
      where: {
        companyId: ctx.companyId, branchId: ctx.branchId,
        operationalPersonId: employeeId,
        OR: [
          { startedAt: { gte: from, lte: to } },
          { endedAt: { gte: from, lte: to } },
          { startedAt: { lte: from }, endedAt: { gte: from } },
        ],
      },
      include: {
        productionOrder: { select: { id: true, orderNumber: true } },
        productionUnit: { select: { id: true, code: true } },
        productionLine: { select: { id: true, code: true, name: true } },
        machine: { select: { id: true, code: true, name: true } },
        sessions: { select: { startedAt: true, closedAt: true } },
        downtimeSegments: { select: { id: true, startedAt: true, endedAt: true, planned: true, status: true } },
        outputEvents: { select: { id: true, occurredAt: true, eventType: true, classification: true, quantity: true, goodQuantity: true, rejectQuantity: true, correctsEventId: true, measurementPointId: true, measurementPoint: { select: { isAuthoritativeFinal: true } } } },
      },
      orderBy: { startedAt: 'asc' },
      take: 500,
    });
  }

  private runWindow(run: any, from: Date, to: Date) {
    const start = run.startedAt ?? from;
    const end = run.endedAt ?? to;
    return { start, end };
  }

  private computeRunMetrics(run: any, window: { from: Date; to: Date }) {
    const runStart = run.startedAt ?? window.from;
    const runEnd = run.endedAt;
    const active = !runEnd;
    const clampTime = (date: Date, f: Date, t: Date) => new Date(Math.min(Math.max(date.getTime(), f.getTime()), t.getTime()));
    const maxDate = (...dates: Array<Date | null | undefined>) => dates.filter((d): d is Date => Boolean(d)).reduce((m, d) => d.getTime() > m.getTime() ? d : m, new Date(0));
    const minDate = (...dates: Array<Date | null | undefined>) => dates.filter((d): d is Date => Boolean(d)).reduce((m, d) => d.getTime() < m.getTime() ? d : m, new Date(8640000000000000));

    const sessionIntervals = (run.sessions || []).map((s: any) => {
      const start = clampTime(maxDate(s.startedAt, runStart, window.from), window.from, window.to);
      const end = clampTime(minDate(s.closedAt ?? (active ? window.to : runEnd), runEnd ?? window.to, window.to), window.from, window.to);
      if (start.getTime() >= end.getTime()) return null;
      return { start, end };
    }).filter(Boolean);
    const mergedSessions = mergeIntervals(sessionIntervals as any);
    const plannedMinutes = new Prisma.Decimal(totalDurationMinutes(mergedSessions as any)).toDecimalPlaces(4);
    const rawSegments = (run.downtimeSegments || []).filter((s: any) => s.status !== 'CANCELLED' && s.status !== 'SUPERSEDED');
    const unplannedIntervals: any[] = []; const plannedIntervals: any[] = [];
    for (const seg of rawSegments) {
      const clamped = clampToPeriod([{ start: seg.startedAt, end: seg.endedAt ?? runEnd ?? window.to }], window.from, window.to);
      if (seg.planned) plannedIntervals.push(...clamped); else unplannedIntervals.push(...clamped);
    }
    const unplannedDowntimeMinutes = new Prisma.Decimal(intersectionMinutes(unplannedIntervals, mergedSessions as any)).toDecimalPlaces(4);
    const operatingMinutes = Prisma.Decimal.max(0, plannedMinutes.minus(unplannedDowntimeMinutes)).toDecimalPlaces(4);
    const rate = idealRatePerHour(run.standardRateSnapshot, run.timeBasisSnapshot);
    const idealOutput = rate.mul(operatingMinutes.div(60)).toDecimalPlaces(4);
    const events = (run.outputEvents || []).map((e: any) => ({ id: e.id, occurredAt: e.occurredAt, eventType: e.eventType, classification: e.classification, quantity: e.quantity, goodQuantity: e.goodQuantity, rejectQuantity: e.rejectQuantity, correctsEventId: e.correctsEventId ?? null, measurementPointId: e.measurementPointId, measurementPoint: e.measurementPoint ? { isAuthoritativeFinal: Boolean(e.measurementPoint.isAuthoritativeFinal) } : null }));
    const totals = deriveRunTotals(events as any, window);
    const totalOutput = new Prisma.Decimal(totals.finalOutputTotal);
    const goodOutput = new Prisma.Decimal(totals.finalOutputGood);
    const rejectOutput = new Prisma.Decimal(totals.finalOutputReject);
    const availability = availabilityFactor(plannedMinutes, operatingMinutes);
    const performance = performanceFactor(idealOutput, totalOutput);
    const quality = qualityFactor(goodOutput, totalOutput);
    const oee = oeeProduct(availability, performance, quality);
    return { plannedMinutes, unplannedDowntimeMinutes, operatingMinutes, idealOutput, totalOutput, goodOutput, rejectOutput, availability, performance, quality, oee };
  }

  private async prodOeeFactor({ ctx, from, to, employee, profile, kpi, evidenceLimit }: any, kind: 'OEE' | 'AVAILABILITY' | 'PERFORMANCE' | 'QUALITY'): Promise<PreviewResult> {
    const base = this.baseResult(employee, profile, kpi, from, to, 'INSUFFICIENT_DATA', `No eligible production runs attributed to this employee in the selected period.`);
    const runs = await this.loadRunsForPerson(ctx, employee.id, from, to);
    if (runs.length === 0) { base.dataQuality.issues.push('noAttributedRuns'); return base; }
    let planned = new Prisma.Decimal(0), operating = new Prisma.Decimal(0), total = new Prisma.Decimal(0), good = new Prisma.Decimal(0), ideal = new Prisma.Decimal(0);
    const evidence: Evidence[] = [];
    const excludedReasons: Record<string, number> = {};
    for (const run of runs) {
      const m = this.computeRunMetrics(run, { from, to });
      planned = planned.plus(m.plannedMinutes); operating = operating.plus(m.operatingMinutes); total = total.plus(m.totalOutput); good = good.plus(m.goodOutput); ideal = ideal.plus(m.idealOutput);
      if (evidence.length < evidenceLimit) evidence.push({ sourceType: 'ProductionRun', sourceId: run.id, sourceNumber: run.runNumber, occurredAt: run.startedAt?.toISOString() ?? null, contribution: { plannedMinutes: m.plannedMinutes.toString(), operatingMinutes: m.operatingMinutes.toString(), totalOutput: m.totalOutput.toString(), goodOutput: m.goodOutput.toString(), idealOutput: m.idealOutput.toString() }, context: { order: (run as any).productionOrder?.orderNumber, line: (run as any).productionLine?.code } });
    }
    const availability = aggregateFactor(operating, planned, 'minutes');
    const performance = aggregateFactor(total, ideal, 'units');
    const quality = aggregateFactor(good, total, 'units');
    const oee = oeeProduct(availability, performance, quality);
    const factor = kind === 'OEE' ? oee : kind === 'AVAILABILITY' ? availability : kind === 'PERFORMANCE' ? performance : quality;
    base.evidence = evidence; base.evidenceCount = runs.length;
    base.dataQuality.notes.push('Canonical OEE formula utilities reused from production-analytics (PHASE_1_9_OEE_V1). Attribution: ProductionRun.operationalPersonId.');
    if (factor.fraction === null) {
      base.status = 'INSUFFICIENT_DATA';
      base.explanation = `${kind} is not calculable for the selected attributed runs: ${factor.blockers.join(', ') || 'insufficient denominator'}.`;
      base.dataQuality.issues.push(...factor.blockers);
      return base;
    }
    base.status = 'CALCULABLE';
    base.rawValue = this.round(Number(factor.percent), 4);
    if (kind === 'OEE') {
      base.numerator = null;
      base.denominator = null;
      base.dataQuality.notes.push(`A=${availability.percent ?? 'null'}%, P=${performance.percent ?? 'null'}%, Q=${quality.percent ?? 'null'}%`);
    } else {
      const fr = factor as any;
      base.numerator = fr.numerator != null ? this.round(Number(fr.numerator), 4) : null;
      base.denominator = fr.denominator != null ? this.round(Number(fr.denominator), 4) : null;
    }
    base.explanation = `${kind} calculated from ${runs.length} attributed production runs using canonical production analytics formula. Raw value = ${base.rawValue}%.`;
    base.dataQuality.notes.push(...(factor.warnings || []));
    return base;
  }

  private async prodOutput({ ctx, from, to, employee, profile, kpi, evidenceLimit }: any, mode: 'TOTAL' | 'GOOD'): Promise<PreviewResult> {
    const base = this.baseResult(employee, profile, kpi, from, to, 'INSUFFICIENT_DATA', 'No eligible production output attributed to this employee in the selected period.');
    const runs = await this.loadRunsForPerson(ctx, employee.id, from, to);
    if (runs.length === 0) { base.dataQuality.issues.push('noAttributedRuns'); return base; }
    let sum = new Prisma.Decimal(0);
    const evidence: Evidence[] = [];
    for (const run of runs) {
      const m = this.computeRunMetrics(run, { from, to });
      const val = mode === 'GOOD' ? m.goodOutput : m.totalOutput;
      sum = sum.plus(val);
      if (evidence.length < evidenceLimit) evidence.push({ sourceType: 'ProductionRun', sourceId: run.id, sourceNumber: run.runNumber, occurredAt: run.startedAt?.toISOString() ?? null, contribution: { value: val.toString() }, context: { line: (run as any).productionLine?.code } });
    }
    base.status = 'CALCULABLE';
    base.rawValue = this.round(Number(sum.toString()), 4);
    base.numerator = base.rawValue;
    base.denominator = runs.length;
    base.evidence = evidence; base.evidenceCount = runs.length;
    base.explanation = `${mode === 'GOOD' ? 'Good' : 'Total'} output summed across ${runs.length} attributed production runs. Raw value = ${base.rawValue}.`;
    base.dataQuality.notes.push('Attribution: ProductionRun.operationalPersonId; output derived via canonical deriveRunTotals.');
    return base;
  }

  private async prodRejectRate({ ctx, from, to, employee, profile, kpi, evidenceLimit }: any): Promise<PreviewResult> {
    const base = this.baseResult(employee, profile, kpi, from, to, 'INSUFFICIENT_DATA', 'No eligible production output attributed to this employee in the selected period.');
    const runs = await this.loadRunsForPerson(ctx, employee.id, from, to);
    if (runs.length === 0) { base.dataQuality.issues.push('noAttributedRuns'); return base; }
    let total = new Prisma.Decimal(0), reject = new Prisma.Decimal(0);
    const evidence: Evidence[] = [];
    for (const run of runs) {
      const m = this.computeRunMetrics(run, { from, to });
      total = total.plus(m.totalOutput); reject = reject.plus(m.rejectOutput);
      if (evidence.length < evidenceLimit) evidence.push({ sourceType: 'ProductionRun', sourceId: run.id, sourceNumber: run.runNumber, occurredAt: run.startedAt?.toISOString() ?? null, contribution: { totalOutput: m.totalOutput.toString(), rejectOutput: m.rejectOutput.toString() }, context: { line: (run as any).productionLine?.code } });
    }
    base.evidence = evidence; base.evidenceCount = runs.length;
    if (total.lessThanOrEqualTo(0)) { base.status = 'INSUFFICIENT_DATA'; base.dataQuality.issues.push('zeroDenominator'); base.explanation = 'Total output is zero; reject rate cannot be calculated.'; return base; }
    base.status = 'CALCULABLE';
    base.numerator = this.round(Number(reject.toString()), 4);
    base.denominator = this.round(Number(total.toString()), 4);
    base.rawValue = this.round((base.numerator / base.denominator) * 100, 4);
    base.explanation = `Reject rate = ${base.numerator} / ${base.denominator} * 100 = ${base.rawValue}% across ${runs.length} attributed runs.`;
    base.dataQuality.notes.push('Attribution: ProductionRun.operationalPersonId; reject derived via canonical deriveRunTotals.');
    return base;
  }

  private async prodWasteRate({ ctx, from, to, employee, profile, kpi, evidenceLimit }: any): Promise<PreviewResult> {
    const base = this.baseResult(employee, profile, kpi, from, to, 'INSUFFICIENT_DATA', 'No eligible production loss events attributed to this employee in the selected period.');
    const runs = await this.loadRunsForPerson(ctx, employee.id, from, to);
    if (runs.length === 0) { base.dataQuality.issues.push('noAttributedRuns'); return base; }
    const runIds = runs.map(r => r.id);
    const losses = await this.prisma.productionLossQuantityEvent.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: { in: runIds }, sourceType: { not: 'CORRECTION' }, occurredAt: { gte: from, lte: to }, type: 'WASTE' },
      select: { id: true, productionRunId: true, quantity: true, occurredAt: true, type: true },
      orderBy: { occurredAt: 'asc' }, take: 1000,
    });
    let total = new Prisma.Decimal(0); let waste = new Prisma.Decimal(0);
    const evidence: Evidence[] = [];
    for (const run of runs) { const m = this.computeRunMetrics(run, { from, to }); total = total.plus(m.totalOutput); }
    for (const l of losses) { waste = waste.plus(new Prisma.Decimal(l.quantity)); if (evidence.length < evidenceLimit) evidence.push({ sourceType: 'ProductionLossQuantityEvent', sourceId: l.id, occurredAt: l.occurredAt.toISOString(), contribution: { wasteQuantity: l.quantity.toString() }, context: { productionRunId: l.productionRunId } }); }
    base.evidence = evidence; base.evidenceCount = losses.length;
    base.dataQuality.notes.push('Waste rate uses ProductionLossQuantityEvent.type=WASTE; reject/rework are not mixed into waste numerator.');
    if (total.lessThanOrEqualTo(0)) { base.status = 'INSUFFICIENT_DATA'; base.dataQuality.issues.push('zeroDenominator'); base.explanation = 'Total output is zero; waste rate cannot be calculated.'; return base; }
    base.status = 'CALCULABLE';
    base.numerator = this.round(Number(waste.toString()), 4);
    base.denominator = this.round(Number(total.toString()), 4);
    base.rawValue = this.round((base.numerator / base.denominator) * 100, 4);
    base.explanation = `Waste rate = ${base.numerator} / ${base.denominator} * 100 = ${base.rawValue}% across ${runs.length} attributed runs (${losses.length} waste events).`;
    return base;
  }
}
