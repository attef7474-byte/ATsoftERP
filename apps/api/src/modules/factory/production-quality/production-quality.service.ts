import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  NCR_TRANSITION_RULES,
  PRODUCTION_INSPECTION_AUDIT_ENTITY,
  PRODUCTION_INSPECTION_INCLUDE,
  PRODUCTION_NCR_AUDIT_ENTITY,
  PRODUCTION_NCR_INCLUDE,
  PRODUCTION_QUALITY_AUDIT_ENTITY,
  PRODUCTION_QUALITY_PLAN_INCLUDE,
} from './production-quality.constants';
import {
  CreateCharacteristicDto,
  CreateQualityPlanDto,
  CreateSamplingPointDto,
  DeactivateQualityPlanDto,
  QualityPlanQueryDto,
  RejectQualityPlanDto,
  UpdateQualityPlanDto,
} from './dto/quality-plan.dto';
import {
  ApproveDispositionDto,
  CreateDispositionDto,
  CreateInspectionDto,
  InspectionQueryDto,
  InspectionResultEntryDto,
  RecordInspectionResultsDto,
  RejectDispositionDto,
} from './dto/inspection.dto';
import { CreateNcrDto, NcrAttachDto, NcrQueryDto, NcrTransitionDto } from './dto/ncr.dto';

const PLAN_NUMBER_SEQUENCE = 'PRODUCTION_QUALITY_PLAN';
const INSPECTION_NUMBER_SEQUENCE = 'PRODUCTION_INSPECTION';
const NCR_NUMBER_SEQUENCE = 'PRODUCTION_NCR';

