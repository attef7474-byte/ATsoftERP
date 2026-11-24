import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceContextService } from '../context/performance-context.service';
import { PerformanceKpiPreviewService } from '../kpi-preview/performance-kpi-preview.service';
import { ProductionPerformanceTargetsService } from '../../factory/production-analytics/production-performance-targets.service';
import { computeKpiScore, scoreToNumber } from './performance-scoring.engine';

type AnyRow = any;
const D = (v: any) => new Prisma.Decimal(v);
const D0 = new Prisma.Decimal(0);
const D100 = new Prisma.Decimal(100);

function decEq(a: Prisma.Decimal, b: Prisma.Decimal) { return a.toDecimalPlaces(4).equals(b.toDecimalPlaces(4)); }

@Injectable()
export class PerformanceScoringService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private contextService: PerformanceContextService,
    private previewService: PerformanceKpiPreviewService,
    private productionTargets: ProductionPerformanceTargetsService,
  ) {}

  private bad(field: string, code: string, message: string) {
    return new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: [{ field, code, message }] });
  }

  private parseDate(v: any, field: string, required = true) {
    if (v === undefined || v === null || v === '') { if (required) throw this.bad(field, 'validation.required', `${field} is required`); return null; }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw this.bad(field, 'validation.invalidDate', `Invalid ${field}`);
    return d;
  }

  private async assertProfile(companyId: string, id: string) {
    const row = await this.prisma.performanceProfile.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw this.bad('performanceProfileId', 'validation.invalidReference', 'Performance profile not found');
    return row;
  }
  private async assertKpi(companyId: string, id: string) {
    const row = await this.prisma.performanceKpiDefinition.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!row) throw this.bad('kpiDefinitionId', 'validation.invalidReference', 'KPI definition not found');
    return row;
  }

  private effectiveWhere(at: Date) {
    return { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] };
  }

  private async assertNoOverlap(model: 'performanceKpiTarget' | 'performanceProfileKpiWeight' | 'performanceKpiScoringRule', where: any, from: Date, to: Date | null, excludeId?: string) {
    const overlapWhere: any = {
      ...where,
      deletedAt: null,
      status: { in: ['DRAFT', 'ACTIVE'] },
      effectiveFrom: to ? { lt: to } : undefined,
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] }],
    };
    if (!to) delete overlapWhere.effectiveFrom;
    if (excludeId) overlapWhere.id = { not: excludeId };
    const existing = await (this.prisma as any)[model].findFirst({ where: overlapWhere, select: { id: true, effectiveFrom: true, effectiveTo: true, revision: true, status: true } });
    if (existing) throw this.bad('effectiveFrom', 'validation.overlap', 'Overlapping active/draft configuration exists for the same scope');
  }

  private async auditBusiness(ctx: ActiveOperationalContext, userId: string | undefined, action: string, entity: string, entityId: string, previous?: unknown, next?: unknown, reason?: string, metadata?: Record<string, unknown>) {
    await this.audit.logBusiness({
      userId: userId ?? 'system',
      action,
      entity,
      entityId,
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? null,
      previous: previous ?? null,
      next: next ?? null,
      reason: reason ?? undefined,
      metadata: metadata ?? undefined,
    });
  }

  // ----------------- Targets -----------------
  async listTargets(query: any, ctx: ActiveOperationalContext) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    if (query.kpiDefinitionId) where.kpiDefinitionId = String(query.kpiDefinitionId);
    if (query.performanceProfileId) where.performanceProfileId = String(query.performanceProfileId);
    if (query.status) where.status = String(query.status);
    if (query.branchId) where.branchId = String(query.branchId);
    if (query.productionLineId) where.productionLineId = String(query.productionLineId);
    if (query.machineId) where.machineId = String(query.machineId);
    if (query.productionProductDefinitionId) where.productionProductDefinitionId = String(query.productionProductDefinitionId);
    const [data, total] = await Promise.all([
      this.prisma.performanceKpiTarget.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }], include: { kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, measurementUnit: true, direction: true } }, performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } } }),
      this.prisma.performanceKpiTarget.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createTarget(dto: any, ctx: ActiveOperationalContext, userId?: string) {
    const kpi = await this.assertKpi(ctx.companyId, dto.kpiDefinitionId);
    if (dto.performanceProfileId) await this.assertProfile(ctx.companyId, dto.performanceProfileId);
    const effectiveFrom = this.parseDate(dto.effectiveFrom, 'effectiveFrom')!;
    const effectiveTo = this.parseDate(dto.effectiveTo, 'effectiveTo', false);
    if (effectiveTo && effectiveTo <= effectiveFrom) throw this.bad('effectiveTo', 'validation.invalidRange', 'effectiveTo must be after effectiveFrom');
    const scopeType = String(dto.scopeType || 'COMPANY');
    const targetValue = D(dto.targetValue);
    const data: any = {
      companyId: ctx.companyId, kpiDefinitionId: kpi.id,
      performanceProfileId: dto.performanceProfileId || null,
      branchId: dto.branchId || null,
      productionLineId: dto.productionLineId || null,
      machineId: dto.machineId || null,
      productionProductDefinitionId: dto.productionProductDefinitionId || null,
      departmentId: dto.departmentId || null,
      jobTitleId: dto.jobTitleId || null,
      scopeType, targetValue, unit: dto.unit?.trim() || kpi.measurementUnit,
      minimumAcceptableValue: dto.minimumAcceptableValue != null ? D(dto.minimumAcceptableValue) : null,
      maximumExceptionalValue: dto.maximumExceptionalValue != null ? D(dto.maximumExceptionalValue) : null,
      effectiveFrom, effectiveTo, revision: Number(dto.revision) || 1, status: 'DRAFT',
      reason: dto.reason?.trim() || null, notes: dto.notes?.trim() || null,
      createdById: userId ?? null, updatedById: userId ?? null,
    };
    await this.assertNoOverlap('performanceKpiTarget', {
      companyId: ctx.companyId, kpiDefinitionId: data.kpiDefinitionId, performanceProfileId: data.performanceProfileId,
      branchId: data.branchId, productionLineId: data.productionLineId, machineId: data.machineId,
      productionProductDefinitionId: data.productionProductDefinitionId, departmentId: data.departmentId, jobTitleId: data.jobTitleId,
      scopeType: data.scopeType,
    }, effectiveFrom, effectiveTo);
    const row = await this.prisma.performanceKpiTarget.create({ data });
    await this.auditBusiness(ctx, userId, 'CREATE', 'PerformanceKpiTarget', row.id, null, { kpiDefinitionId: row.kpiDefinitionId, scopeType: row.scopeType, targetValue: row.targetValue.toString(), effectiveFrom, effectiveTo, status: row.status, revision: row.revision });
    return row;
  }

  async updateTarget(id: string, dto: any, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceKpiTarget.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.targetNotFound', message: 'Performance KPI target not found' });
    if (existing.status !== 'DRAFT') throw this.bad('status', 'validation.invalidState', 'Only DRAFT targets can be edited; create a new revision');
    const effectiveFrom = dto.effectiveFrom ? this.parseDate(dto.effectiveFrom, 'effectiveFrom')! : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined ? this.parseDate(dto.effectiveTo, 'effectiveTo', false) : existing.effectiveTo;
    if (effectiveTo && effectiveTo <= effectiveFrom) throw this.bad('effectiveTo', 'validation.invalidRange', 'effectiveTo must be after effectiveFrom');
    const data: any = { updatedById: userId ?? null, effectiveFrom, effectiveTo };
    if (dto.targetValue !== undefined) data.targetValue = D(dto.targetValue);
    if (dto.minimumAcceptableValue !== undefined) data.minimumAcceptableValue = dto.minimumAcceptableValue == null ? null : D(dto.minimumAcceptableValue);
    if (dto.maximumExceptionalValue !== undefined) data.maximumExceptionalValue = dto.maximumExceptionalValue == null ? null : D(dto.maximumExceptionalValue);
    if (dto.unit !== undefined) data.unit = dto.unit?.trim() || null;
    if (dto.reason !== undefined) data.reason = dto.reason?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.scopeType !== undefined) data.scopeType = String(dto.scopeType);
    await this.assertNoOverlap('performanceKpiTarget', {
      companyId: ctx.companyId, kpiDefinitionId: existing.kpiDefinitionId, performanceProfileId: existing.performanceProfileId,
      branchId: existing.branchId, productionLineId: existing.productionLineId, machineId: existing.machineId,
      productionProductDefinitionId: existing.productionProductDefinitionId, departmentId: existing.departmentId, jobTitleId: existing.jobTitleId,
      scopeType: data.scopeType ?? existing.scopeType,
    }, effectiveFrom, effectiveTo, id);
    const row = await this.prisma.performanceKpiTarget.update({ where: { id }, data });
    await this.auditBusiness(ctx, userId, 'UPDATE', 'PerformanceKpiTarget', id, { status: existing.status, targetValue: existing.targetValue.toString(), effectiveFrom: existing.effectiveFrom, effectiveTo: existing.effectiveTo }, { status: row.status, targetValue: row.targetValue.toString(), effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo });
    return row;
  }

  async activateTarget(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceKpiTarget.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.targetNotFound', message: 'Performance KPI target not found' });
    if (existing.status === 'ACTIVE') throw this.bad('status', 'validation.invalidState', 'Target is already active');
    await this.assertNoOverlap('performanceKpiTarget', {
      companyId: ctx.companyId, kpiDefinitionId: existing.kpiDefinitionId, performanceProfileId: existing.performanceProfileId,
      branchId: existing.branchId, productionLineId: existing.productionLineId, machineId: existing.machineId,
      productionProductDefinitionId: existing.productionProductDefinitionId, departmentId: existing.departmentId, jobTitleId: existing.jobTitleId,
      scopeType: existing.scopeType,
    }, existing.effectiveFrom, existing.effectiveTo, id);
    const row = await this.prisma.performanceKpiTarget.update({ where: { id }, data: { status: 'ACTIVE', updatedById: userId ?? null } });
    await this.auditBusiness(ctx, userId, 'ACTIVATE', 'PerformanceKpiTarget', id, { status: existing.status }, { status: row.status, targetValue: row.targetValue.toString() });
    return row;
  }

  async deactivateTarget(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceKpiTarget.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.targetNotFound', message: 'Performance KPI target not found' });
    if (existing.status === 'INACTIVE') throw this.bad('status', 'validation.invalidState', 'Target is already inactive');
    const row = await this.prisma.performanceKpiTarget.update({ where: { id }, data: { status: 'INACTIVE', updatedById: userId ?? null } });
    await this.auditBusiness(ctx, userId, 'DEACTIVATE', 'PerformanceKpiTarget', id, { status: existing.status }, { status: row.status });
    return row;
  }

  // ----------------- Weights -----------------
  async listWeights(query: any, ctx: ActiveOperationalContext) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    if (query.performanceProfileId) where.performanceProfileId = String(query.performanceProfileId);
    if (query.kpiDefinitionId) where.kpiDefinitionId = String(query.kpiDefinitionId);
    if (query.status) where.status = String(query.status);
    const [data, total] = await Promise.all([
      this.prisma.performanceProfileKpiWeight.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }], include: { kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, measurementUnit: true, direction: true } }, performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } } }),
      this.prisma.performanceProfileKpiWeight.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createWeight(dto: any, ctx: ActiveOperationalContext, userId?: string) {
    const profile = await this.assertProfile(ctx.companyId, dto.performanceProfileId);
    const kpi = await this.assertKpi(ctx.companyId, dto.kpiDefinitionId);
    const effectiveFrom = this.parseDate(dto.effectiveFrom, 'effectiveFrom')!;
    const effectiveTo = this.parseDate(dto.effectiveTo, 'effectiveTo', false);
    if (effectiveTo && effectiveTo <= effectiveFrom) throw this.bad('effectiveTo', 'validation.invalidRange', 'effectiveTo must be after effectiveFrom');
    const weightPercent = D(dto.weightPercent);
    if (weightPercent.lessThan(0) || weightPercent.greaterThan(100)) throw this.bad('weightPercent', 'validation.outOfRange', 'weightPercent must be between 0 and 100');
    const isInformational = Boolean(dto.isInformational);
    if (isInformational && !weightPercent.equals(0)) throw this.bad('weightPercent', 'validation.invalidValue', 'Informational KPI weight must be 0');
    await this.assertNoOverlap('performanceProfileKpiWeight', { companyId: ctx.companyId, performanceProfileId: profile.id, kpiDefinitionId: kpi.id }, effectiveFrom, effectiveTo);
    const row = await this.prisma.performanceProfileKpiWeight.create({
      data: {
        companyId: ctx.companyId, performanceProfileId: profile.id, kpiDefinitionId: kpi.id,
        weightPercent, isRequired: Boolean(dto.isRequired), isInformational,
        effectiveFrom, effectiveTo, revision: Number(dto.revision) || 1, status: 'DRAFT',
        reason: dto.reason?.trim() || null, notes: dto.notes?.trim() || null,
        createdById: userId ?? null, updatedById: userId ?? null,
      },
    });
    await this.auditBusiness(ctx, userId, 'CREATE', 'PerformanceProfileKpiWeight', row.id, null, { performanceProfileId: profile.id, kpiDefinitionId: kpi.id, weightPercent: row.weightPercent.toString(), status: row.status, revision: row.revision, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo });
    return row;
  }

  async updateWeight(id: string, dto: any, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceProfileKpiWeight.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.weightNotFound', message: 'Performance KPI weight not found' });
    if (existing.status !== 'DRAFT') throw this.bad('status', 'validation.invalidState', 'Only DRAFT weights can be edited; create a new revision');
    const effectiveFrom = dto.effectiveFrom ? this.parseDate(dto.effectiveFrom, 'effectiveFrom')! : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined ? this.parseDate(dto.effectiveTo, 'effectiveTo', false) : existing.effectiveTo;
    if (effectiveTo && effectiveTo <= effectiveFrom) throw this.bad('effectiveTo', 'validation.invalidRange', 'effectiveTo must be after effectiveFrom');
    const data: any = { updatedById: userId ?? null, effectiveFrom, effectiveTo };
    if (dto.weightPercent !== undefined) {
      const w = D(dto.weightPercent); if (w.lessThan(0) || w.greaterThan(100)) throw this.bad('weightPercent', 'validation.outOfRange', 'weightPercent must be between 0 and 100'); data.weightPercent = w;
    }
    if (dto.isRequired !== undefined) data.isRequired = Boolean(dto.isRequired);
    if (dto.isInformational !== undefined) data.isInformational = Boolean(dto.isInformational);
    const finalWeight = (data.weightPercent ?? existing.weightPercent) as Prisma.Decimal;
    const finalInfo = data.isInformational ?? existing.isInformational;
    if (finalInfo && !finalWeight.equals(0)) throw this.bad('weightPercent', 'validation.invalidValue', 'Informational KPI weight must be 0');
    if (dto.reason !== undefined) data.reason = dto.reason?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    await this.assertNoOverlap('performanceProfileKpiWeight', { companyId: ctx.companyId, performanceProfileId: existing.performanceProfileId, kpiDefinitionId: existing.kpiDefinitionId }, effectiveFrom, effectiveTo, id);
    const row = await this.prisma.performanceProfileKpiWeight.update({ where: { id }, data });
    await this.auditBusiness(ctx, userId, 'UPDATE', 'PerformanceProfileKpiWeight', id, { weightPercent: existing.weightPercent.toString(), status: existing.status, effectiveFrom: existing.effectiveFrom, effectiveTo: existing.effectiveTo }, { weightPercent: row.weightPercent.toString(), status: row.status, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo });
    return row;
  }

  private async assertProfileWeightTotal(profileId: string, companyId: string, at: Date) {
    const weights = await this.prisma.performanceProfileKpiWeight.findMany({
      where: { companyId, performanceProfileId: profileId, deletedAt: null, status: "ACTIVE", effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
      select: { weightPercent: true },
    });
    const sum = weights.reduce((a, w) => a.plus(new Prisma.Decimal(w.weightPercent)), D0).toDecimalPlaces(4);
    if (!decEq(sum, D100)) {
      throw this.bad('weightPercent', 'validation.invalidWeightTotal', `Active weight total must be 100. Current total: ${sum.toString()}`);
    }
    return sum;
  }

  async activateWeight(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceProfileKpiWeight.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.weightNotFound', message: 'Performance KPI weight not found' });
    if (existing.status === 'ACTIVE') throw this.bad('status', 'validation.invalidState', 'Weight is already active');
    await this.assertNoOverlap('performanceProfileKpiWeight', { companyId: ctx.companyId, performanceProfileId: existing.performanceProfileId, kpiDefinitionId: existing.kpiDefinitionId }, existing.effectiveFrom, existing.effectiveTo, id);
    const row = await this.prisma.performanceProfileKpiWeight.update({ where: { id }, data: { status: 'ACTIVE', updatedById: userId ?? null } });
    try {
      await this.assertProfileWeightTotal(existing.performanceProfileId, ctx.companyId, existing.effectiveFrom);
    } catch (e) {
      await this.prisma.performanceProfileKpiWeight.update({ where: { id }, data: { status: 'DRAFT', updatedById: userId ?? null } });
      throw e;
    }
    await this.auditBusiness(ctx, userId, 'ACTIVATE', 'PerformanceProfileKpiWeight', id, { status: existing.status }, { status: row.status, weightPercent: row.weightPercent.toString() });
    return row;
  }

  async deactivateWeight(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceProfileKpiWeight.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.weightNotFound', message: 'Performance KPI weight not found' });
    if (existing.status === 'INACTIVE') throw this.bad('status', 'validation.invalidState', 'Weight is already inactive');
    const row = await this.prisma.performanceProfileKpiWeight.update({ where: { id }, data: { status: 'INACTIVE', updatedById: userId ?? null } });
    await this.auditBusiness(ctx, userId, 'DEACTIVATE', 'PerformanceProfileKpiWeight', id, { status: existing.status }, { status: row.status });
    return row;
  }
  // ----------------- Target Resolution -----------------
  private productionTargetCodeForKpi(kpiCode: string) {
    const map: Record<string, string> = { PROD_OEE: 'oeeTarget', PROD_AVAILABILITY: 'availabilityTarget', PROD_PERFORMANCE: 'performanceTarget', PROD_QUALITY: 'qualityTarget' };
    return map[kpiCode] || null;
  }

  private targetResolutionEvidence(target: any) {
    return {
      resolvedTarget: target?.targetValue?.toString?.() ?? target?.targetValue ?? null,
      targetSource: target?.sourceType ?? null,
      sourceRecord: target?.sourceId ? { id: target.sourceId, code: target.sourceCode ?? null } : null,
      scope: target?.scopeType ?? null,
      effectiveDate: target?.effectiveFrom ? new Date(target.effectiveFrom).toISOString() : null,
      revision: target?.revision ?? null,
      resolutionReason: target?.explanation ?? null,
    };
  }

  private async resolveCanonicalProductionTarget(kpiCode: string, ctx: ActiveOperationalContext, at: Date) {
    const field = this.productionTargetCodeForKpi(kpiCode);
    if (!field) return null;
    const targets = await this.prisma.productionPerformanceTarget.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'APPROVED',
        deletedAt: null,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      select: { id: true, code: true, scopeType: true, productionUnitId: true, productionLineId: true, machineId: true, productionProductDefinitionId: true, availabilityTarget: true, performanceTarget: true, qualityTarget: true, oeeTarget: true, effectiveFrom: true, effectiveTo: true, revision: true, companyId: true, branchId: true, status: true, deletedAt: true },
    });
    if (targets.length === 0) return null;

    const scopeRank: Record<string, number> = { MACHINE: 0, LINE_PRODUCT: 1, PRODUCT: 2, LINE: 3, UNIT: 4, BRANCH: 5, COMPANY: 6 };
    // Only COMPANY/BRANCH scopes are safely resolvable without production run context (unit/line/machine/product).
    const contextRequiredScopes = new Set(['MACHINE', 'LINE', 'PRODUCT', 'UNIT']);
    const hasContextScoped = targets.some((t: any) => contextRequiredScopes.has(t.scopeType) || (t.scopeType === 'LINE' && t.productionProductDefinitionId));
    // If there are context-scoped targets, we cannot deterministically resolve without production context.
    const safe = targets.filter((t: any) => t.scopeType === 'COMPANY' || t.scopeType === 'BRANCH');
    if (safe.length === 0) {
      return { status: 'CONFIGURATION_MISSING', reason: 'PRODUCTION_CONTEXT_REQUIRED', explanation: 'Canonical production target exists but requires production line/machine/product/unit context not available in this simulation.' };
    }
    // Prefer most specific safe scope: BRANCH (5) before COMPANY (6)
    const ranked: Record<number, any[]> = {};
    for (const t of safe) { const r = scopeRank[t.scopeType]; if (r === undefined) continue; (ranked[r] ||= []).push(t); }
    const ranks = Object.keys(ranked).map(Number).sort((a,b)=>a-b);
    const matches = ranked[ranks[0]];
    if (matches.length > 1) {
      return { status: 'CONFIGURATION_MISSING', reason: 'AMBIGUOUS_TARGET', explanation: 'Multiple canonical production targets match the same scope precedence.', matches: matches.map((m:any)=>({id:m.id,code:m.code,scopeType:m.scopeType,revision:m.revision})) };
    }
    const m = matches[0];
    const value = (m as any)[field];
    if (value === null || value === undefined) {
      return { status: 'CONFIGURATION_MISSING', reason: 'NO_TARGET_VALUE', explanation: `Canonical production target ${m.code} has no ${field} value.` };
    }
    // If more-specific context-scoped targets exist, we must not silently pick a broader COMPANY/BRANCH target when it may be wrong for this employee.
    // But we cannot know - be safe: report configuration missing with explicit reason.
    if (hasContextScoped) {
      return { status: 'CONFIGURATION_MISSING', reason: 'PRODUCTION_CONTEXT_REQUIRED', explanation: 'Canonical production targets include line/machine/product/unit scopes; production context is required to resolve deterministically. No safe broader fallback applied.' };
    }
    return {
      status: 'RESOLVED',
      target: {
        sourceType: 'CANONICAL_PRODUCTION_TARGET',
        sourceId: m.id,
        sourceCode: m.code,
        scopeType: m.scopeType,
        targetValue: value,
        minimumAcceptableValue: null,
        maximumExceptionalValue: null,
        effectiveFrom: m.effectiveFrom,
        effectiveTo: m.effectiveTo,
        revision: m.revision,
        explanation: `Resolved from canonical ProductionPerformanceTarget ${m.code} (${m.scopeType}) field ${field}, revision ${m.revision}.`,
      },
    };
  }

  async resolveTargetForKpi(kpi: any, profileId: string | null, ctx: ActiveOperationalContext, at: Date, personCtx: any) {
    const baseWhere: any = { companyId: ctx.companyId, kpiDefinitionId: kpi.id, deletedAt: null, status: 'ACTIVE', ...this.effectiveWhere(at) };
    const candidates = await this.prisma.performanceKpiTarget.findMany({ where: baseWhere, orderBy: [{ revision: 'desc' }, { effectiveFrom: 'desc' }] });

    const personDept = personCtx?.organization?.department?.id ?? null;
    const personJob = personCtx?.organization?.jobTitle?.id ?? null;
    const personBranch = personCtx?.organization?.branch?.id ?? ctx.branchId ?? null;

    const contextMatches = (t: any) => {
      if (t.performanceProfileId && t.performanceProfileId !== profileId) return false;
      if (t.branchId && t.branchId !== personBranch) return false;
      if (t.departmentId && t.departmentId !== personDept) return false;
      if (t.jobTitleId && t.jobTitleId !== personJob) return false;
      // production line/machine/product dimensions - only match if target has no constraint or we have context (not available here)
      if (t.productionLineId || t.machineId || t.productionProductDefinitionId) return false;
      return true;
    };

    const scoreSpecificity = (t: any) => {
      let s = 0;
      if (t.performanceProfileId && profileId && t.performanceProfileId === profileId) s += 100;
      if (t.machineId) s += 50;
      if (t.productionLineId) s += 30;
      if (t.productionProductDefinitionId) s += 20;
      if (t.departmentId) s += 15;
      if (t.jobTitleId) s += 15;
      if (t.branchId) s += 5;
      if (t.scopeType === 'COMPANY') s += 1;
      return s;
    };

    const applicable = candidates.filter(contextMatches);
    applicable.sort((a,b)=>scoreSpecificity(b)-scoreSpecificity(a));
    if (applicable.length > 0) {
      const topScore = scoreSpecificity(applicable[0]);
      const top = applicable.filter(t => scoreSpecificity(t) === topScore);
      if (top.length > 1) {
        return { status: 'CONFIGURATION_MISSING', reason: 'AMBIGUOUS_TARGET', explanation: 'Multiple active performance targets match the same specificity.', matches: top.map(t=>({id:t.id,scopeType:t.scopeType,revision:t.revision})), ...this.targetResolutionEvidence(null) };
      }
      const m = top[0];
      const target = { sourceType: 'PERFORMANCE_KPI_TARGET', sourceId: m.id, sourceCode: null, scopeType: m.scopeType, targetValue: m.targetValue, minimumAcceptableValue: m.minimumAcceptableValue, maximumExceptionalValue: m.maximumExceptionalValue, effectiveFrom: m.effectiveFrom, effectiveTo: m.effectiveTo, revision: m.revision, explanation: `Resolved from PerformanceKpiTarget ${m.id} (${m.scopeType}) revision ${m.revision}.` };
      return { status: 'RESOLVED', target, ...this.targetResolutionEvidence(target) };
    }

    const canonical = await this.resolveCanonicalProductionTarget(kpi.code, ctx, at);
    if (canonical) {
      if (canonical.status !== 'RESOLVED') return { ...canonical, ...this.targetResolutionEvidence(null) };
      return { status: 'RESOLVED', target: canonical.target, ...this.targetResolutionEvidence(canonical.target) };
    }
    return { status: 'CONFIGURATION_MISSING', reason: 'NO_TARGET', explanation: 'No target resolved for KPI.', ...this.targetResolutionEvidence(null) };
  }

  // ----------------- Scoring Rules -----------------
  async listRules(query: any, ctx: ActiveOperationalContext) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    if (query.performanceProfileId) where.performanceProfileId = String(query.performanceProfileId);
    if (query.kpiDefinitionId) where.kpiDefinitionId = String(query.kpiDefinitionId);
    if (query.status) where.status = String(query.status);
    const [data, total] = await Promise.all([
      this.prisma.performanceKpiScoringRule.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ status: 'asc' }, { effectiveFrom: 'desc' }], include: { kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, direction: true } }, performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } } }),
      this.prisma.performanceKpiScoringRule.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private validateRule(dto: any) {
    const mode = String(dto.scoringMode || '');
    const allowed = ['LINEAR_TARGET','LINEAR_RANGE','THRESHOLD_BANDS','CAPPED_RATIO','TARGET_BAND','INVERSE_LINEAR'];
    if (!allowed.includes(mode)) throw this.bad('scoringMode', 'validation.invalidValue', 'Invalid scoringMode');
    const dir = String(dto.direction || '');
    if (!['HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_IS_BEST','INFORMATIONAL'].includes(dir)) throw this.bad('direction', 'validation.invalidValue', 'Invalid direction');
    if (dto.bandsJson) { try { const b = JSON.parse(dto.bandsJson); if (!Array.isArray(b)) throw new Error('x'); } catch { throw this.bad('bandsJson', 'validation.invalidJson', 'bandsJson must be a JSON array'); } }
  }

  async createRule(dto: any, ctx: ActiveOperationalContext, userId?: string) {
    await this.assertKpi(ctx.companyId, dto.kpiDefinitionId);
    if (dto.performanceProfileId) await this.assertProfile(ctx.companyId, dto.performanceProfileId);
    this.validateRule(dto);
    const effectiveFrom = this.parseDate(dto.effectiveFrom, 'effectiveFrom')!;
    const effectiveTo = this.parseDate(dto.effectiveTo, 'effectiveTo', false);
    if (effectiveTo && effectiveTo <= effectiveFrom) throw this.bad('effectiveTo', 'validation.invalidRange', 'effectiveTo must be after effectiveFrom');
    await this.assertNoOverlap('performanceKpiScoringRule', { companyId: ctx.companyId, kpiDefinitionId: dto.kpiDefinitionId, performanceProfileId: dto.performanceProfileId || null }, effectiveFrom, effectiveTo);
    const row = await this.prisma.performanceKpiScoringRule.create({ data: {
      companyId: ctx.companyId, kpiDefinitionId: dto.kpiDefinitionId, performanceProfileId: dto.performanceProfileId || null,
      scoringMode: dto.scoringMode, direction: dto.direction,
      minScore: dto.minScore != null ? D(dto.minScore) : D0, maxScore: dto.maxScore != null ? D(dto.maxScore) : D100,
      targetScore: dto.targetScore != null ? D(dto.targetScore) : null,
      floorValue: dto.floorValue != null ? D(dto.floorValue) : null,
      targetValue: dto.targetValue != null ? D(dto.targetValue) : null,
      ceilingValue: dto.ceilingValue != null ? D(dto.ceilingValue) : null,
      bandsJson: dto.bandsJson ?? null,
      missingDataPolicy: dto.missingDataPolicy || 'INSUFFICIENT_DATA',
      notApplicablePolicy: dto.notApplicablePolicy || 'NOT_APPLICABLE',
      configMissingPolicy: dto.configMissingPolicy || 'CONFIGURATION_MISSING',
      clampMin: dto.clampMin != null ? D(dto.clampMin) : D0, clampMax: dto.clampMax != null ? D(dto.clampMax) : D100,
      effectiveFrom, effectiveTo, revision: Number(dto.revision) || 1, status: 'DRAFT',
      reason: dto.reason?.trim() || null, notes: dto.notes?.trim() || null,
      createdById: userId ?? null, updatedById: userId ?? null,
    } });
    await this.auditBusiness(ctx, userId, 'CREATE', 'PerformanceKpiScoringRule', row.id, null, { kpiDefinitionId: row.kpiDefinitionId, scoringMode: row.scoringMode, status: row.status, revision: row.revision, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo });
    return row;
  }

  async updateRule(id: string, dto: any, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceKpiScoringRule.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.ruleNotFound', message: 'Performance scoring rule not found' });
    if (existing.status !== 'DRAFT') throw this.bad('status', 'validation.invalidState', 'Only DRAFT rules can be edited; create a new revision');
    const provided = Object.fromEntries(Object.entries(dto ?? {}).filter(([, value]) => value !== undefined));
    const merged = { ...existing, ...provided };
    this.validateRule(merged);
    const effectiveFrom = dto.effectiveFrom ? this.parseDate(dto.effectiveFrom, 'effectiveFrom')! : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined ? this.parseDate(dto.effectiveTo, 'effectiveTo', false) : existing.effectiveTo;
    if (effectiveTo && effectiveTo <= effectiveFrom) throw this.bad('effectiveTo', 'validation.invalidRange', 'effectiveTo must be after effectiveFrom');
    await this.assertNoOverlap('performanceKpiScoringRule', { companyId: ctx.companyId, kpiDefinitionId: existing.kpiDefinitionId, performanceProfileId: existing.performanceProfileId }, effectiveFrom, effectiveTo, id);
    const data: any = { updatedById: userId ?? null, effectiveFrom, effectiveTo };
    for (const k of ['scoringMode','direction','bandsJson','missingDataPolicy','notApplicablePolicy','configMissingPolicy','reason','notes']) if (dto[k] !== undefined) data[k] = (k==='reason'||k==='notes') ? (dto[k]?.trim() || null) : dto[k];
    for (const k of ['minScore','maxScore','targetScore','floorValue','targetValue','ceilingValue','clampMin','clampMax']) if (dto[k] !== undefined) data[k] = dto[k] == null ? null : D(dto[k]);
    const row = await this.prisma.performanceKpiScoringRule.update({ where: { id }, data });
    await this.auditBusiness(ctx, userId, 'UPDATE', 'PerformanceKpiScoringRule', id, { status: existing.status, scoringMode: existing.scoringMode, effectiveFrom: existing.effectiveFrom, effectiveTo: existing.effectiveTo }, { status: row.status, scoringMode: row.scoringMode, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo });
    return row;
  }

  async activateRule(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceKpiScoringRule.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.ruleNotFound', message: 'Performance scoring rule not found' });
    if (existing.status === 'ACTIVE') throw this.bad('status', 'validation.invalidState', 'Rule is already active');
    await this.assertNoOverlap('performanceKpiScoringRule', { companyId: ctx.companyId, kpiDefinitionId: existing.kpiDefinitionId, performanceProfileId: existing.performanceProfileId }, existing.effectiveFrom, existing.effectiveTo, id);
    const row = await this.prisma.performanceKpiScoringRule.update({ where: { id }, data: { status: 'ACTIVE', updatedById: userId ?? null } });
    await this.auditBusiness(ctx, userId, 'ACTIVATE', 'PerformanceKpiScoringRule', id, { status: existing.status }, { status: row.status });
    return row;
  }

  async deactivateRule(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.performanceKpiScoringRule.findFirst({ where: { id, companyId: ctx.companyId, deletedAt: null } });
    if (!existing) throw new NotFoundException({ messageKey: 'performance.ruleNotFound', message: 'Performance scoring rule not found' });
    if (existing.status === 'INACTIVE') throw this.bad('status', 'validation.invalidState', 'Rule is already inactive');
    const row = await this.prisma.performanceKpiScoringRule.update({ where: { id }, data: { status: 'INACTIVE', updatedById: userId ?? null } });
    await this.auditBusiness(ctx, userId, 'DEACTIVATE', 'PerformanceKpiScoringRule', id, { status: existing.status }, { status: row.status });
    return row;
  }


  // ----------------- Readiness / Coverage -----------------
  private async activeWeightsForProfile(profileId: string, companyId: string, at: Date) {
    return this.prisma.performanceProfileKpiWeight.findMany({
      where: { companyId, performanceProfileId: profileId, deletedAt: null, status: "ACTIVE", effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
      include: { kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, direction: true, measurementUnit: true, isActive: true, status: true, calculationVersion: true } } },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  private async detectOverlapIssues(companyId: string, profileId: string, at: Date) {
    const issues: any[] = [];
    const check = async (model: 'performanceKpiTarget' | 'performanceProfileKpiWeight' | 'performanceKpiScoringRule', label: string, extraWhere: any, keyFn: (r: any) => string) => {
      const rows = await (this.prisma as any)[model].findMany({ where: { companyId, deletedAt: null, status: 'ACTIVE', effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }], ...extraWhere } });
      const seen = new Map<string, any>();
      for (const r of rows) {
        const key = keyFn(r);
        if (seen.has(key)) { issues.push({ code: 'OVERLAPPING_CONFIGURATION', entity: label, kpiDefinitionId: r.kpiDefinitionId, a: seen.get(key).id, b: r.id }); }
        else seen.set(key, r);
      }
    };
    await check('performanceProfileKpiWeight', 'PerformanceProfileKpiWeight', { performanceProfileId: profileId }, (r) => [r.kpiDefinitionId, r.performanceProfileId ?? ''].join('|'));
    await check('performanceKpiScoringRule', 'PerformanceKpiScoringRule', { OR: [{ performanceProfileId: profileId }, { performanceProfileId: null }] }, (r) => [r.kpiDefinitionId, r.performanceProfileId ?? ''].join('|'));
    await check('performanceKpiTarget', 'PerformanceKpiTarget', { OR: [{ performanceProfileId: profileId }, { performanceProfileId: null }] }, (r) => [r.kpiDefinitionId, r.performanceProfileId ?? '', r.branchId ?? '', r.productionLineId ?? '', r.machineId ?? '', r.productionProductDefinitionId ?? '', r.departmentId ?? '', r.jobTitleId ?? '', r.scopeType ?? ''].join('|'));
    return issues;
  }

  async profileReadiness(profileId: string, ctx: ActiveOperationalContext, atIso?: string) {
    const at = this.parseDate(atIso || new Date().toISOString(), "at", true)!;
    const profile = await this.assertProfile(ctx.companyId, profileId);
    const weights = await this.activeWeightsForProfile(profileId, ctx.companyId, at);
    let sum = D0; const issues: any[] = []; const items: any[] = [];
    if (weights.length === 0) issues.push({ code: "MISSING_WEIGHT", issues: ["NO_ACTIVE_WEIGHTS"] });
    for (const w of weights) {
      const weight = new Prisma.Decimal(w.weightPercent);
      sum = sum.plus(weight);
      const rule = await this.prisma.performanceKpiScoringRule.findFirst({ where: { companyId: ctx.companyId, kpiDefinitionId: w.kpiDefinitionId, deletedAt: null, status: "ACTIVE", effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }], AND: [{ OR: [{ performanceProfileId: profileId }, { performanceProfileId: null }] }] }, orderBy: [{ performanceProfileId: "desc" }, { revision: "desc" }] });
      const target = await this.resolveTargetForKpi(w.kpiDefinition, profileId, ctx, at, null);
      const kpiIssues: string[] = [];
      if (!w.kpiDefinition.isActive || w.kpiDefinition.status !== "ACTIVE") kpiIssues.push("KPI_NOT_ACTIVE");
      if (!rule && !w.isInformational) kpiIssues.push("MISSING_RULE");
      if (target.status !== "RESOLVED" && !w.isInformational) kpiIssues.push("MISSING_TARGET");
      if (kpiIssues.length) issues.push({ kpiDefinitionId: w.kpiDefinitionId, code: w.kpiDefinition.code, issues: kpiIssues });
      items.push({ kpi: w.kpiDefinition, weightPercent: weight.toString(), isRequired: w.isRequired, isInformational: w.isInformational, rule: rule ? { id: rule.id, scoringMode: rule.scoringMode, revision: rule.revision } : null, target: target.status === "RESOLVED" ? (target as any).target : { missing: true, reason: (target as any).reason }, issues: kpiIssues, targetEvidence: this.targetResolutionEvidence(target.status === "RESOLVED" ? (target as any).target : null) });
    }
    const total = sum.toDecimalPlaces(4);
    const weightOk = decEq(total, D100);
    if (!weightOk) issues.push({ code: "INVALID_WEIGHT_TOTAL", issues: ["ACTIVE_WEIGHT_SUM=" + total.toString()], actual: total.toString(), expected: "100.0000" });
    const overlapIssues = await this.detectOverlapIssues(ctx.companyId, profileId, at);
    for (const oi of overlapIssues) issues.push(oi);
    const readyFinal = issues.length === 0 && weights.length > 0 && weightOk;
    return { profile: { id: profile.id, code: profile.code, name: profile.name, nameAr: profile.nameAr, nameEn: profile.nameEn }, at: at.toISOString(), status: readyFinal ? "READY_FOR_SCORING" : "NOT_READY", activeWeightTotal: total.toString(), weightOk, issueCount: issues.length, issues, items };
  }

  async configurationCoverage(ctx: ActiveOperationalContext, atIso?: string) {
    const at = this.parseDate(atIso || new Date().toISOString(), "at", true)!;
    const profiles = await this.prisma.performanceProfile.findMany({ where: { companyId: ctx.companyId, deletedAt: null, isActive: true }, orderBy: { code: "asc" } });
    const rows: any[] = [];
    let ready = 0, notReady = 0, missingWeight = 0, missingTarget = 0, missingRule = 0, invalidWeightTotal = 0, overlap = 0;
    for (const p of profiles) {
      const r = await this.profileReadiness(p.id, ctx, at.toISOString());
      rows.push(r);
      if (r.status === "READY_FOR_SCORING") ready++; else notReady++;
      const codes = new Set<string>();
      for (const iss of r.issues || []) { if (iss.code) codes.add(iss.code); for (const x of iss.issues || []) codes.add(x); }
      if (codes.has('MISSING_WEIGHT')) missingWeight++;
      if (codes.has('MISSING_TARGET')) missingTarget++;
      if (codes.has('MISSING_RULE') || codes.has('MISSING_SCORING_RULE')) missingRule++;
      if (codes.has('INVALID_WEIGHT_TOTAL')) invalidWeightTotal++;
      if (codes.has('OVERLAPPING_CONFIGURATION')) overlap++;
    }
    return { at: at.toISOString(), totalProfiles: profiles.length, ready, notReady, missingWeight, missingTarget, missingRule, invalidWeightTotal, overlap, profiles: rows };
  }

  // ----------------- Simulation -----------------
  private async detectPeriodSplit(companyId: string, profileId: string, kpiIds: string[], from: Date, to: Date) {
    const inPeriod = (d: Date | null) => d != null && d > from && d <= to;
    const checkModel = async (model: 'performanceKpiTarget' | 'performanceProfileKpiWeight' | 'performanceKpiScoringRule', extraWhere: any = {}) => {
      const rows = await (this.prisma as any)[model].findMany({ where: { companyId, deletedAt: null, status: { in: ['ACTIVE','SUPERSEDED','INACTIVE'] }, kpiDefinitionId: { in: kpiIds }, ...extraWhere }, select: { id: true, kpiDefinitionId: true, effectiveFrom: true, effectiveTo: true, status: true, revision: true } });
      return rows.some((r: any) => inPeriod(new Date(r.effectiveFrom)) || inPeriod(r.effectiveTo ? new Date(r.effectiveTo) : null));
    };
    const [w, tr, rr] = await Promise.all([
      checkModel('performanceProfileKpiWeight', { performanceProfileId: profileId }),
      checkModel('performanceKpiTarget', { OR: [{ performanceProfileId: profileId }, { performanceProfileId: null }] }),
      checkModel('performanceKpiScoringRule', { OR: [{ performanceProfileId: profileId }, { performanceProfileId: null }] }),
    ]);
    return w || tr || rr;
  }

  async simulate(dto: any, ctx: ActiveOperationalContext, _userId?: string) {
    const at = this.parseDate(dto.dateTo || dto.at, "dateTo", true)!;
    const from = this.parseDate(dto.dateFrom || dto.at, "dateFrom", true)!;
    if (from >= at) throw this.bad("dateFrom", "validation.invalidRange", "dateFrom must be before dateTo");
    const employeeId = String(dto.operationalPersonId || dto.employeeId || "").trim();
    if (!employeeId) throw this.bad("operationalPersonId", "validation.required", "operationalPersonId is required");
    const personCtx = await this.contextService.resolve(employeeId, ctx, at);
    const profile = personCtx.performanceProfile;
    if (!profile) return { previewOnly: true, noPersistedEvaluation: true, simulationLabel: "PREVIEW_ONLY_NOT_APPROVED", status: "CONFIGURATION_MISSING", reason: "NO_PROFILE", employee: personCtx.employee, performanceProfile: null, period: { from: from.toISOString(), to: at.toISOString() }, kpis: [], provisionalTotal: null, completenessPercent: 0, configuredWeightCovered: "0", missingRequiredKpis: [] };
    const readiness = await this.profileReadiness(profile.id, ctx, at.toISOString());
    const weights = await this.activeWeightsForProfile(profile.id, ctx.companyId, at);
    const kpiIds = weights.map(w => w.kpiDefinitionId);
    const split = kpiIds.length ? await this.detectPeriodSplit(ctx.companyId, profile.id, kpiIds, from, at) : false;
    if (split) {
      return { previewOnly: true, noPersistedEvaluation: true, simulationLabel: "PREVIEW_ONLY_NOT_APPROVED", status: "CONFIGURATION_PERIOD_SPLIT_REQUIRED", reason: "CONFIGURATION_PERIOD_SPLIT_REQUIRED", employee: personCtx.employee, performanceProfile: { id: profile.id, code: profile.code, name: profile.name, nameAr: profile.nameAr, nameEn: profile.nameEn }, period: { from: from.toISOString(), to: at.toISOString() }, readiness, kpis: [], provisionalTotal: null, completenessPercent: 0, configuredWeightCovered: "0", missingRequiredKpis: [] };
    }
    const kpis: any[] = []; let weightedSum = D0; let calculableWeight = D0; let hasRequiredIssue = false; const missingRequiredKpis: any[] = [];
    const totalWeight = weights.reduce((acc,w)=>acc.plus(new Prisma.Decimal(w.weightPercent)), D0);
    for (const w of weights) {
      const kpi = w.kpiDefinition; const weight = new Prisma.Decimal(w.weightPercent);
      const rule = await this.prisma.performanceKpiScoringRule.findFirst({ where: { companyId: ctx.companyId, kpiDefinitionId: kpi.id, deletedAt: null, status: "ACTIVE", effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }], AND: [{ OR: [{ performanceProfileId: profile.id }, { performanceProfileId: null }] }] }, orderBy: [{ performanceProfileId: "desc" }, { revision: "desc" }] });
      const targetRes = await this.resolveTargetForKpi(kpi, profile.id, ctx, at, personCtx);
      let preview: any = null; try { preview = await this.previewService.preview({ operationalPersonId: employeeId, kpiCode: kpi.code, dateFrom: from.toISOString(), dateTo: at.toISOString(), evidenceLimit: 5 } as any, ctx); } catch (e: any) { preview = { status: "SOURCE_UNAVAILABLE", rawValue: null, evidenceCount: 0, explanation: e?.message || "Preview failed" }; }
      const rawStatus = String(preview?.status || "INSUFFICIENT_DATA"); let score: number | null = null; let scoreStatus = rawStatus; let scoreExplanation = ""; const target: any = targetRes.status === "RESOLVED" ? (targetRes as any).target : null;
      if (w.isInformational) { score = null; scoreStatus = rawStatus === "CALCULABLE" ? "INFORMATIONAL" : rawStatus; scoreExplanation = "Informational KPI: weight 0, no score contribution."; }
      else if (rawStatus === "NOT_APPLICABLE") { score = null; scoreStatus = "NOT_APPLICABLE"; scoreExplanation = "KPI not applicable; no penalty applied."; if (w.isRequired) { hasRequiredIssue = true; missingRequiredKpis.push({ kpiDefinitionId: kpi.id, code: kpi.code, reason: "NOT_APPLICABLE" }); } }
      else if (rawStatus !== "CALCULABLE") { score = null; scoreStatus = rawStatus === "CONFIGURATION_MISSING" ? "CONFIGURATION_MISSING" : "INSUFFICIENT_DATA"; scoreExplanation = preview?.explanation || "Raw metric unavailable."; if (w.isRequired) { hasRequiredIssue = true; missingRequiredKpis.push({ kpiDefinitionId: kpi.id, code: kpi.code, reason: scoreStatus }); } }
      else if (!target) { score = null; scoreStatus = "CONFIGURATION_MISSING"; scoreExplanation = (targetRes as any).explanation || "No target resolved."; if (w.isRequired) { hasRequiredIssue = true; missingRequiredKpis.push({ kpiDefinitionId: kpi.id, code: kpi.code, reason: "MISSING_TARGET" }); } }
      else if (!rule) { score = null; scoreStatus = "CONFIGURATION_MISSING"; scoreExplanation = "No active scoring rule resolved."; if (w.isRequired) { hasRequiredIssue = true; missingRequiredKpis.push({ kpiDefinitionId: kpi.id, code: kpi.code, reason: "MISSING_RULE" }); } }
      else { const resolvedTargetValue = new Prisma.Decimal(target.targetValue as any); const ruleInput = { scoringMode: rule.scoringMode as any, direction: (rule.direction || kpi.direction) as any, minScore: rule.minScore, maxScore: rule.maxScore, targetScore: rule.targetScore, floorValue: rule.floorValue ?? target.minimumAcceptableValue ?? null, targetValue: rule.targetValue ?? resolvedTargetValue, ceilingValue: rule.ceilingValue ?? target.maximumExceptionalValue ?? null, bandsJson: rule.bandsJson, clampMin: rule.clampMin ?? D0, clampMax: rule.clampMax ?? D100 }; const computed = computeKpiScore(preview.rawValue, ruleInput); if (computed.status !== "CALCULABLE") { score = null; scoreStatus = "CONFIGURATION_MISSING"; scoreExplanation = computed.explanation; if (w.isRequired) { hasRequiredIssue = true; missingRequiredKpis.push({ kpiDefinitionId: kpi.id, code: kpi.code, reason: "CONFIGURATION_MISSING" }); } } else { score = scoreToNumber(computed.score); scoreStatus = "CALCULABLE"; scoreExplanation = computed.explanation; } }
      const contribution = score == null ? null : Number(new Prisma.Decimal(score).mul(weight).div(100).toDecimalPlaces(6).toString());
      if (contribution != null) { weightedSum = weightedSum.plus(D(contribution)); calculableWeight = calculableWeight.plus(weight); }
      kpis.push({ kpi: { id: kpi.id, code: kpi.code, name: kpi.name, nameAr: kpi.nameAr, nameEn: kpi.nameEn, domain: kpi.domain, measurementUnit: kpi.measurementUnit, direction: kpi.direction }, rawValue: preview?.rawValue ?? null, rawStatus, target: target ? { ...target, targetValue: target.targetValue?.toString?.() ?? target.targetValue } : null, targetEvidence: this.targetResolutionEvidence(target), scoringRule: rule ? { id: rule.id, scoringMode: rule.scoringMode, direction: rule.direction, revision: rule.revision, effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo } : null, weightPercent: weight.toString(), isRequired: w.isRequired, isInformational: w.isInformational, score, scoreStatus, weightedContribution: contribution, evidenceCount: preview?.evidenceCount ?? 0, explanation: scoreExplanation, rawExplanation: preview?.explanation ?? null, versions: { kpiCalculationVersion: kpi.calculationVersion ?? 1, scoringRuleVersion: rule?.revision ?? null, targetRevision: target?.revision ?? null, weightRevision: w.revision ?? null, profileRevision: (profile as any).updatedAt?.toISOString?.() ?? null } });
    }
    const completenessPercent = totalWeight.equals(0) ? 0 : Number(calculableWeight.div(totalWeight).mul(100).toDecimalPlaces(2).toString());
    const provisionalTotal = hasRequiredIssue ? null : Number(weightedSum.toDecimalPlaces(4).toString());
    const status = hasRequiredIssue ? "INCOMPLETE" : (weights.length === 0 ? "CONFIGURATION_MISSING" : "PREVIEW");
    return { previewOnly: true, noPersistedEvaluation: true, simulationLabel: "PREVIEW_ONLY_NOT_APPROVED", employee: personCtx.employee, performanceProfile: { id: profile.id, code: profile.code, name: profile.name, nameAr: profile.nameAr, nameEn: profile.nameEn }, period: { from: from.toISOString(), to: at.toISOString() }, readiness, kpis, completenessPercent, configuredWeightCovered: calculableWeight.toDecimalPlaces(4).toString(), missingRequiredKpis, provisionalTotal, status };
  }
}
