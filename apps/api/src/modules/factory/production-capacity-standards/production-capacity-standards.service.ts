import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CreateProductionCapacityStandardDto } from './dto/create-production-capacity-standard.dto';
import { UpdateProductionCapacityStandardDto } from './dto/update-production-capacity-standard.dto';
import { ProductionCapacityStandardQueryDto } from './dto/production-capacity-standard-query.dto';
import { ResolveProductionCapacityStandardDto } from './dto/resolve-production-capacity-standard.dto';
import { CAPACITY_AUDIT_ENTITY, CAPACITY_NUMBER_SEQUENCE } from './production-capacity.constants';

const includeReferences = {
  productionProduct: { select: { id: true, code: true, name: true } },
  productionVersion: { select: { id: true, versionNumber: true, versionLabel: true } },
  productionPackaging: { select: { id: true, packagingType: true, packQuantity: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
};

@Injectable()
export class ProductionCapacityStandardsService {
  private readonly model: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {
    this.model = (prisma as any).productionCapacityStandard;
  }

  async create(dto: CreateProductionCapacityStandardDto, userId: string, ctx: ActiveOperationalContext) {
    const normalized = await this.normalizeAndValidate(dto, ctx);
    const code = await this.numbering.generateNumberAtomic(CAPACITY_NUMBER_SEQUENCE);
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
        lastMateriallyEditedById: userId,
      },
      include: includeReferences,
    });
    await this.log(userId, 'CREATE', created, ctx);
    return created;
  }

  async findAll(query: ProductionCapacityStandardQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.productionProductId) where.productionProductId = query.productionProductId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.outputUnit) where.outputUnit = query.outputUnit;
    if (query.timeBasis) where.timeBasis = query.timeBasis;
    if (query.search) where.OR = [
      { code: { contains: query.search } },
      { sourceReference: { contains: query.search } },
      { productionProduct: { name: { contains: query.search } } },
    ];
    const [data, total] = await Promise.all([
      this.model.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ createdAt: 'desc' }], include: includeReferences }),
      this.model.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx, true);
  }

  async update(id: string, dto: UpdateProductionCapacityStandardDto, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'DRAFT') this.invalid('status', 'capacityStandard.draftOnly', 'Only draft standards can be edited');
    const normalized = await this.normalizeAndValidate({ ...this.materialFields(current), ...dto }, ctx);
    const updated = await this.model.update({
      where: { id },
      data: { ...normalized, updatedById: userId, lastMateriallyEditedById: userId },
      include: includeReferences,
    });
    await this.log(userId, 'UPDATE', updated, ctx, { before: this.materialFields(current) });
    return updated;
  }

  async revise(id: string, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (!['APPROVED', 'SUSPENDED'].includes(current.status)) this.invalid('status', 'capacityStandard.revisionSourceInvalid', 'Only approved or suspended standards can be revised');
    const latest = await this.model.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, code: current.code, deletedAt: null },
      orderBy: { revision: 'desc' },
    });
    if (latest?.status === 'DRAFT') throw new ConflictException({ messageKey: 'capacityStandard.draftRevisionExists', message: 'A draft revision already exists' });
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
        lastMateriallyEditedById: userId,
      },
      include: includeReferences,
    });
    await this.log(userId, 'REVISE', created, ctx, { supersedesId: current.id });
    return created;
  }

  async approve(id: string, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'DRAFT') this.invalid('status', 'capacityStandard.approvalStateInvalid', 'Only draft standards can be approved');
    if (current.lastMateriallyEditedById === userId) throw new BadRequestException({ messageKey: 'capacityStandard.makerCheckerRequired', message: 'The maker or last material editor cannot approve this standard' });
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const txModel = (tx as any).productionCapacityStandard;
      await this.assertNoApprovedOverlap(current, ctx, [current.id, current.supersedesId].filter(Boolean), txModel);
      if (current.supersedesId) {
        await txModel.updateMany({
          where: { id: current.supersedesId, companyId: ctx.companyId, branchId: ctx.branchId, status: { in: ['APPROVED', 'SUSPENDED'] }, deletedAt: null },
          data: { status: 'ARCHIVED', archivedById: userId, archivedAt: now, archiveReason: `REPLACED_BY_REVISION_${current.revision}`, updatedById: userId },
        });
      }
      return txModel.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: userId, approvedAt: now, suspendedById: null, suspendedAt: null, suspensionReason: null, updatedById: userId },
        include: includeReferences,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.log(userId, 'APPROVE', result, ctx);
    if (current.supersedesId) await this.audit.log(userId, 'ARCHIVE_REPLACED_REVISION', CAPACITY_AUDIT_ENTITY, current.supersedesId, { companyId: ctx.companyId, branchId: ctx.branchId, replacedById: current.id });
    return result;
  }

  async suspend(id: string, reason: string, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'APPROVED') this.invalid('status', 'capacityStandard.suspensionStateInvalid', 'Only approved standards can be suspended');
    const updated = await this.model.update({ where: { id }, data: { status: 'SUSPENDED', suspendedById: userId, suspendedAt: new Date(), suspensionReason: reason, updatedById: userId }, include: includeReferences });
    await this.log(userId, 'SUSPEND', updated, ctx, { reason });
    return updated;
  }

  async reactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status !== 'SUSPENDED') this.invalid('status', 'capacityStandard.reactivationStateInvalid', 'Only suspended standards can be reactivated');
    const updated = await this.prisma.$transaction(async (tx) => {
      const txModel = (tx as any).productionCapacityStandard;
      await this.assertNoApprovedOverlap(current, ctx, [current.id], txModel);
      return txModel.update({ where: { id }, data: { status: 'APPROVED', suspendedById: null, suspendedAt: null, suspensionReason: null, updatedById: userId }, include: includeReferences });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.log(userId, 'REACTIVATE', updated, ctx);
    return updated;
  }

  async archive(id: string, reason: string, userId: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    if (current.status === 'ARCHIVED') this.invalid('status', 'capacityStandard.alreadyArchived', 'The standard is already archived');
    const updated = await this.model.update({ where: { id }, data: { status: 'ARCHIVED', archivedById: userId, archivedAt: new Date(), archiveReason: reason, updatedById: userId }, include: includeReferences });
    await this.log(userId, 'ARCHIVE', updated, ctx, { reason });
    return updated;
  }

  async resolve(query: ResolveProductionCapacityStandardDto, ctx: ActiveOperationalContext) {
    return this.resolveWithClient(query, ctx, this.prisma);
  }

  async resolveWithClient(query: ResolveProductionCapacityStandardDto, ctx: ActiveOperationalContext, client: any) {
    await this.validateReferences(query, ctx, client);
    const requestedAt = new Date(query.requestedAt);
    const base: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      productionProductId: query.productionProductId,
      productionVersionId: query.productionVersionId || null,
      productionPackagingId: query.productionPackagingId || null,
      productionLineId: query.productionLineId,
      outputUnit: query.outputUnit,
      timeBasis: query.timeBasis,
      status: 'APPROVED',
      deletedAt: null,
      effectiveFrom: { lte: requestedAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: requestedAt } }],
    };
    if (query.machineId) {
      const exact = await this.resolveRank({ ...base, machineId: query.machineId }, 'MACHINE', client.productionCapacityStandard);
      if (exact) return exact;
    }
    const line = await this.resolveRank({ ...base, machineId: null }, 'LINE', client.productionCapacityStandard);
    if (line) return line;
    throw new NotFoundException({ messageKey: 'capacityStandard.notConfigured' });
  }

  async history(id: string, ctx: ActiveOperationalContext) {
    const current = await this.findOwned(id, ctx);
    const revisions = await this.model.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, code: current.code, deletedAt: null },
      orderBy: { revision: 'asc' },
      include: includeReferences,
    });
    const audits = await (this.prisma as any).auditLog.findMany({
      where: { entity: CAPACITY_AUDIT_ENTITY, entityId: { in: revisions.map((item: any) => item.id) } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, userId: true, action: true, entityId: true, details: true, createdAt: true },
    });
    return { code: current.code, revisions, audits };
  }

  private async resolveRank(where: any, matchedScope: 'MACHINE' | 'LINE', model: any = this.model) {
    const matches = await model.findMany({ where, take: 2, orderBy: [{ effectiveFrom: 'desc' }, { revision: 'desc' }], include: includeReferences });
    if (matches.length > 1) throw new ConflictException({ messageKey: 'capacityStandard.ambiguousResolution', message: 'Multiple approved standards match the same resolution rank' });
    return matches[0] ? { ...matches[0], matchedScope } : null;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext, include = false) {
    const record = await this.model.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null }, ...(include ? { include: includeReferences } : {}) });
    if (!record) throw new NotFoundException({ messageKey: 'capacityStandard.notFound', message: 'Capacity standard not found' });
    return record;
  }

  private async normalizeAndValidate(dto: any, ctx: ActiveOperationalContext) {
    await this.validateReferences(dto, ctx);
    const effectiveFrom = dto.effectiveFrom instanceof Date ? dto.effectiveFrom : new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? (dto.effectiveTo instanceof Date ? dto.effectiveTo : new Date(dto.effectiveTo)) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) this.invalid('effectiveTo', 'capacityStandard.invalidEffectiveRange', 'Effective-to must be later than effective-from');
    const standardRate = this.positiveDecimal(dto.standardRate, 'standardRate');
    const targetEfficiencyPercent = this.percentage(dto.targetEfficiencyPercent, 'targetEfficiencyPercent');
    const expectedYieldPercent = this.percentage(dto.expectedYieldPercent, 'expectedYieldPercent');
    const standardCycleTimeMinutes = dto.standardCycleTimeMinutes ? this.positiveDecimal(dto.standardCycleTimeMinutes, 'standardCycleTimeMinutes') : null;
    const nonNegative = (value: any, field: string) => {
      const decimal = new Prisma.Decimal(value ?? '0');
      if (decimal.isNegative()) this.invalid(field, 'capacityStandard.mustBeNonNegative', `${field} must be non-negative`);
      return decimal;
    };
    return {
      productionProductId: dto.productionProductId,
      productionVersionId: dto.productionVersionId || null,
      productionPackagingId: dto.productionPackagingId || null,
      productionLineId: dto.productionLineId,
      machineId: dto.machineId || null,
      standardRate,
      outputUnit: dto.outputUnit,
      timeBasis: dto.timeBasis,
      standardCycleTimeMinutes,
      setupMinutes: nonNegative(dto.setupMinutes, 'setupMinutes'),
      changeoverMinutes: nonNegative(dto.changeoverMinutes, 'changeoverMinutes'),
      cleaningMinutes: nonNegative(dto.cleaningMinutes, 'cleaningMinutes'),
      startupAllowanceMinutes: nonNegative(dto.startupAllowanceMinutes, 'startupAllowanceMinutes'),
      shutdownAllowanceMinutes: nonNegative(dto.shutdownAllowanceMinutes, 'shutdownAllowanceMinutes'),
      targetEfficiencyPercent,
      expectedYieldPercent,
      sourceType: dto.sourceType,
      sourceReference: dto.sourceReference || null,
      notes: dto.notes || null,
      effectiveFrom,
      effectiveTo,
    };
  }

  private async validateReferences(dto: any, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const product = await client.productionProductDefinition.findFirst({ where: { id: dto.productionProductId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
    if (!product) this.invalid('productionProductId', 'capacityStandard.productInvalid', 'Production product is not active in the current context');
    if (dto.productionVersionId) {
      const version = await client.productionVersion.findFirst({ where: { id: dto.productionVersionId, productionProductId: dto.productionProductId, status: 'ACTIVE' } });
      if (!version) this.invalid('productionVersionId', 'capacityStandard.versionInvalid', 'Production version is not active for the selected product');
    }
    if (dto.productionPackagingId) {
      const packaging = await client.productionPackaging.findFirst({ where: { id: dto.productionPackagingId, productionProductId: dto.productionProductId, status: 'ACTIVE' } });
      if (!packaging) this.invalid('productionPackagingId', 'capacityStandard.packagingInvalid', 'Production packaging is not active for the selected product');
    }
    const line = await client.productionLine.findFirst({ where: { id: dto.productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
    if (!line) this.invalid('productionLineId', 'capacityStandard.lineInvalid', 'Production line is not active in the current context');
    if (dto.machineId) {
      const machine = await client.machine.findFirst({ where: { id: dto.machineId, companyId: ctx.companyId, branchId: ctx.branchId, productionLineId: dto.productionLineId, status: 'ACTIVE', deletedAt: null } });
      if (!machine) this.invalid('machineId', 'capacityStandard.machineInvalid', 'Machine is not active on the selected line in the current context');
    }
    const eligibility = await client.productionEligibility.findFirst({
      where: dto.machineId
        ? { productionProductId: dto.productionProductId, resourceType: 'MACHINE', machineId: dto.machineId, status: 'ACTIVE' }
        : { productionProductId: dto.productionProductId, resourceType: 'LINE', productionLineId: dto.productionLineId, status: 'ACTIVE' },
    });
    if (!eligibility) this.invalid(dto.machineId ? 'machineId' : 'productionLineId', 'capacityStandard.eligibilityRequired', 'The product must have an active eligibility for the selected resource');
  }

  private async assertNoApprovedOverlap(candidate: any, ctx: ActiveOperationalContext, excludedIds: string[], model: any = this.model) {
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      productionProductId: candidate.productionProductId,
      productionVersionId: candidate.productionVersionId || null,
      productionPackagingId: candidate.productionPackagingId || null,
      productionLineId: candidate.productionLineId,
      machineId: candidate.machineId || null,
      outputUnit: candidate.outputUnit,
      timeBasis: candidate.timeBasis,
      status: 'APPROVED',
      deletedAt: null,
      id: { notIn: excludedIds },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: candidate.effectiveFrom } }],
    };
    if (candidate.effectiveTo) where.effectiveFrom = { lt: candidate.effectiveTo };
    if (await model.findFirst({ where, select: { id: true } })) throw new ConflictException({ messageKey: 'capacityStandard.approvedOverlap', message: 'An approved standard already overlaps the same business key and effective period' });
  }

  private positiveDecimal(value: any, field: string) {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.greaterThan(0)) this.invalid(field, 'capacityStandard.mustBePositive', `${field} must be greater than zero`);
    return decimal;
  }

  private percentage(value: any, field: string) {
    const decimal = this.positiveDecimal(value, field);
    if (decimal.greaterThan(100)) this.invalid(field, 'capacityStandard.percentageRange', `${field} must not exceed 100`);
    return decimal;
  }

  private materialFields(record: any) {
    return {
      productionProductId: record.productionProductId,
      productionVersionId: record.productionVersionId,
      productionPackagingId: record.productionPackagingId,
      productionLineId: record.productionLineId,
      machineId: record.machineId,
      standardRate: record.standardRate,
      outputUnit: record.outputUnit,
      timeBasis: record.timeBasis,
      standardCycleTimeMinutes: record.standardCycleTimeMinutes,
      setupMinutes: record.setupMinutes,
      changeoverMinutes: record.changeoverMinutes,
      cleaningMinutes: record.cleaningMinutes,
      startupAllowanceMinutes: record.startupAllowanceMinutes,
      shutdownAllowanceMinutes: record.shutdownAllowanceMinutes,
      targetEfficiencyPercent: record.targetEfficiencyPercent,
      expectedYieldPercent: record.expectedYieldPercent,
      sourceType: record.sourceType,
      sourceReference: record.sourceReference,
      notes: record.notes,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
    };
  }

  private invalid(field: string, code: string, message: string): never {
    throw new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: [{ field, code, message }] });
  }

  private log(userId: string, action: string, record: any, ctx: ActiveOperationalContext, extra: Record<string, any> = {}) {
    return this.audit.log(userId, action, CAPACITY_AUDIT_ENTITY, record.id, { companyId: ctx.companyId, branchId: ctx.branchId, code: record.code, revision: record.revision, ...extra });
  }
}
