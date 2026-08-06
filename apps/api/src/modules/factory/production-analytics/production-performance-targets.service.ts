import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  PERFORMANCE_TARGET_AUDIT_ENTITY,
  PERFORMANCE_TARGET_NUMBER_SEQUENCE,
} from './production-analytics.constants';
import { CreatePerformanceTargetDto, UpdatePerformanceTargetDto } from './dto/performance-target.dto';
import { PerformanceTargetQueryDto } from './dto/analytics-query.dto';

export interface TargetResolutionContext {
  companyId: string;
  branchId: string;
  productionUnitId: string;
  productionLineId: string;
  machineId: string | null;
  productionProductDefinitionId: string;
  effectiveAt: Date;
}

const includeReferences = {
  productionUnit: { select: { id: true, code: true, name: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  productionProductDefinition: { select: { id: true, code: true, name: true } },
  supersedes: { select: { id: true, code: true, revision: true } },
};

const TARGET_SCOPE_RANKS: Record<string, number> = {
  MACHINE: 0,
  LINE_PRODUCT: 1,
  PRODUCT: 2,
  LINE: 3,
  UNIT: 4,
  BRANCH: 5,
  COMPANY: 6,
};

@Injectable()
export class ProductionPerformanceTargetsService {
  private readonly model: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {
    this.model = (prisma as any).productionPerformanceTarget;
  }

  async create(dto: CreatePerformanceTargetDto, userId: string, ctx: ActiveOperationalContext) {
    const normalized = await this.normalizeAndValidate(dto, ctx);
    const code = await this.numbering.generateNumberAtomic(PERFORMANCE_TARGET_NUMBER_SEQUENCE);
    const created = await this.model.create({
      data: {
        ...normalized,
        code,
        revision: 1,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'DRAFT',
        createdById: userId,
        updatedById: userId,
      },
      include: includeReferences,
    });
    await this.log(userId, 'CREATE', created, ctx);
    return created;
  }

  async findAll(query: PerformanceTargetQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.scopeType) where.scopeType = query.scopeType;
    if (query.productionUnitId) where.productionUnitId = query.productionUnitId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionProductDefinitionId) where.productionProductDefinitionId = query.productionProductDefinitionId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { productionUnit: { name: { contains: query.search } } },
        { productionLine: { name: { contains: query.search } } },
        { machine: { name: { contains: query.search } } },
        { productionProductDefinition: { name: { contains: query.search } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        include: includeReferences,
      }),
      this.model.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx, true);
  }

  async update(id: string, dto: UpdatePerformanceTargetDto, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'DRAFT') this.invalid('status', 'performanceTarget.draftOnly', 'Only draft targets can be edited');
    const merged = { ...this.materialFields(current), ...dto };
    const normalized = await this.normalizeAndValidate(merged, ctx);
    const updated = await this.model.update({
      where: { id },
      data: { ...normalized, updatedById: userId },
      include: includeReferences,
    });
    await this.log(userId, 'UPDATE', updated, ctx, { before: this.materialFields(current) });
    return updated;
  }

  async delete(id: string, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'DRAFT') this.invalid('status', 'performanceTarget.deleteOnlyDraft', 'Only draft targets can be deleted');
    const updated = await this.model.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId }, include: includeReferences });
    await this.log(userId, 'DELETE', updated, ctx);
    return updated;
  }

  async submit(id: string, userId: string, ctx: ActiveOperationalContext, requestId?: string) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'DRAFT') this.invalid('status', 'performanceTarget.submitStateInvalid', 'Only draft targets can be submitted');
    const rid = requestId || current.clientRequestId || undefined;
    const updated = await this.model.update({
      where: { id },
      data: { status: 'PENDING', submittedById: userId, submittedAt: new Date(), updatedById: userId },
      include: includeReferences,
    });
    await this.recordTransition(current, updated, 'SUBMIT', userId, ctx, rid);
    await this.log(userId, 'SUBMIT', updated, ctx);
    return updated;
  }

  async approve(id: string, userId: string, ctx: ActiveOperationalContext, approvalNote?: string, requestId?: string) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'PENDING') this.invalid('status', 'performanceTarget.approvalStateInvalid', 'Only pending targets can be approved');
    if (current.submittedById === userId) {
      throw new BadRequestException({ messageKey: 'performanceTarget.makerCheckerRequired', message: 'The submitter cannot approve their own target' });
    }
    const now = new Date();
    const result = await this.prisma.$transaction(
      async (tx) => {
        const txModel = (tx as any).productionPerformanceTarget;
        await this.assertNoApprovedOverlap(current, ctx, [current.id], txModel);
        if (current.supersedesId) {
          await txModel.updateMany({
            where: {
              id: current.supersedesId,
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              status: 'APPROVED',
              deletedAt: null,
            },
            data: {
              status: 'INACTIVE',
              deactivatedById: userId,
              deactivatedAt: now,
              deactivationReason: `REPLACED_BY_REVISION_${current.revision}`,
              updatedById: userId,
            },
          });
        }
        return txModel.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: userId,
            approvedAt: now,
            approvalNote: approvalNote ?? current.approvalNote ?? null,
            updatedById: userId,
          },
          include: includeReferences,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.recordTransition(current, result, 'APPROVE', userId, ctx, requestId, approvalNote);
    await this.log(userId, 'APPROVE', result, ctx, { approvalNote: approvalNote ?? undefined });
    if (current.supersedesId) {
      await this.audit.log(userId, 'ARCHIVE_REPLACED_REVISION', PERFORMANCE_TARGET_AUDIT_ENTITY, current.supersedesId, {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        replacedById: current.id,
      });
    }
    return result;
  }

  async deactivate(id: string, reason: string, userId: string, ctx: ActiveOperationalContext, requestId?: string) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'APPROVED') this.invalid('status', 'performanceTarget.deactivationStateInvalid', 'Only approved targets can be deactivated');
    const updated = await this.model.update({
      where: { id },
      data: { status: 'INACTIVE', deactivatedById: userId, deactivatedAt: new Date(), deactivationReason: reason, updatedById: userId },
      include: includeReferences,
    });
    await this.recordTransition(current, updated, 'DEACTIVATE', userId, ctx, requestId, reason);
    await this.log(userId, 'DEACTIVATE', updated, ctx, { reason });
    return updated;
  }

  async revise(id: string, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'APPROVED') this.invalid('status', 'performanceTarget.revisionSourceInvalid', 'Only approved targets can be revised');
    const latest = await this.model.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, code: current.code, deletedAt: null },
      orderBy: { revision: 'desc' },
    });
    if (latest?.status === 'DRAFT') throw new ConflictException({ messageKey: 'performanceTarget.draftRevisionExists', message: 'A draft revision already exists' });
    const created = await this.model.create({
      data: {
        ...this.materialFields(current),
        code: current.code,
        revision: (latest?.revision || current.revision) + 1,
        supersedesId: current.id,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'DRAFT',
        createdById: userId,
        updatedById: userId,
      },
      include: includeReferences,
    });
    await this.log(userId, 'REVISE', created, ctx, { supersedesId: current.id });
    return created;
  }

  async history(id: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    const revisions = await this.model.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, code: current.code, deletedAt: null },
      orderBy: { revision: 'asc' },
      include: includeReferences,
    });
    const transitions = await (this.prisma as any).productionPerformanceTargetTransition.findMany({
      where: { targetId: { in: revisions.map((item: any) => item.id) }, companyId: ctx.companyId, branchId: ctx.branchId },
      orderBy: { createdAt: 'asc' },
    });
    const audits = await (this.prisma as any).auditLog.findMany({
      where: { entity: PERFORMANCE_TARGET_AUDIT_ENTITY, entityId: { in: revisions.map((item: any) => item.id) } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, action: true, entityId: true, details: true, createdAt: true },
    });
    return { code: current.code, revisions, transitions, audits };
  }

  /**
   * Resolves the most specific approved target for a run context at a point in time.
   * Precedence (most specific first): machine+product → line+product → product →
   * line → unit → branch → company. Multiple matches at the same rank fail as ambiguous.
   */
  async resolveForRun(ctx: TargetResolutionContext, client: any = this.prisma) {
    const model = (client as any).productionPerformanceTarget;
    const candidates = await model.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'APPROVED',
        deletedAt: null,
        effectiveFrom: { lte: ctx.effectiveAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: ctx.effectiveAt } }],
      },
      include: includeReferences,
    });
    return this.resolveCanonical(candidates, ctx);
  }

  /**
   * Bulk resolution for analytics: prefetches every approved target overlapping the
   * window once, then resolves each run in memory with the exact same canonical
   * resolver as resolveForRun (precedence, per-run effective-at, ambiguity fails).
   */
  async resolveForRuns(runs: Array<{ startedAt: Date | null; productionUnitId: string; productionLineId: string; machineId: string | null; productionProductDefinitionId: string }>, ctx: { companyId: string; branchId: string }, from: Date, to: Date) {
    const targets = await this.model.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'APPROVED',
        deletedAt: null,
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }],
      },
      include: includeReferences,
    });
    return runs.map((run) =>
      this.resolveCanonical(targets, {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        productionUnitId: run.productionUnitId,
        productionLineId: run.productionLineId,
        machineId: run.machineId,
        productionProductDefinitionId: run.productionProductDefinitionId,
        effectiveAt: run.startedAt ?? new Date(),
      }),
    );
  }

  /**
   * Canonical resolution shared by the single and bulk paths. Applies the same
   * contract in both: status/effective-at eligibility, scope precedence, and a
   * conflict when multiple approved targets share the most specific rank. A tie
   * is never resolved by revision, database order, or any other hidden rule.
   */
  private resolveCanonical(candidates: any[], ctx: TargetResolutionContext): any {
    const at = ctx.effectiveAt.getTime();
    const ranked: Record<number, any[]> = {};
    for (const candidate of candidates) {
      if (candidate.companyId !== ctx.companyId || candidate.branchId !== ctx.branchId) continue;
      if (candidate.status !== 'APPROVED' || candidate.deletedAt) continue;
      const from = candidate.effectiveFrom ? new Date(candidate.effectiveFrom).getTime() : null;
      const to = candidate.effectiveTo ? new Date(candidate.effectiveTo).getTime() : null;
      if (from !== null && from > at) continue;
      if (to !== null && to <= at) continue;
      const rank = this.scopeRank(candidate, ctx);
      if (rank === null) continue;
      if (!ranked[rank]) ranked[rank] = [];
      ranked[rank].push(candidate);
    }
    const ranks = Object.keys(ranked).map(Number).sort((a, b) => a - b);
    if (ranks.length === 0) return null;
    const matches = ranked[ranks[0]];
    if (matches.length > 1) {
      throw new ConflictException({
        messageKey: 'performanceTarget.ambiguousResolution',
        message: 'Multiple approved targets match the same resolution precedence',
      });
    }
    return matches[0];
  }

  private scopeRank(target: any, ctx: TargetResolutionContext): number | null {
    const scopeType = target.scopeType;
    if (scopeType === 'COMPANY') return TARGET_SCOPE_RANKS.COMPANY;
    if (scopeType === 'BRANCH') return TARGET_SCOPE_RANKS.BRANCH;
    if (scopeType === 'UNIT') {
      if (target.productionUnitId !== ctx.productionUnitId) return null;
      return TARGET_SCOPE_RANKS.UNIT;
    }
    if (scopeType === 'LINE') {
      if (target.productionLineId !== ctx.productionLineId) return null;
      if (target.productionProductDefinitionId) {
        return target.productionProductDefinitionId === ctx.productionProductDefinitionId ? TARGET_SCOPE_RANKS.LINE_PRODUCT : null;
      }
      return TARGET_SCOPE_RANKS.LINE;
    }
    if (scopeType === 'MACHINE') {
      if (!ctx.machineId || target.machineId !== ctx.machineId) return null;
      if (target.productionProductDefinitionId) {
        return target.productionProductDefinitionId === ctx.productionProductDefinitionId ? TARGET_SCOPE_RANKS.MACHINE : null;
      }
      return TARGET_SCOPE_RANKS.MACHINE;
    }
    if (scopeType === 'PRODUCT') {
      if (target.productionProductDefinitionId !== ctx.productionProductDefinitionId) return null;
      return TARGET_SCOPE_RANKS.PRODUCT;
    }
    return null;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext, include = false) {
    const record = await this.model.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      ...(include ? { include: includeReferences } : {}),
    });
    if (!record) throw new NotFoundException({ messageKey: 'performanceTarget.notFound', message: 'Performance target not found' });
    return record;
  }

  private async normalizeAndValidate(dto: any, ctx: ActiveOperationalContext) {
    this.assertScope(dto);
    await this.validateReferences(dto, ctx);
    const effectiveFrom = dto.effectiveFrom instanceof Date ? dto.effectiveFrom : new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? (dto.effectiveTo instanceof Date ? dto.effectiveTo : new Date(dto.effectiveTo)) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) this.invalid('effectiveTo', 'performanceTarget.invalidEffectiveRange', 'Effective-to must be later than effective-from');
    return {
      scopeType: dto.scopeType,
      productionUnitId: dto.productionUnitId || null,
      productionLineId: dto.productionLineId || null,
      machineId: dto.machineId || null,
      productionProductDefinitionId: dto.productionProductDefinitionId || null,
      availabilityTarget: this.percentage(dto.availabilityTarget, 'availabilityTarget'),
      performanceTarget: this.percentage(dto.performanceTarget, 'performanceTarget'),
      qualityTarget: this.percentage(dto.qualityTarget, 'qualityTarget'),
      oeeTarget: this.percentage(dto.oeeTarget, 'oeeTarget'),
      effectiveFrom,
      effectiveTo,
      approvalNote: dto.approvalNote || null,
      notes: dto.notes || null,
    };
  }

  private assertScope(dto: any) {
    const scopeType = dto.scopeType;
    const has = {
      unit: Boolean(dto.productionUnitId),
      line: Boolean(dto.productionLineId),
      machine: Boolean(dto.machineId),
      product: Boolean(dto.productionProductDefinitionId),
    };
    const count = Number(has.unit) + Number(has.line) + Number(has.machine) + Number(has.product);
    if (scopeType === 'COMPANY' || scopeType === 'BRANCH') {
      if (count !== 0) this.invalid('scopeType', 'performanceTarget.scopeXor', `${scopeType} scope must not carry a dimension`);
      return;
    }
    const expected: Record<string, string> = {
      UNIT: 'productionUnitId',
      LINE: 'productionLineId',
      MACHINE: 'machineId',
      PRODUCT: 'productionProductDefinitionId',
    };
    const requiredField = expected[scopeType];
    if (!requiredField) this.invalid('scopeType', 'performanceTarget.scopeTypeInvalid', 'Unknown scope type');
    if (count !== 1 || !dto[requiredField]) this.invalid('scopeType', 'performanceTarget.scopeXor', 'Exactly one dimension matching the scope type is required');
  }

  private async validateReferences(dto: any, ctx: ActiveOperationalContext, client: any = this.prisma) {
    if (dto.productionUnitId) {
      const unit = await client.productionUnit.findFirst({ where: { id: dto.productionUnitId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
      if (!unit) this.invalid('productionUnitId', 'performanceTarget.unitInvalid', 'Production unit is not active in the current context');
    }
    if (dto.productionLineId) {
      const line = await client.productionLine.findFirst({ where: { id: dto.productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
      if (!line) this.invalid('productionLineId', 'performanceTarget.lineInvalid', 'Production line is not active in the current context');
    }
    if (dto.machineId) {
      const machine = await client.machine.findFirst({ where: { id: dto.machineId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
      if (!machine) this.invalid('machineId', 'performanceTarget.machineInvalid', 'Machine is not active in the current context');
    }
    if (dto.productionProductDefinitionId) {
      const product = await client.productionProductDefinition.findFirst({ where: { id: dto.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
      if (!product) this.invalid('productionProductDefinitionId', 'performanceTarget.productInvalid', 'Production product is not active in the current context');
    }
  }

  private async assertNoApprovedOverlap(candidate: any, ctx: ActiveOperationalContext, excludedIds: string[], model: any = this.model) {
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      scopeType: candidate.scopeType,
      productionUnitId: candidate.productionUnitId || null,
      productionLineId: candidate.productionLineId || null,
      machineId: candidate.machineId || null,
      productionProductDefinitionId: candidate.productionProductDefinitionId || null,
      status: 'APPROVED',
      deletedAt: null,
      id: { notIn: excludedIds },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: candidate.effectiveFrom } }],
    };
    if (candidate.effectiveTo) where.effectiveFrom = { lt: candidate.effectiveTo };
    if (await model.findFirst({ where, select: { id: true } })) {
      throw new ConflictException({ messageKey: 'performanceTarget.approvedOverlap', message: 'An approved target already overlaps the same scope and effective period' });
    }
  }

  private percentage(value: any, field: string) {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.greaterThan(0)) this.invalid(field, 'performanceTarget.mustBePositive', `${field} must be greater than zero`);
    if (decimal.greaterThan(100)) this.invalid(field, 'performanceTarget.percentageRange', `${field} must not exceed 100`);
    return decimal.toDecimalPlaces(4);
  }

  private materialFields(record: any) {
    return {
      scopeType: record.scopeType,
      productionUnitId: record.productionUnitId,
      productionLineId: record.productionLineId,
      machineId: record.machineId,
      productionProductDefinitionId: record.productionProductDefinitionId,
      availabilityTarget: record.availabilityTarget,
      performanceTarget: record.performanceTarget,
      qualityTarget: record.qualityTarget,
      oeeTarget: record.oeeTarget,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
      approvalNote: record.approvalNote,
      notes: record.notes,
    };
  }

  private async recordTransition(
    before: any,
    after: any,
    action: string,
    userId: string,
    ctx: ActiveOperationalContext,
    requestId?: string,
    reason?: string,
  ) {
    await (this.prisma as any).productionPerformanceTargetTransition.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        targetId: after.id,
        fromStatus: before.status,
        toStatus: after.status,
        action,
        actorId: userId,
        reason: reason || null,
        requestId: requestId || `${action}_${after.id}_${Date.now()}`,
      },
    });
  }

  private invalid(field: string, code: string, message: string): never {
    throw new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: [{ field, code, message }] });
  }

  private log(userId: string, action: string, record: any, ctx: ActiveOperationalContext, extra: Record<string, any> = {}) {
    return this.audit.log(userId, action, PERFORMANCE_TARGET_AUDIT_ENTITY, record.id, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      code: record.code,
      revision: record.revision,
      ...extra,
    });
  }
}