@Injectable()
export class ProductionQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberingService: NumberingService,
  ) {}

  private notFound(key: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message: key });
  }

  private badRequest(key: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message: key });
  }

  private conflict(key: string): ConflictException {
    return new ConflictException({ messageKey: key, message: key });
  }

  private writeAudit(
    client: any,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    ctx: ActiveOperationalContext,
    details: Record<string, any>,
  ) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────

  private async findPlan(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const plan = await client.productionQualityPlan.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: PRODUCTION_QUALITY_PLAN_INCLUDE,
    });
    if (!plan) throw this.notFound('productionQualityPlan.notFound');
    return plan;
  }

  private async assertTenantScoped(client: any, model: string, id: string, ctx: ActiveOperationalContext, errorKey: string) {
    const record = await client[model].findUnique({ where: { id } });
    if (!record) throw this.notFound(errorKey);
    if (record.companyId !== ctx.companyId) throw this.badRequest('common.tenantMismatch');
    if (record.branchId && record.branchId !== ctx.branchId) throw this.badRequest('common.branchMismatch');
    return record;
  }

  /** Product is an approved global catalog. Operational ownership is enforced by
   * the tenant-owned plan/inspection around it, so requiring Product.companyId
   * would deny every valid product because the model intentionally has no tenant
   * columns. Deleted catalog entries are never accepted for new operations. */
  private async assertGlobalProduct(client: any, id: string, errorKey: string) {
    const product = await client.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw this.notFound(errorKey);
    return product;
  }

  /** ProductionVersion and ProductionPackaging derive tenant ownership from their
   * ProductionProductDefinition parent. Neither child has direct tenant columns. */
  private async assertDerivedProductReference(
    client: any,
    model: 'productionVersion' | 'productionPackaging',
    id: string,
    ctx: ActiveOperationalContext,
    errorKey: string,
    expectedDefinitionId?: string,
  ) {
    const record = await client[model].findUnique({ where: { id } });
    if (!record) throw this.notFound(errorKey);
    const definition = await client.productionProductDefinition.findFirst({
      where: {
        id: record.productionProductId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
      },
    });
    if (!definition || (expectedDefinitionId && definition.id !== expectedDefinitionId)) {
      throw this.notFound(errorKey);
    }
    return record;
  }

  private async resolvePlanLinks(dto: CreateQualityPlanDto, ctx: ActiveOperationalContext, client: any) {
    const definition = await client.productionProductDefinition.findFirst({
      where: { id: dto.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!definition) throw this.notFound('productionQualityPlan.productDefinitionNotFound');

    const links: Record<string, string | null> = {};
    if (dto.productionVersionId) {
      links.productionVersionId = (await this.assertDerivedProductReference(
        client,
        'productionVersion',
        dto.productionVersionId,
        ctx,
        'productionQualityPlan.versionNotFound',
        definition.id,
      )).id;
    }
    if (dto.productionPackagingId) {
      links.productionPackagingId = (await this.assertDerivedProductReference(
        client,
        'productionPackaging',
        dto.productionPackagingId,
        ctx,
        'productionQualityPlan.packagingNotFound',
        definition.id,
      )).id;
    }
    if (dto.productionLineId) links.productionLineId = (await this.assertTenantScoped(client, 'productionLine', dto.productionLineId, ctx, 'productionQualityPlan.lineNotFound')).id;
    if (dto.machineId) links.machineId = (await this.assertTenantScoped(client, 'machine', dto.machineId, ctx, 'productionQualityPlan.machineNotFound')).id;
    if (dto.costCenterId) links.costCenterId = (await this.assertTenantScoped(client, 'costCenter', dto.costCenterId, ctx, 'productionQualityPlan.costCenterNotFound')).id;
    return { definition, links };
  }

  // ── Quality plans ───────────────────────────────────────────────────────────

  async createPlan(dto: CreateQualityPlanDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const { links } = await this.resolvePlanLinks(dto, ctx, tx);
      const code = await this.numberingService.generateNumberAtomicWithClient(PLAN_NUMBER_SEQUENCE, tx);
      const plan = await tx.productionQualityPlan.create({
        data: {
          code,
          revision: 1,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          productionProductDefinitionId: dto.productionProductDefinitionId,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          status: 'DRAFT',
          notes: dto.notes ?? null,
          createdById: userId,
          updatedById: userId,
          ...links,
        },
        include: PRODUCTION_QUALITY_PLAN_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'PLAN_CREATE', PRODUCTION_QUALITY_AUDIT_ENTITY, plan.id, ctx, {
        code: plan.code,
        revision: plan.revision,
        productionProductDefinitionId: plan.productionProductDefinitionId,
      });
      return plan;
    });
  }

  async findPlans(query: QualityPlanQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.productionProductDefinitionId) where.productionProductDefinitionId = query.productionProductDefinitionId;
    if (query.search) where.code = { contains: query.search };

    const [data, total] = await Promise.all([
      (this.prisma as any).productionQualityPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: PRODUCTION_QUALITY_PLAN_INCLUDE,
      }),
      (this.prisma as any).productionQualityPlan.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOnePlan(id: string, ctx: ActiveOperationalContext) {
    return this.findPlan(id, ctx);
  }

  async updatePlan(id: string, dto: UpdateQualityPlanDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(id, ctx, tx);
      if (plan.status !== 'DRAFT') throw this.badRequest('productionQualityPlan.notDraft');

      const updated = await tx.productionQualityPlan.update({
        where: { id },
        data: {
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : plan.effectiveFrom,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : plan.effectiveTo,
          notes: dto.notes ?? plan.notes,
          updatedById: userId,
        },
        include: PRODUCTION_QUALITY_PLAN_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'PLAN_UPDATE', PRODUCTION_QUALITY_AUDIT_ENTITY, id, ctx, { code: plan.code });
      return updated;
    });
  }

  async submitPlan(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(id, ctx, tx);
      if (plan.status !== 'DRAFT') throw this.badRequest('productionQualityPlan.submitOnlyDraft');
      const updated = await tx.productionQualityPlan.update({
        where: { id },
        data: { status: 'PENDING', updatedById: userId },
        include: PRODUCTION_QUALITY_PLAN_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'PLAN_SUBMIT', PRODUCTION_QUALITY_AUDIT_ENTITY, id, ctx, { code: plan.code });
      return updated;
    });
  }

  async approvePlan(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(id, ctx, tx);
      if (plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.approveOnlyPending');
      const activeCharacteristics = (plan.characteristics ?? []).filter((c: any) => c.status === 'ACTIVE');
      if (activeCharacteristics.length === 0) throw this.badRequest('productionQualityPlan.approveRequiresCharacteristics');

      const approved = await tx.productionQualityPlan.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
          updatedById: userId,
        },
        include: PRODUCTION_QUALITY_PLAN_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'PLAN_APPROVE', PRODUCTION_QUALITY_AUDIT_ENTITY, id, ctx, {
        code: plan.code,
        revision: plan.revision,
        characteristicCount: activeCharacteristics.length,
      });
      return approved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async rejectPlan(id: string, dto: RejectQualityPlanDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(id, ctx, tx);
      if (plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.rejectOnlyPending');
      const rejected = await tx.productionQualityPlan.update({
        where: { id },
        data: {
          status: 'DRAFT',
          rejectedById: userId,
          rejectedAt: new Date(),
          rejectionReason: dto.reason,
          updatedById: userId,
        },
        include: PRODUCTION_QUALITY_PLAN_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'PLAN_REJECT', PRODUCTION_QUALITY_AUDIT_ENTITY, id, ctx, {
        code: plan.code,
        reason: dto.reason,
      });
      return rejected;
    });
  }

  async deactivatePlan(id: string, dto: DeactivateQualityPlanDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(id, ctx, tx);
      if (plan.status !== 'APPROVED') throw this.badRequest('productionQualityPlan.deactivateOnlyApproved');
      const deactivated = await tx.productionQualityPlan.update({
        where: { id },
        data: {
          status: 'INACTIVE',
          deactivatedById: userId,
          deactivatedAt: new Date(),
          deactivationReason: dto.reason,
          updatedById: userId,
        },
        include: PRODUCTION_QUALITY_PLAN_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'PLAN_DEACTIVATE', PRODUCTION_QUALITY_AUDIT_ENTITY, id, ctx, {
        code: plan.code,
        reason: dto.reason,
      });
      return deactivated;
    });
  }

  async deletePlan(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(id, ctx, tx);
      if (plan.status !== 'DRAFT') throw this.badRequest('productionQualityPlan.deleteOnlyDraft');
      const deleted = await tx.productionQualityPlan.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: userId },
      });
      await this.writeAudit(tx, userId, 'PLAN_DELETE', PRODUCTION_QUALITY_AUDIT_ENTITY, id, ctx, { code: plan.code });
      return deleted;
    });
  }

  // ── Characteristics ─────────────────────────────────────────────────────────

  async createCharacteristic(planId: string, dto: CreateCharacteristicDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(planId, ctx, tx);
      if (plan.status !== 'DRAFT' && plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.notDraft');

      let productionUnitId: string | null = null;
      if (dto.productionUnitId) {
        productionUnitId = (await this.assertTenantScoped(tx, 'productionUnit', dto.productionUnitId, ctx, 'productionQualityPlan.unitNotFound')).id;
      }

      const last = await tx.qualityCharacteristic.findFirst({
        where: { planId, deletedAt: null },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      const characteristic = await tx.qualityCharacteristic.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          planId,
          sequence: (last?.sequence ?? 0) + 1,
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          characteristicType: dto.characteristicType ?? 'NUMERIC',
          unit: dto.unit ?? null,
          productionUnitId,
          lowerLimit: dto.lowerLimit != null ? new Prisma.Decimal(dto.lowerLimit.toFixed(4)) : null,
          targetValue: dto.targetValue != null ? new Prisma.Decimal(dto.targetValue.toFixed(4)) : null,
          upperLimit: dto.upperLimit != null ? new Prisma.Decimal(dto.upperLimit.toFixed(4)) : null,
          criticality: dto.criticality ?? 'MAJOR',
          samplingRule: dto.samplingRule ?? null,
          isRequired: dto.isRequired ?? false,
        },
        include: { productionUnit: { select: { id: true, code: true, name: true } } },
      });
      await this.writeAudit(tx, userId, 'CHARACTERISTIC_CREATE', PRODUCTION_QUALITY_AUDIT_ENTITY, planId, ctx, {
        characteristicId: characteristic.id,
        sequence: characteristic.sequence,
        planCode: plan.code,
      });
      return characteristic;
    });
  }

  async updateCharacteristic(planId: string, id: string, dto: CreateCharacteristicDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(planId, ctx, tx);
      if (plan.status !== 'DRAFT' && plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.notDraft');

      const existing = await tx.qualityCharacteristic.findFirst({
        where: { id, planId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!existing) throw this.notFound('qualityCharacteristic.notFound');

      let productionUnitId = existing.productionUnitId;
      if (dto.productionUnitId) {
        productionUnitId = (await this.assertTenantScoped(tx, 'productionUnit', dto.productionUnitId, ctx, 'productionQualityPlan.unitNotFound')).id;
      }

      const updated = await tx.qualityCharacteristic.update({
        where: { id },
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          characteristicType: dto.characteristicType ?? existing.characteristicType,
          unit: dto.unit ?? existing.unit,
          productionUnitId,
          lowerLimit: dto.lowerLimit != null ? new Prisma.Decimal(dto.lowerLimit.toFixed(4)) : null,
          targetValue: dto.targetValue != null ? new Prisma.Decimal(dto.targetValue.toFixed(4)) : null,
          upperLimit: dto.upperLimit != null ? new Prisma.Decimal(dto.upperLimit.toFixed(4)) : null,
          criticality: dto.criticality ?? existing.criticality,
          samplingRule: dto.samplingRule ?? existing.samplingRule,
          isRequired: dto.isRequired ?? existing.isRequired,
        },
        include: { productionUnit: { select: { id: true, code: true, name: true } } },
      });
      await this.writeAudit(tx, userId, 'CHARACTERISTIC_UPDATE', PRODUCTION_QUALITY_AUDIT_ENTITY, planId, ctx, {
        characteristicId: id,
        sequence: existing.sequence,
        planCode: plan.code,
      });
      return updated;
    });
  }

  async deleteCharacteristic(planId: string, id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(planId, ctx, tx);
      if (plan.status !== 'DRAFT' && plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.notDraft');
      const existing = await tx.qualityCharacteristic.findFirst({
        where: { id, planId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!existing) throw this.notFound('qualityCharacteristic.notFound');
      const deleted = await tx.qualityCharacteristic.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, userId, 'CHARACTERISTIC_DELETE', PRODUCTION_QUALITY_AUDIT_ENTITY, planId, ctx, {
        characteristicId: id,
        sequence: existing.sequence,
        planCode: plan.code,
      });
      return deleted;
    });
  }

  // ── Sampling points ─────────────────────────────────────────────────────────

  async createSamplingPoint(planId: string, dto: CreateSamplingPointDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(planId, ctx, tx);
      if (plan.status !== 'DRAFT' && plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.notDraft');

      let measurementPointId: string | null = null;
      if (dto.measurementPointId) {
        measurementPointId = (await this.assertTenantScoped(tx, 'productionMeasurementPoint', dto.measurementPointId, ctx, 'productionQualityPlan.measurementPointNotFound')).id;
      }
      let productionLineId: string | null = null;
      if (dto.productionLineId) {
        productionLineId = (await this.assertTenantScoped(tx, 'productionLine', dto.productionLineId, ctx, 'productionQualityPlan.lineNotFound')).id;
      }
      let machineId: string | null = null;
      if (dto.machineId) {
        machineId = (await this.assertTenantScoped(tx, 'machine', dto.machineId, ctx, 'productionQualityPlan.machineNotFound')).id;
      }

      const point = await tx.qualitySamplingPoint.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          planId,
          stage: dto.stage ?? 'FINAL_OUTPUT',
          measurementPointId,
          productionLineId,
          machineId,
          appliesToMaterial: dto.appliesToMaterial ?? false,
          appliesToFinishedGoods: dto.appliesToFinishedGoods ?? true,
          sampleFrequency: dto.sampleFrequency ?? null,
          sampleSize: dto.sampleSize != null ? new Prisma.Decimal(dto.sampleSize.toFixed(4)) : null,
          sortOrder: dto.sortOrder ?? 0,
        },
        include: {
          measurementPoint: { select: { id: true, code: true, name: true } },
          productionLine: { select: { id: true, code: true, name: true } },
          machine: { select: { id: true, code: true, name: true } },
        },
      });
      await this.writeAudit(tx, userId, 'SAMPLING_POINT_CREATE', PRODUCTION_QUALITY_AUDIT_ENTITY, planId, ctx, {
        samplingPointId: point.id,
        stage: point.stage,
        planCode: plan.code,
      });
      return point;
    });
  }

  async updateSamplingPoint(planId: string, id: string, dto: CreateSamplingPointDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(planId, ctx, tx);
      if (plan.status !== 'DRAFT' && plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.notDraft');
      const existing = await tx.qualitySamplingPoint.findFirst({
        where: { id, planId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!existing) throw this.notFound('qualitySamplingPoint.notFound');

      let measurementPointId = existing.measurementPointId;
      if (dto.measurementPointId) {
        measurementPointId = (await this.assertTenantScoped(tx, 'productionMeasurementPoint', dto.measurementPointId, ctx, 'productionQualityPlan.measurementPointNotFound')).id;
      }
      let productionLineId = existing.productionLineId;
      if (dto.productionLineId) {
        productionLineId = (await this.assertTenantScoped(tx, 'productionLine', dto.productionLineId, ctx, 'productionQualityPlan.lineNotFound')).id;
      }
      let machineId = existing.machineId;
      if (dto.machineId) {
        machineId = (await this.assertTenantScoped(tx, 'machine', dto.machineId, ctx, 'productionQualityPlan.machineNotFound')).id;
      }

      const updated = await tx.qualitySamplingPoint.update({
        where: { id },
        data: {
          stage: dto.stage ?? existing.stage,
          measurementPointId,
          productionLineId,
          machineId,
          appliesToMaterial: dto.appliesToMaterial ?? existing.appliesToMaterial,
          appliesToFinishedGoods: dto.appliesToFinishedGoods ?? existing.appliesToFinishedGoods,
          sampleFrequency: dto.sampleFrequency ?? existing.sampleFrequency,
          sampleSize: dto.sampleSize != null ? new Prisma.Decimal(dto.sampleSize.toFixed(4)) : existing.sampleSize,
          sortOrder: dto.sortOrder ?? existing.sortOrder,
        },
        include: {
          measurementPoint: { select: { id: true, code: true, name: true } },
          productionLine: { select: { id: true, code: true, name: true } },
          machine: { select: { id: true, code: true, name: true } },
        },
      });
      await this.writeAudit(tx, userId, 'SAMPLING_POINT_UPDATE', PRODUCTION_QUALITY_AUDIT_ENTITY, planId, ctx, {
        samplingPointId: id,
        planCode: plan.code,
      });
      return updated;
    });
  }

  async deleteSamplingPoint(planId: string, id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await this.findPlan(planId, ctx, tx);
      if (plan.status !== 'DRAFT' && plan.status !== 'PENDING') throw this.badRequest('productionQualityPlan.notDraft');
      const existing = await tx.qualitySamplingPoint.findFirst({
        where: { id, planId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!existing) throw this.notFound('qualitySamplingPoint.notFound');
      const deleted = await tx.qualitySamplingPoint.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, userId, 'SAMPLING_POINT_DELETE', PRODUCTION_QUALITY_AUDIT_ENTITY, planId, ctx, {
        samplingPointId: id,
        planCode: plan.code,
      });
      return deleted;
    });
  }

  // ── Inspections ─────────────────────────────────────────────────────────────

  async createInspection(dto: CreateInspectionDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.clientRequestId) {
      const existing = await (this.prisma as any).productionInspection.findFirst({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
      });
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = await tx.productionInspection.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
        });
        if (raced) return raced;

        const plan = await tx.productionQualityPlan.findFirst({
          where: { id: dto.planId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!plan) throw this.notFound('productionInspection.planNotFound');
        if (plan.status !== 'APPROVED') throw this.badRequest('productionInspection.planNotApproved');

        let productionOrder: any = null;
        let productionRun: any = null;
        if (dto.productionOrderId) {
          productionOrder = await tx.productionOrder.findFirst({
            where: { id: dto.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          });
          if (!productionOrder) throw this.notFound('productionInspection.orderNotFound');
        }
        if (dto.productionRunId) {
          productionRun = await tx.productionRun.findFirst({
            where: { id: dto.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          });
          if (!productionRun) throw this.notFound('productionInspection.runNotFound');
          if (productionOrder && productionRun.productionOrderId !== productionOrder.id) {
            throw this.badRequest('productionInspection.orderContextMismatch');
          }
        }

        let productId: string | null = dto.productId ?? null;
        if (!productId && productionRun) {
          const runOrder = await tx.productionOrder.findFirst({
            where: { id: productionRun.productionOrderId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
            select: { productionProductDefinitionId: true },
          });
          if (runOrder) {
            const definition = await tx.productionProductDefinition.findFirst({
              where: { id: runOrder.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId },
              select: { productId: true },
            });
            productId = definition?.productId ?? null;
          }
        } else if (!productId && productionOrder) {
          const definition = await tx.productionProductDefinition.findFirst({
            where: { id: productionOrder.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId },
            select: { productId: true },
          });
          productId = definition?.productId ?? null;
        }
        const product = productId
          ? await this.assertGlobalProduct(tx, productId, 'productionInspection.productNotFound')
          : null;
        if (!productId) throw this.badRequest('productionInspection.productRequired');
        const planDefinition = await tx.productionProductDefinition.findFirst({
          where: {
            id: plan.productionProductDefinitionId,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            deletedAt: null,
          },
          select: { productId: true },
        });
        if (!planDefinition || planDefinition.productId !== product.id) {
          throw this.notFound('productionInspection.productNotFound');
        }

        let samplingPointId: string | null = null;
        if (dto.samplingPointId) {
          const point = await tx.qualitySamplingPoint.findFirst({
            where: { id: dto.samplingPointId, planId: plan.id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          });
          if (!point) throw this.badRequest('productionInspection.samplingPointNotInPlan');
          samplingPointId = point.id;
        }
        if (dto.outputEventId) {
          await this.assertTenantScoped(tx, 'productionOutputEvent', dto.outputEventId, ctx, 'productionInspection.outputEventNotFound');
        }
        if (dto.finishedGoodsReceiptId) {
          await this.assertTenantScoped(tx, 'productionFinishedGoodsReceipt', dto.finishedGoodsReceiptId, ctx, 'productionInspection.receiptNotFound');
        }
        if (dto.finishedGoodsReceiptLineId) {
          await this.assertTenantScoped(tx, 'productionFinishedGoodsReceiptLine', dto.finishedGoodsReceiptLineId, ctx, 'productionInspection.receiptLineNotFound');
        }
        if (dto.productionLineId) {
          await this.assertTenantScoped(tx, 'productionLine', dto.productionLineId, ctx, 'productionInspection.lineNotFound');
        }
        if (dto.machineId) {
          await this.assertTenantScoped(tx, 'machine', dto.machineId, ctx, 'productionInspection.machineNotFound');
        }
        if (dto.shiftId) {
          await this.assertTenantScoped(tx, 'productionShift', dto.shiftId, ctx, 'productionInspection.shiftNotFound');
        }
        if (dto.costCenterId) {
          await this.assertTenantScoped(tx, 'costCenter', dto.costCenterId, ctx, 'productionInspection.costCenterNotFound');
        }

        const inspectionNumber = await this.numberingService.generateNumberAtomicWithClient(INSPECTION_NUMBER_SEQUENCE, tx);

        const inspection = await tx.productionInspection.create({
          data: {
            inspectionNumber,
            clientRequestId: dto.clientRequestId,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            planId: plan.id,
            planCodeSnapshot: plan.code,
            planRevisionSnapshot: plan.revision,
            productionOrderId: productionOrder?.id ?? null,
            productionRunId: productionRun?.id ?? null,
            outputEventId: dto.outputEventId ?? null,
            finishedGoodsReceiptId: dto.finishedGoodsReceiptId ?? null,
            finishedGoodsReceiptLineId: dto.finishedGoodsReceiptLineId ?? null,
            samplingPointId,
            productId,
            productCodeSnapshot: product?.code ?? '',
            productNameSnapshot: product?.name ?? '',
            productionLineId: dto.productionLineId ?? null,
            machineId: dto.machineId ?? null,
            shiftId: dto.shiftId ?? null,
            costCenterId: dto.costCenterId ?? null,
            sampledQuantity: new Prisma.Decimal(dto.sampledQuantity.toFixed(4)),
            unit: dto.unit,
            inspectedAt: new Date(dto.inspectedAt),
            status: 'OPEN',
            notes: dto.notes ?? null,
            createdById: userId,
          },
          include: PRODUCTION_INSPECTION_INCLUDE,
        });
        await this.writeAudit(tx, userId, 'INSPECTION_CREATE', PRODUCTION_INSPECTION_AUDIT_ENTITY, inspection.id, ctx, {
          inspectionNumber,
          planCode: plan.code,
          productId,
          sampledQuantity: dto.sampledQuantity,
        });
        return inspection;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await (this.prisma as any).productionInspection.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
        });
        if (raced) return raced;
        throw this.conflict('productionInspection.duplicateRequest');
      }
      throw error;
    }
  }

  async findInspections(query: InspectionQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.status) where.status = query.status;
    if (query.planId) where.planId = query.planId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.dateFrom || query.dateTo) {
      where.inspectedAt = {};
      if (query.dateFrom) where.inspectedAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.inspectedAt.lte = new Date(query.dateTo);
    }
    if (query.search) where.inspectionNumber = { contains: query.search };

    const [data, total] = await Promise.all([
      (this.prisma as any).productionInspection.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ inspectedAt: 'desc' }],
        include: PRODUCTION_INSPECTION_INCLUDE,
      }),
      (this.prisma as any).productionInspection.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneInspection(id: string, ctx: ActiveOperationalContext) {
    const inspection = await (this.prisma as any).productionInspection.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: PRODUCTION_INSPECTION_INCLUDE,
    });
    if (!inspection) throw this.notFound('productionInspection.notFound');
    return inspection;
  }

  private evaluateNumericPass(characteristic: any, valueNumeric: number): boolean {
    const value = new Prisma.Decimal(valueNumeric.toFixed(4));
    if (characteristic.lowerLimit != null && value.lessThan(new Prisma.Decimal(characteristic.lowerLimit))) return false;
    if (characteristic.upperLimit != null && value.greaterThan(new Prisma.Decimal(characteristic.upperLimit))) return false;
    return true;
  }

  async recordResults(id: string, dto: RecordInspectionResultsDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const inspection = await tx.productionInspection.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: { plan: true },
      });
      if (!inspection) throw this.notFound('productionInspection.notFound');
      if (inspection.status === 'DISPOSITIONED') throw this.badRequest('productionInspection.notDispositioned');

      const created: any[] = [];
      for (const entry of dto.results) {
        const characteristic = await tx.qualityCharacteristic.findFirst({
          where: { id: entry.characteristicId, planId: inspection.planId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!characteristic) throw this.badRequest('productionInspection.characteristicNotInPlan');

        const valueCount = [entry.valueNumeric, entry.valueBoolean, entry.valueText, entry.valueChoice].filter((v) => v !== undefined && v !== null).length;
        if (valueCount !== 1) throw this.badRequest('productionInspection.resultValueRequired');

        let pass = false;
        switch (characteristic.characteristicType) {
          case 'NUMERIC':
            if (entry.valueNumeric === undefined) throw this.badRequest('productionInspection.numericValueRequired');
            pass = this.evaluateNumericPass(characteristic, entry.valueNumeric);
            break;
          case 'BOOLEAN':
            if (entry.valueBoolean === undefined) throw this.badRequest('productionInspection.booleanValueRequired');
            pass = entry.pass ?? false;
            break;
          case 'TEXT':
            if (entry.valueText === undefined) throw this.badRequest('productionInspection.textValueRequired');
            pass = entry.pass ?? false;
            break;
          case 'CHOICE':
            if (entry.valueChoice === undefined) throw this.badRequest('productionInspection.choiceValueRequired');
            pass = entry.pass ?? false;
            break;
          default:
            throw this.badRequest('productionInspection.unknownCharacteristicType');
        }

        const existing = await tx.productionInspectionResult.findFirst({
          where: { inspectionId: id, characteristicId: entry.characteristicId, correctsResultId: null },
          orderBy: { createdAt: 'desc' },
        });

        const result = await tx.productionInspectionResult.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            inspectionId: id,
            characteristicId: characteristic.id,
            characteristicSequenceSnapshot: characteristic.sequence,
            characteristicNameArSnapshot: characteristic.nameAr,
            characteristicNameEnSnapshot: characteristic.nameEn,
            characteristicTypeSnapshot: characteristic.characteristicType,
            unitSnapshot: characteristic.unit ?? null,
            lowerLimitSnapshot: characteristic.lowerLimit != null ? new Prisma.Decimal(characteristic.lowerLimit) : null,
            targetSnapshot: characteristic.targetValue != null ? new Prisma.Decimal(characteristic.targetValue) : null,
            upperLimitSnapshot: characteristic.upperLimit != null ? new Prisma.Decimal(characteristic.upperLimit) : null,
            valueNumeric: entry.valueNumeric != null ? new Prisma.Decimal(entry.valueNumeric.toFixed(4)) : null,
            valueBoolean: entry.valueBoolean ?? null,
            valueText: entry.valueText ?? null,
            valueChoice: entry.valueChoice ?? null,
            pass,
            method: entry.method ?? null,
            sourceType: entry.sourceType ?? 'MANUAL',
            correctsResultId: existing ? existing.id : null,
            correctionReason: existing ? 'Updated result' : null,
            recordedById: userId,
          },
        });
        created.push(result);
      }

      await this.writeAudit(tx, userId, 'INSPECTION_RESULTS', PRODUCTION_INSPECTION_AUDIT_ENTITY, id, ctx, {
        inspectionNumber: inspection.inspectionNumber,
        resultCount: dto.results.length,
      });
      return created;
    });
  }

  async completeInspection(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const inspection = await tx.productionInspection.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: {
          plan: { include: { characteristics: { where: { deletedAt: null, status: 'ACTIVE' } } } },
          results: { where: { correctsResultId: null } },
        },
      });
      if (!inspection) throw this.notFound('productionInspection.notFound');
      if (inspection.status !== 'OPEN') throw this.badRequest('productionInspection.completeOnlyOpen');

      const recorded = new Map<string, boolean>();
      for (const r of inspection.results) recorded.set(r.characteristicId, r.pass);

      let missingRequired = false;
      for (const c of inspection.plan.characteristics) {
        if (c.isRequired && !recorded.has(c.id)) missingRequired = true;
      }
      const anyFailed = [...recorded.values()].some((pass) => !pass);
      const nextStatus = anyFailed || missingRequired ? 'HELD' : 'COMPLETED';

      const updated = await tx.productionInspection.update({
        where: { id },
        data: { status: nextStatus, inspectedById: userId, inspectedAtConfirmed: new Date() },
        include: PRODUCTION_INSPECTION_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'INSPECTION_COMPLETE', PRODUCTION_INSPECTION_AUDIT_ENTITY, id, ctx, {
        inspectionNumber: inspection.inspectionNumber,
        resultStatus: nextStatus,
      });
      return updated;
    });
  }

  // ── Dispositions ────────────────────────────────────────────────────────────

  async createDisposition(id: string, dto: CreateDispositionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const inspection = await tx.productionInspection.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: { dispositions: { where: { deletedAt: null } } },
      });
      if (!inspection) throw this.notFound('productionInspection.notFound');
      if (inspection.status !== 'COMPLETED' && inspection.status !== 'HELD') {
        throw this.badRequest('productionInspection.dispositionOnlyCompletedOrHeld');
      }
      if (inspection.dispositions.some((d: any) => d.status === 'APPROVED')) {
        throw this.badRequest('productionInspection.alreadyDispositioned');
      }

      const disposition = await tx.productionQualityDisposition.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          inspectionId: id,
          action: dto.action,
          quantity: new Prisma.Decimal(dto.quantity.toFixed(4)),
          unit: dto.unit,
          reason: dto.reason,
          status: 'PENDING',
          requestedById: userId,
          notes: dto.notes ?? null,
          createdById: userId,
        },
      });
      await this.writeAudit(tx, userId, 'DISPOSITION_CREATE', PRODUCTION_INSPECTION_AUDIT_ENTITY, id, ctx, {
        inspectionNumber: inspection.inspectionNumber,
        dispositionId: disposition.id,
        action: dto.action,
        quantity: dto.quantity,
      });
      return disposition;
    });
  }

  async approveDisposition(id: string, dispositionId: string, _dto: ApproveDispositionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const disposition = await tx.productionQualityDisposition.findFirst({
        where: { id: dispositionId, inspectionId: id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!disposition) throw this.notFound('qualityDisposition.notFound');
      if (disposition.status !== 'PENDING') throw this.badRequest('qualityDisposition.approveOnlyPending');

      const updated = await tx.productionQualityDisposition.update({
        where: { id: dispositionId },
        data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
      });

      const inspection = await tx.productionInspection.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      });
      if (inspection && inspection.status !== 'DISPOSITIONED') {
        await tx.productionInspection.update({
          where: { id },
          data: { status: 'DISPOSITIONED' },
        });
      }

      await this.writeAudit(tx, userId, 'DISPOSITION_APPROVE', PRODUCTION_INSPECTION_AUDIT_ENTITY, id, ctx, {
        dispositionId,
        action: disposition.action,
      });
      return updated;
    });
  }

  async rejectDisposition(id: string, dispositionId: string, dto: RejectDispositionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const disposition = await tx.productionQualityDisposition.findFirst({
        where: { id: dispositionId, inspectionId: id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!disposition) throw this.notFound('qualityDisposition.notFound');
      if (disposition.status !== 'PENDING') throw this.badRequest('qualityDisposition.rejectOnlyPending');

      const updated = await tx.productionQualityDisposition.update({
        where: { id: dispositionId },
        data: { status: 'REJECTED', rejectionReason: dto.reason },
      });
      await this.writeAudit(tx, userId, 'DISPOSITION_REJECT', PRODUCTION_INSPECTION_AUDIT_ENTITY, id, ctx, {
        dispositionId,
        reason: dto.reason,
      });
      return updated;
    });
  }

  // ── Nonconformances ─────────────────────────────────────────────────────────

  async createNcr(dto: CreateNcrDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await (this.prisma as any).productionNonconformance.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = await tx.productionNonconformance.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
        });
        if (raced) return raced;

        let inspectionId: string | null = null;
        if (dto.inspectionId) {
          await this.assertTenantScoped(tx, 'productionInspection', dto.inspectionId, ctx, 'productionNcr.inspectionNotFound');
          inspectionId = dto.inspectionId;
        }
        let dispositionId: string | null = null;
        if (dto.dispositionId) {
          await this.assertTenantScoped(tx, 'productionQualityDisposition', dto.dispositionId, ctx, 'productionNcr.dispositionNotFound');
          dispositionId = dto.dispositionId;
        }
        let ownerUserId: string | null = null;
        if (dto.ownerUserId) {
          await this.assertTenantScoped(tx, 'user', dto.ownerUserId, ctx, 'productionNcr.ownerNotFound');
          ownerUserId = dto.ownerUserId;
        }

        const ncrNumber = await this.numberingService.generateNumberAtomicWithClient(NCR_NUMBER_SEQUENCE, tx);
        const ncr = await tx.productionNonconformance.create({
          data: {
            ncrNumber,
            clientRequestId: dto.clientRequestId,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            inspectionId,
            dispositionId,
            severity: dto.severity ?? 'MAJOR',
            status: 'OPEN',
            description: dto.description,
            rootCause: dto.rootCause ?? null,
            correctiveAction: dto.correctiveAction ?? null,
            ownerUserId,
            detectionDate: dto.detectionDate ? new Date(dto.detectionDate) : new Date(),
            targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
            createdById: userId,
          },
          include: PRODUCTION_NCR_INCLUDE,
        });
        await this.writeAudit(tx, userId, 'NCR_CREATE', PRODUCTION_NCR_AUDIT_ENTITY, ncr.id, ctx, {
          ncrNumber,
          severity: ncr.severity,
          inspectionId,
        });
        return ncr;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await (this.prisma as any).productionNonconformance.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
        });
        if (raced) return raced;
        throw this.conflict('productionNcr.duplicateRequest');
      }
      throw error;
    }
  }

  async findNcrs(query: NcrQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.inspectionId) where.inspectionId = query.inspectionId;
    if (query.dateFrom || query.dateTo) {
      where.detectionDate = {};
      if (query.dateFrom) where.detectionDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.detectionDate.lte = new Date(query.dateTo);
    }
    if (query.search) where.ncrNumber = { contains: query.search };

    const [data, total] = await Promise.all([
      (this.prisma as any).productionNonconformance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ detectionDate: 'desc' }],
        include: PRODUCTION_NCR_INCLUDE,
      }),
      (this.prisma as any).productionNonconformance.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneNcr(id: string, ctx: ActiveOperationalContext) {
    const ncr = await (this.prisma as any).productionNonconformance.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: PRODUCTION_NCR_INCLUDE,
    });
    if (!ncr) throw this.notFound('productionNcr.notFound');
    return ncr;
  }

  async transitionNcr(id: string, dto: NcrTransitionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const ncr = await tx.productionNonconformance.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!ncr) throw this.notFound('productionNcr.notFound');

      const existingTransition = await tx.productionNonconformanceTransition.findUnique({
        where: { nonconformanceId_requestId: { nonconformanceId: id, requestId: dto.requestId } },
      });
      if (existingTransition) return existingTransition;

      const allowed = NCR_TRANSITION_RULES[ncr.status] ?? [];
      if (!allowed.includes(dto.toStatus)) throw this.badRequest('productionNcr.invalidTransition');

      const transition = await tx.productionNonconformanceTransition.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          nonconformanceId: id,
          fromStatus: ncr.status,
          toStatus: dto.toStatus,
          action: dto.action,
          actorId: userId,
          reason: dto.reason ?? null,
          requestId: dto.requestId,
        },
      });

      const data: any = { status: dto.toStatus };
      if (dto.toStatus === 'VERIFIED') {
        data.verifiedById = userId;
        data.verifiedAt = new Date();
      }
      if (dto.toStatus === 'CLOSED') {
        data.closedById = userId;
        data.closedAt = new Date();
      }
      if (dto.toStatus === 'OPEN') {
        data.verifiedById = null;
        data.verifiedAt = null;
        data.closedById = null;
        data.closedAt = null;
      }
      await tx.productionNonconformance.update({ where: { id }, data });

      await this.writeAudit(tx, userId, 'NCR_TRANSITION', PRODUCTION_NCR_AUDIT_ENTITY, id, ctx, {
        ncrNumber: ncr.ncrNumber,
        fromStatus: ncr.status,
        toStatus: dto.toStatus,
        action: dto.action,
      });
      return transition;
    });
  }

  async attachToNcr(id: string, dto: NcrAttachDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const ncr = await tx.productionNonconformance.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!ncr) throw this.notFound('productionNcr.notFound');
      const attachment = await tx.attachment.findUnique({ where: { id: dto.attachmentId } });
      if (!attachment) throw this.notFound('productionNcr.attachmentNotFound');

      const link = await tx.productionNonconformanceAttachment.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          nonconformanceId: id,
          attachmentId: dto.attachmentId,
          uploadedById: userId,
        },
      });
      await this.writeAudit(tx, userId, 'NCR_ATTACH', PRODUCTION_NCR_AUDIT_ENTITY, id, ctx, {
        ncrNumber: ncr.ncrNumber,
        attachmentId: dto.attachmentId,
      });
      return link;
    });
  }

  async detachFromNcr(id: string, linkId: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.productionNonconformanceAttachment.findFirst({
        where: { id: linkId, nonconformanceId: id, companyId: ctx.companyId, branchId: ctx.branchId },
      });
      if (!link) throw this.notFound('productionNcr.attachmentLinkNotFound');
      await tx.productionNonconformanceAttachment.delete({ where: { id: linkId } });
      const ncr = await tx.productionNonconformance.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      });
      await this.writeAudit(tx, userId, 'NCR_DETACH', PRODUCTION_NCR_AUDIT_ENTITY, id, ctx, {
        ncrNumber: ncr?.ncrNumber ?? id,
        attachmentId: link.attachmentId,
      });
      return { id: linkId, detached: true };
    });
  }
}
