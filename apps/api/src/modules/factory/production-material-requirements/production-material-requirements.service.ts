import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import {
  PRODUCTION_MATERIAL_CONSUMPTION_AUDIT_ENTITY,
  PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
  PRODUCTION_MATERIAL_REQUIREMENT_AUDIT_ENTITY,
  PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
} from './production-material-requirements.constants';
import {
  computePlannedQuantity,
  isComponentRole,
  isOverIssuePolicy,
  isWithinTolerance,
  maxDecimal,
  netIssued,
  positiveDecimal,
  varianceStatus,
} from './production-material-requirements.domain.util';
import {
  CancelMaterialRequirementDto,
  ConsumptionQueryDto,
  CorrectMaterialConsumptionDto,
  PrepareMaterialRequirementDto,
  RecordMaterialConsumptionDto,
  UpdateMaterialRequirementDto,
} from './dto/production-material-requirement.dto';

export const MATERIAL_OUT_DOCUMENT_TYPES = ['ISSUE', 'CONSUMPTION', 'SUBSTITUTION'] as const;
export const MATERIAL_IN_DOCUMENT_TYPES = ['RETURN'] as const;

@Injectable()
export class ProductionMaterialRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  private async findOwnedOrder(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const order = await client.productionOrder.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!order) throw this.notFound('productionMaterialRequirement.orderNotFound');
    return order;
  }

  private async findOwnedRequirement(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const requirement = await client.productionMaterialRequirement.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
    });
    if (!requirement) throw this.notFound('productionMaterialRequirement.notFound');
    return requirement;
  }

  private async findLatestRequirement(orderId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.productionMaterialRequirement.findFirst({
      where: { productionOrderId: orderId, companyId: ctx.companyId, branchId: ctx.branchId },
      orderBy: [{ revision: 'desc' }],
      include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
    });
  }

  private async findFrozenRequirement(orderId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    return client.productionMaterialRequirement.findFirst({
      where: { productionOrderId: orderId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'FROZEN' },
      orderBy: [{ revision: 'desc' }],
      include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
    });
  }

  private async validateRequirementLines(dtoLines: any[], ctx: ActiveOperationalContext, client: any) {
    if (!dtoLines || dtoLines.length === 0) throw this.badRequest('productionMaterialRequirement.linesRequired');
    const seen = new Set<string>();
    for (const line of dtoLines) {
      if (!line.productId) throw this.badRequest('productionMaterialRequirement.productRequired');
      if (seen.has(line.productId)) throw this.badRequest('productionMaterialRequirement.duplicateProduct');
      seen.add(line.productId);
      const product = await client.product.findUnique({ where: { id: line.productId } });
      if (!product) throw this.notFound('productionMaterialRequirement.productNotFound');
      const role = line.componentRole || 'RAW_MATERIAL';
      if (!isComponentRole(role)) throw this.badRequest('productionMaterialRequirement.invalidRole');
      const policy = line.overIssuePolicy || 'NOT_ALLOWED';
      if (!isOverIssuePolicy(policy)) throw this.badRequest('productionMaterialRequirement.invalidPolicy');
      if (policy === 'TOLERANCE' && (line.tolerancePercent === null || line.tolerancePercent === undefined)) {
        throw this.badRequest('productionMaterialRequirement.toleranceRequired');
      }
      if (line.warehouseId) {
        const warehouse = await client.warehouse.findUnique({ where: { id: line.warehouseId } });
        if (!warehouse) throw this.notFound('productionMaterialRequirement.warehouseNotFound');
        if (warehouse.companyId !== ctx.companyId) throw this.badRequest('productionMaterialRequirement.warehouseTenantMismatch');
        if (warehouse.branchId && warehouse.branchId !== ctx.branchId) {
          throw this.badRequest('productionMaterialRequirement.warehouseBranchMismatch');
        }
      }
      positiveDecimal(line.plannedQuantityPerUnit);
    }
  }

  private async buildRequirementData(dto: PrepareMaterialRequirementDto, order: any, ctx: ActiveOperationalContext, client: any) {
    await this.validateRequirementLines(dto.lines, ctx, client);
    const definition = order.productionProductDefinitionId
      ? await client.productionProductDefinition.findUnique({ where: { id: order.productionProductDefinitionId } })
      : null;
    const version = order.productionVersionId
      ? await client.productionVersion.findUnique({ where: { id: order.productionVersionId } })
      : null;
    const packaging = order.productionPackagingId
      ? await client.productionPackaging.findUnique({ where: { id: order.productionPackagingId } })
      : null;
    const orderPlannedQuantity = new Prisma.Decimal(order.plannedQuantity);
    const lines = dto.lines.map((line, index) => {
      const conversionFactor = line.conversionFactor === undefined ? 1 : line.conversionFactor;
      const plannedQuantity = computePlannedQuantity(line.plannedQuantityPerUnit, orderPlannedQuantity, conversionFactor);
      return {
        lineNumber: index + 1,
        productId: line.productId,
        productCodeSnapshot: '',
        productNameSnapshot: '',
        componentRole: line.componentRole || 'RAW_MATERIAL',
        plannedQuantityPerUnit: new Prisma.Decimal(Number(line.plannedQuantityPerUnit.toFixed(4))),
        plannedQuantity,
        baseUnit: line.baseUnit,
        issueUnit: line.issueUnit,
        conversionFactor: new Prisma.Decimal(Number(conversionFactor.toFixed(4))),
        warehouseId: line.warehouseId ?? null,
        productionStage: line.productionStage ?? null,
        lotControlRequired: line.lotControlRequired ?? false,
        overIssuePolicy: line.overIssuePolicy || 'NOT_ALLOWED',
        tolerancePercent: line.tolerancePercent === undefined ? null : new Prisma.Decimal(Number(line.tolerancePercent.toFixed(4))),
        notes: line.notes ?? null,
      };
    });
    return {
      productDefinitionCodeSnapshot: definition?.code ?? null,
      productDefinitionNameSnapshot: definition?.name ?? null,
      productVersionLabelSnapshot: version?.versionLabel ?? null,
      productPackagingLabelSnapshot: packaging?.label ?? null,
      lines,
    };
  }

  /**
   * Prepares (or replaces) the DRAFT requirement snapshot for an order. The
   * snapshot is never fabricated from an implicit source: every line is
   * explicitly entered and approved by an actor with the prepare permission.
   * A FROZEN snapshot is immutable and cannot be rewritten.
   */
  async prepare(orderId: string, dto: PrepareMaterialRequirementDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.requestId) {
      const existing = await (this.prisma as any).productionMaterialRequirement.findFirst({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId: dto.requestId },
        include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
      });
      if (existing) return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = dto.requestId
          ? await (tx as any).productionMaterialRequirement.findFirst({
              where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId: dto.requestId },
              include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
            })
          : null;
        if (raced) return raced;

        const order = await this.findOwnedOrder(orderId, ctx, tx);
        if (!['DRAFT', 'PLANNED'].includes(order.status)) throw this.conflict('productionMaterialRequirement.prepareStateInvalid');
        const frozen = await this.findFrozenRequirement(orderId, ctx, tx);
        if (frozen) throw this.conflict('productionMaterialRequirement.frozenImmutable');

        const data = await this.buildRequirementData(dto, order, ctx, tx);
        const existingDraft = await (tx as any).productionMaterialRequirement.findFirst({
          where: { productionOrderId: orderId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'DRAFT' },
        });

        let requirement: any;
        if (existingDraft) {
          await (tx as any).productionMaterialRequirementLine.deleteMany({ where: { requirementId: existingDraft.id } });
          requirement = await (tx as any).productionMaterialRequirement.update({
            where: { id: existingDraft.id },
            data: {
              ...data,
              notes: dto.notes ?? existingDraft.notes,
              preparedById: userId,
              preparedAt: new Date(),
              lines: { create: data.lines },
            },
            include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
          });
        } else {
          requirement = await (tx as any).productionMaterialRequirement.create({
            data: {
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              productionOrderId: order.id,
              revision: 1,
              status: 'DRAFT',
              sourceType: 'MANUAL',
              ...data,
              notes: dto.notes ?? null,
              preparedById: userId,
              preparedAt: new Date(),
              requestId: dto.requestId ?? null,
              lines: { create: data.lines },
            },
            include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
          });
        }

        await this.writeAudit(tx, userId, 'PREPARE', PRODUCTION_MATERIAL_REQUIREMENT_AUDIT_ENTITY, requirement.id, ctx, {
          orderNumber: order.orderNumber,
          revision: requirement.revision,
          lineCount: requirement.lines.length,
          sourceType: 'MANUAL',
        });
        return requirement;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = dto.requestId
          ? await (this.prisma as any).productionMaterialRequirement.findFirst({
              where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId: dto.requestId },
              include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
            })
          : null;
        if (raced) return raced;
        throw this.conflict('productionMaterialRequirement.duplicateRequest');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateMaterialRequirementDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const requirement = await this.findOwnedRequirement(id, ctx, tx);
      if (requirement.status !== 'DRAFT') throw this.conflict('productionMaterialRequirement.frozenImmutable');
      if (dto.lines && dto.lines.length > 0) {
        const order = await this.findOwnedOrder(requirement.productionOrderId, ctx, tx);
        const data = await this.buildRequirementData({ lines: dto.lines } as PrepareMaterialRequirementDto, order, ctx, tx);
        await (tx as any).productionMaterialRequirementLine.deleteMany({ where: { requirementId: id } });
        await (tx as any).productionMaterialRequirementLine.createMany({
          data: data.lines.map((l: any) => ({ ...l, requirementId: id, companyId: ctx.companyId, branchId: ctx.branchId })),
        });
        await (tx as any).productionMaterialRequirement.update({
          where: { id },
          data: {
            productDefinitionCodeSnapshot: data.productDefinitionCodeSnapshot,
            productDefinitionNameSnapshot: data.productDefinitionNameSnapshot,
            productVersionLabelSnapshot: data.productVersionLabelSnapshot,
            productPackagingLabelSnapshot: data.productPackagingLabelSnapshot,
          },
        });
      }
      if (dto.notes !== undefined) {
        await (tx as any).productionMaterialRequirement.update({ where: { id }, data: { notes: dto.notes } });
      }
      const updated = await this.findOwnedRequirement(id, ctx, tx);
      await this.writeAudit(tx, userId, 'UPDATE', PRODUCTION_MATERIAL_REQUIREMENT_AUDIT_ENTITY, id, ctx, {
        orderNumber: updated.productionOrder.orderNumber,
        revision: updated.revision,
      });
      return updated;
    });
  }

  /**
   * Freezes a DRAFT snapshot. Once frozen the snapshot is immutable: later
   * recipe changes never rewrite it, and posted material documents are
   * validated against it. This is the authoritative minimum production-owned
   * model that readiness and consumption read from.
   */
  async freeze(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const requirement = await this.findOwnedRequirement(id, ctx, tx);
      if (requirement.status !== 'DRAFT') throw this.conflict('productionMaterialRequirement.freezeStateInvalid');
      const order = await this.findOwnedOrder(requirement.productionOrderId, ctx, tx);
      if (['CANCELLED', 'ARCHIVED'].includes(order.status)) throw this.conflict('productionMaterialRequirement.orderNotFreezable');
      const frozen = await this.findFrozenRequirement(requirement.productionOrderId, ctx, tx);
      if (frozen && frozen.id !== id) throw this.conflict('productionMaterialRequirement.alreadyFrozen');
      const updated = await (tx as any).productionMaterialRequirement.update({
        where: { id },
        data: { status: 'FROZEN', frozenById: userId, frozenAt: new Date() },
        include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'FREEZE', PRODUCTION_MATERIAL_REQUIREMENT_AUDIT_ENTITY, id, ctx, {
        orderNumber: order.orderNumber,
        revision: requirement.revision,
      });
      return updated;
    });
  }

  /**
   * Freezes a DRAFT snapshot during order release when one exists. Backward
   * compatible: an order without a prepared snapshot releases as before (its
   * material readiness then surfaces the canonical missing-snapshot blocker).
   */
  async freezeForRelease(orderId: string, userId: string, ctx: ActiveOperationalContext, client: any) {
    const draft = await client.productionMaterialRequirement.findFirst({
      where: { productionOrderId: orderId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'DRAFT' },
    });
    if (!draft) return null;
    const updated = await client.productionMaterialRequirement.update({
      where: { id: draft.id },
      data: { status: 'FROZEN', frozenById: userId, frozenAt: new Date() },
      include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
    });
    const order = await this.findOwnedOrder(orderId, ctx, client);
    await this.writeAudit(client, userId, 'FREEZE', PRODUCTION_MATERIAL_REQUIREMENT_AUDIT_ENTITY, draft.id, ctx, {
      orderNumber: order.orderNumber,
      revision: draft.revision,
      source: 'ORDER_RELEASE',
    });
    return updated;
  }

  async cancel(id: string, dto: CancelMaterialRequirementDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const requirement = await this.findOwnedRequirement(id, ctx, tx);
      if (requirement.status === 'CANCELLED') return requirement;
      if (!['DRAFT', 'FROZEN'].includes(requirement.status)) throw this.conflict('productionMaterialRequirement.cancelStateInvalid');
      if (requirement.status === 'FROZEN') {
        const postedCount = await (tx as any).productionMaterialDocument.count({
          where: { productionOrderId: requirement.productionOrderId, status: 'POSTED' },
        });
        if (postedCount > 0) throw this.conflict('productionMaterialRequirement.postingStarted');
      }
      const updated = await (tx as any).productionMaterialRequirement.update({
        where: { id },
        data: { status: 'CANCELLED', notes: dto.reason },
        include: PRODUCTION_MATERIAL_REQUIREMENT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'CANCEL', PRODUCTION_MATERIAL_REQUIREMENT_AUDIT_ENTITY, id, ctx, {
        orderNumber: updated.productionOrder.orderNumber,
        revision: requirement.revision,
        reason: dto.reason,
      });
      return updated;
    });
  }

  async getByOrder(orderId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedOrder(orderId, ctx);
    const requirement = await this.findLatestRequirement(orderId, ctx);
    if (!requirement) throw this.notFound('productionMaterialRequirement.notFound');
    return requirement;
  }

  /**
   * Net issued quantity per product from the posted movement ledger. Mirrors
   * the movement generation in the material-documents module so consumption
   * always matches the real inventory effect: OUT types consume, RETURN and the
   * SUBSTITUTION side-effect (substitute entering stock) count as IN.
   */
  private async postedNetIssuedByProduct(orderId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const docs = await client.productionMaterialDocument.findMany({
      where: { productionOrderId: orderId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'POSTED' },
      select: { id: true, documentType: true, lines: true },
    });
    const out = new Map<string, Prisma.Decimal>();
    const inn = new Map<string, Prisma.Decimal>();
    const add = (map: Map<string, Prisma.Decimal>, productId: string, qty: Prisma.Decimal.Value) => {
      const current = map.get(productId) ?? new Prisma.Decimal(0);
      map.set(productId, current.plus(new Prisma.Decimal(qty)));
    };
    for (const doc of docs) {
      const isOut = MATERIAL_OUT_DOCUMENT_TYPES.includes(doc.documentType);
      for (const line of doc.lines) {
        add(isOut ? out : inn, line.productId, line.quantity);
        if (doc.documentType === 'SUBSTITUTION' && line.substitutedProductId) {
          add(inn, line.substitutedProductId, line.quantity);
        }
      }
    }
    const result = new Map<string, Prisma.Decimal>();
    const keys = new Set([...out.keys(), ...inn.keys()]);
    for (const productId of keys) {
      const o = out.get(productId) ?? new Prisma.Decimal(0);
      const i = inn.get(productId) ?? new Prisma.Decimal(0);
      result.set(productId, o.minus(i).toDecimalPlaces(4));
    }
    return result;
  }

  private async postedIssueLineSummaries(orderId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const docs = await client.productionMaterialDocument.findMany({
      where: { productionOrderId: orderId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'POSTED' },
      include: { lines: { include: { originalIssueLine: true } } },
    });
    return docs;
  }

  /**
   * Material readiness for an order. A missing approved (FROZEN) snapshot is
   * the only hard blocker; per-line shortage/over-issue beyond tolerance are
   * warnings because they remain controllable at posting time.
   */
  async getOrderReadiness(orderId: string, ctx: ActiveOperationalContext) {
    const order = await this.findOwnedOrder(orderId, ctx);
    const frozen = await this.findFrozenRequirement(orderId, ctx);

    if (!frozen) {
      return {
        orderId,
        orderNumber: order.orderNumber,
        status: 'NOT_READY',
        blockers: ['productionMaterialRequirement.missingFrozenSnapshot'],
        warnings: [],
        lines: [],
      };
    }

    const netIssued = await this.postedNetIssuedByProduct(orderId, ctx);
    const lines = frozen.lines.map((line: any) => {
      const issued = netIssued.get(line.productId) ?? new Prisma.Decimal(0);
      const planned = new Prisma.Decimal(line.plannedQuantity);
      const shortage = planned.greaterThan(issued) ? planned.minus(issued).toDecimalPlaces(4) : new Prisma.Decimal(0);
      const warnings: string[] = [];
      if (shortage.greaterThan(0)) warnings.push('productionMaterialRequirement.shortageWarning');
      if (!isWithinTolerance(issued, planned, line.tolerancePercent)) warnings.push('productionMaterialRequirement.overIssueWarning');
      return {
        lineId: line.id,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productCode: line.productCodeSnapshot || line.product?.code,
        productName: line.productNameSnapshot || line.product?.name,
        componentRole: line.componentRole,
        plannedQuantity: line.plannedQuantity,
        baseUnit: line.baseUnit,
        issueUnit: line.issueUnit,
        overIssuePolicy: line.overIssuePolicy,
        tolerancePercent: line.tolerancePercent,
        netIssued: issued,
        shortage,
        status: warnings.length === 0 ? 'OK' : warnings.includes('productionMaterialRequirement.overIssueWarning') ? 'OVER_ISSUE' : 'SHORT',
        warnings,
      };
    });

    return {
      orderId,
      orderNumber: order.orderNumber,
      status: lines.some((l: any) => l.status !== 'OK') ? 'NOT_READY' : 'READY',
      blockers: [],
      warnings: lines.flatMap((l: any) => l.warnings),
      lines,
    };
  }

  /**
   * Consumption contract for an order: explicit consumption facts are
   * authoritative when present, otherwise derived as
   * valid posted issues - valid posted returns - applicable reversals.
   * Consumption never causes a second inventory decrement.
   */
  async getOrderConsumptionSummary(orderId: string, ctx: ActiveOperationalContext) {
    const order = await this.findOwnedOrder(orderId, ctx);
    const frozen = await this.findFrozenRequirement(orderId, ctx);

    const explicit = await (this.prisma as any).productionMaterialConsumption.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, productionOrderId: orderId },
      include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
    });

    if (explicit.length > 0) {
      const totals = new Map<string, Prisma.Decimal>();
      const records = new Map<string, any[]>();
      for (const rec of explicit) {
        let total = rec.quantity;
        if (rec.corrections.length > 0) {
          const last = rec.corrections[rec.corrections.length - 1];
          total = last.newQuantity;
        }
        const key = rec.requirementLineId ?? rec.productId;
        const current = totals.get(key) ?? new Prisma.Decimal(0);
        totals.set(key, current.plus(new Prisma.Decimal(total)));
        const arr = records.get(key) ?? [];
        arr.push(rec);
        records.set(key, arr);
      }
      const lines = Array.from(totals.entries()).map(([key, consumed]) => {
        const recs = records.get(key) ?? [];
        const rec = recs[0];
        return {
          requirementLineId: key.includes('-') ? key : null,
          productId: rec.productId,
          productCode: rec.product?.code,
          productName: rec.product?.name,
          unit: rec.unit,
          consumedQuantity: consumed,
        };
      });
      return { orderId, orderNumber: order.orderNumber, source: 'EXPLICIT', lines, records: explicit };
    }

    const netIssued = await this.postedNetIssuedByProduct(orderId, ctx);
    const lines = Array.from(netIssued.entries())
      .map(([productId, quantity]) => {
        const reqLine = frozen?.lines.find((l: any) => l.productId === productId);
        return {
          productId,
          productCode: reqLine?.productCodeSnapshot ?? null,
          productName: reqLine?.productNameSnapshot ?? null,
          requirementLineId: reqLine?.id ?? null,
          plannedQuantity: reqLine ? new Prisma.Decimal(reqLine.plannedQuantity) : null,
          unit: reqLine?.issueUnit ?? null,
          consumedQuantity: quantity,
        };
      })
      .filter((l: any) => l.consumedQuantity.greaterThan(0));

    const unlistedConsumed = lines.filter((l: any) => !l.requirementLineId);
    return {
      orderId,
      orderNumber: order.orderNumber,
      source: 'DERIVED_NET_ISSUE',
      lines,
      unlistedConsumed,
      warnings: unlistedConsumed.length > 0 ? ['productionMaterialRequirement.unlistedConsumedWarning'] : [],
    };
  }

  /** Materials issued per requirement line for a run (snapshot + ledger, no separate authority). */
  async getRunMaterialsSummary(runId: string, ctx: ActiveOperationalContext) {
    const run = await (this.prisma as any).productionRun.findFirst({
      where: { id: runId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionMaterialRequirement.runNotFound');

    const frozen = await this.findFrozenRequirement(run.productionOrderId, ctx);
    const docs = await (this.prisma as any).productionMaterialDocument.findMany({
      where: { productionRunId: runId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'POSTED' },
      include: { lines: true },
    });
    const out = new Map<string, Prisma.Decimal>();
    const inn = new Map<string, Prisma.Decimal>();
    for (const doc of docs) {
      const isOut = MATERIAL_OUT_DOCUMENT_TYPES.includes(doc.documentType);
      for (const line of doc.lines) {
        const map = isOut ? out : inn;
        const current = map.get(line.productId) ?? new Prisma.Decimal(0);
        map.set(line.productId, current.plus(new Prisma.Decimal(line.quantity)));
      }
    }
    const productIds = new Set([...out.keys(), ...inn.keys()]);
    const lines = Array.from(productIds).map((productId) => {
      const o = out.get(productId) ?? new Prisma.Decimal(0);
      const i = inn.get(productId) ?? new Prisma.Decimal(0);
      const net = o.minus(i).toDecimalPlaces(4);
      const reqLine = frozen?.lines.find((l: any) => l.productId === productId);
      return {
        productId,
        productCode: reqLine?.productCodeSnapshot ?? null,
        productName: reqLine?.productNameSnapshot ?? null,
        requirementLineId: reqLine?.id ?? null,
        plannedQuantity: reqLine ? new Prisma.Decimal(reqLine.plannedQuantity) : null,
        issuedQuantity: o,
        returnedQuantity: i,
        netIssued: net,
      };
    });
    return { runId, runNumber: run.runNumber, orderId: run.productionOrderId, lines };
  }

  /** Run-scoped consumption summary; explicit facts authoritative, else derived net issue. */
  async getRunConsumptionSummary(runId: string, ctx: ActiveOperationalContext) {
    const run = await (this.prisma as any).productionRun.findFirst({
      where: { id: runId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionMaterialRequirement.runNotFound');

    const explicit = await (this.prisma as any).productionMaterialConsumption.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, productionRunId: runId },
      include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
    });

    if (explicit.length > 0) {
      const totals = new Map<string, Prisma.Decimal>();
      for (const rec of explicit) {
        let total = rec.quantity;
        if (rec.corrections.length > 0) total = rec.corrections[rec.corrections.length - 1].newQuantity;
        const key = rec.requirementLineId ?? rec.productId;
        totals.set(key, (totals.get(key) ?? new Prisma.Decimal(0)).plus(new Prisma.Decimal(total)));
      }
      const lines = Array.from(totals.entries()).map(([key, consumed]) => {
        const rec = explicit.find((r: any) => (r.requirementLineId ?? r.productId) === key)!;
        return {
          requirementLineId: key.includes('-') ? key : null,
          productId: rec.productId,
          productCode: rec.product?.code,
          productName: rec.product?.name,
          unit: rec.unit,
          consumedQuantity: consumed,
        };
      });
      return { runId, runNumber: run.runNumber, orderId: run.productionOrderId, source: 'EXPLICIT', lines, records: explicit };
    }

    const summary = await this.getRunMaterialsSummary(runId, ctx);
    return {
      runId,
      runNumber: run.runNumber,
      orderId: run.productionOrderId,
      source: 'DERIVED_NET_ISSUE',
      lines: summary.lines
        .filter((l: any) => l.netIssued.greaterThan(0))
        .map((l: any) => ({ ...l, consumedQuantity: l.netIssued })),
    };
  }

  /**
   * Records an explicit consumption fact. Consumption is a fact about what the
   * order/run consumed; it never posts a second inventory movement. It requires
   * a source, an actor (JWT user), and an idempotency requestId. Total effective
   * consumption per requirement line (including corrections) may never exceed
   * the net issued quantity, so a consumption fact can never inflate usage
   * beyond what was actually taken from stock.
   */
  async recordConsumption(dto: RecordMaterialConsumptionDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await (this.prisma as any).productionMaterialConsumption.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId: dto.requestId },
      include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
    });
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const raced = await (tx as any).productionMaterialConsumption.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId: dto.requestId },
          include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
        });
        if (raced) return raced;

        const order = await this.findOwnedOrder(dto.productionOrderId, ctx, tx);
        const frozen = await this.findFrozenRequirement(order.id, ctx, tx);
        if (!frozen) throw this.badRequest('productionMaterialRequirement.missingFrozenSnapshot');

        let run: any = null;
        if (dto.productionRunId) {
          run = await (tx as any).productionRun.findFirst({
            where: { id: dto.productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          });
          if (!run) throw this.notFound('productionMaterialRequirement.runNotFound');
          if (run.productionOrderId !== order.id) throw this.badRequest('productionMaterialRequirement.orderRunMismatch');
        }

        const product = await tx.product.findUnique({ where: { id: dto.productId } });
        if (!product) throw this.notFound('productionMaterialRequirement.productNotFound');

        let requirementLine: any = null;
        if (dto.requirementLineId) {
          requirementLine = frozen.lines.find((l: any) => l.id === dto.requirementLineId);
          if (!requirementLine) throw this.badRequest('productionMaterialRequirement.lineNotInFrozenSnapshot');
          if (requirementLine.productId !== product.id) throw this.badRequest('productionMaterialRequirement.lineProductMismatch');
        }

        const quantity = new Prisma.Decimal(Number(dto.quantity.toFixed(4)));

        const lineId = requirementLine?.id;
        const records = await (tx as any).productionMaterialConsumption.findMany({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, productionOrderId: order.id, requirementLineId: lineId },
          include: { corrections: true },
        });
        if (lineId) {
          const effectiveConsumed = records.reduce(
            (sum: Prisma.Decimal, r: any) => sum.plus(r.corrections.length > 0 ? new Prisma.Decimal(r.corrections[r.corrections.length - 1].newQuantity) : new Prisma.Decimal(r.quantity)),
            new Prisma.Decimal(0),
          );
          const net = await this.postedNetIssuedByProduct(order.id, ctx, tx);
          const issued = net.get(product.id) ?? new Prisma.Decimal(0);
          if (effectiveConsumed.plus(quantity).greaterThan(issued)) {
            throw this.badRequest('productionMaterialRequirement.consumptionExceedsIssued');
          }
        }

        const consumption = await (tx as any).productionMaterialConsumption.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            productionOrderId: order.id,
            productionRunId: run?.id ?? null,
            requirementId: frozen.id,
            requirementLineId: lineId ?? null,
            productId: product.id,
            productCodeSnapshot: product.code ?? '',
            productNameSnapshot: product.name ?? '',
            unit: dto.unit,
            quantity,
            method: 'EXPLICIT',
            sourceType: dto.sourceDocumentId || dto.sourceDocumentNumber ? (dto.sourceDocumentType ?? 'DOCUMENT') : 'MANUAL',
            sourceDocumentId: dto.sourceDocumentId ?? null,
            sourceDocumentNumber: dto.sourceDocumentNumber ?? null,
            sourceDocumentType: dto.sourceDocumentType ?? null,
            recordedById: userId,
            requestId: dto.requestId,
            notes: dto.notes ?? null,
          },
          include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
        });

        await this.writeAudit(tx, userId, 'RECORD_CONSUMPTION', PRODUCTION_MATERIAL_CONSUMPTION_AUDIT_ENTITY, consumption.id, ctx, {
          orderNumber: order.orderNumber,
          productionRunId: run?.id ?? null,
          productId: product.id,
          quantity: consumption.quantity.toString(),
        });
        return consumption;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const raced = await (this.prisma as any).productionMaterialConsumption.findFirst({
          where: { companyId: ctx.companyId, branchId: ctx.branchId, requestId: dto.requestId },
          include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
        });
        if (raced) return raced;
        throw this.conflict('productionMaterialRequirement.duplicateRequest');
      }
      throw error;
    }
  }

  /** Corrects an explicit consumption fact; every correction is an audited, reason-required record. */
  async correctConsumption(id: string, dto: CorrectMaterialConsumptionDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const consumption = await (tx as any).productionMaterialConsumption.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
        include: { ...PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE, corrections: true },
      });
      if (!consumption) throw this.notFound('productionMaterialRequirement.consumptionNotFound');

      const previousQuantity = new Prisma.Decimal(consumption.quantity);
      const newQuantity = new Prisma.Decimal(Number(dto.newQuantity.toFixed(4)));

      await (tx as any).productionMaterialConsumptionCorrection.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          consumptionId: id,
          previousQuantity,
          newQuantity,
          reason: dto.reason,
          correctedById: userId,
        },
      });

      const updated = await (tx as any).productionMaterialConsumption.update({
        where: { id },
        data: { quantity: newQuantity },
        include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
      });

      await this.writeAudit(tx, userId, 'CORRECT_CONSUMPTION', PRODUCTION_MATERIAL_CONSUMPTION_AUDIT_ENTITY, id, ctx, {
        orderNumber: consumption.productionOrder?.orderNumber,
        previousQuantity: previousQuantity.toString(),
        newQuantity: newQuantity.toString(),
        reason: dto.reason,
      });
      return updated;
    });
  }

  async getConsumptionHistory(orderId: string, query: ConsumptionQueryDto, ctx: ActiveOperationalContext) {
    await this.findOwnedOrder(orderId, ctx);
    const page = query.page || 1;
    const limit = query.limit || 50;
    const where = { companyId: ctx.companyId, branchId: ctx.branchId, productionOrderId: orderId };
    const [data, total] = await Promise.all([
      (this.prisma as any).productionMaterialConsumption.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ recordedAt: 'desc' }],
        include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
      }),
      (this.prisma as any).productionMaterialConsumption.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Full material traceability for an order: frozen snapshot, every posted
   * material document line (with any loss event link and return references),
   * and the explicit consumption history. Loss linkage is validated at posting
   * time (one loss event → at most one equivalent stock-impact source), so this
   * view never fabricates a link.
   */
  async getOrderTraceability(orderId: string, ctx: ActiveOperationalContext) {
    const order = await this.findOwnedOrder(orderId, ctx);
    const frozen = await this.findFrozenRequirement(orderId, ctx);

    const docs = await (this.prisma as any).productionMaterialDocument.findMany({
      where: { productionOrderId: orderId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'POSTED' },
      orderBy: [{ documentDate: 'asc' }],
      include: {
        productionRun: { select: { id: true, runNumber: true } },
        movement: { select: { id: true, movementNumber: true, movementType: true, status: true } },
        issueWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            product: { select: { id: true, code: true, name: true } },
            substitutedProduct: { select: { id: true, code: true, name: true } },
            requirementLine: { select: { id: true, lineNumber: true, plannedQuantity: true } },
            originalIssueLine: { select: { id: true, productId: true, lineNumber: true } },
            lossQuantityEvent: {
              select: {
                id: true,
                eventNumber: true,
                lossType: true,
                lostQuantity: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    const consumptions = await (this.prisma as any).productionMaterialConsumption.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, productionOrderId: orderId },
      orderBy: [{ recordedAt: 'asc' }],
      include: PRODUCTION_MATERIAL_CONSUMPTION_INCLUDE,
    });

    return {
      orderId,
      orderNumber: order.orderNumber,
      snapshot: frozen
        ? {
            id: frozen.id,
            revision: frozen.revision,
            status: frozen.status,
            preparedAt: frozen.preparedAt,
            frozenAt: frozen.frozenAt,
            productDefinitionCodeSnapshot: frozen.productDefinitionCodeSnapshot,
            productVersionLabelSnapshot: frozen.productVersionLabelSnapshot,
            lines: frozen.lines,
          }
        : null,
      documents: docs,
      consumptionRecords: consumptions,
    };
  }
}
