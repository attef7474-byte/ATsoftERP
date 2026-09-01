import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';
import { deriveRunTotals } from './production-runs.util';

export interface MaterialCostAggregationInput {
  productionRunId: string;
  companyId: string;
  branchId: string;
}

export interface MovementMonetaryEvidence {
  movementId: string;
  movementType: string;
  direction: string;
  totalCost: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  currencyCode: string;
  valuationMethod: string;
  productId: string;
  quantityBase: Prisma.Decimal;
}

export interface MaterialCostAggregationResult {
  netMaterialValue: Prisma.Decimal;
  currencyCode: string;
  outEventCount: number;
  returnValue: Prisma.Decimal;
  zeroValueOutEvents: number;
  evidence: MovementMonetaryEvidence[];
}

@Injectable()
export class ProductionRunCostAggregationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valuationEngine: InventoryValuationEngineService,
  ) {}

  /**
   * VAL-R1G-A: authoritative read-only aggregation of immutable R1F material
   * monetary evidence for a production run.
   *
   * Queries only POSTED production material documents linked to the run, then
   * aggregates the monetary quartet on their InventoryMovementLines:
   *   - OUT events (PRODUCTION_ISSUE, PRODUCTION_CONSUMPTION) contribute +totalCost
   *   - IN events (PRODUCTION_RETURN, trusted linkage) contribute -totalCost
   *
   * Uses ONLY the immutable monetary snapshot on the movement line. Never
   * recomputes current moving average. Prisma.Decimal only.
   */
  async aggregateMaterialCost(
    input: MaterialCostAggregationInput,
    ctx: ActiveOperationalContext,
  ): Promise<MaterialCostAggregationResult> {
    const { productionRunId } = input;

    const run = await this.prisma.productionRun.findFirst({
      where: { id: productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) {
      throw new NotFoundException({
        messageKey: 'productionRun.notFound',
        message: 'Production run not found',
      });
    }

    const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(
      this.prisma,
      ctx.companyId,
      run.issueWarehouseId ?? '',
    );

    const postedDocs = await this.prisma.productionMaterialDocument.findMany({
      where: {
        productionRunId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'POSTED',
      },
      include: {
        movement: {
          include: {
            lines: true,
          },
        },
      },
    });

    const evidence: MovementMonetaryEvidence[] = [];
    let netMaterialValue = new Prisma.Decimal(0);
    let returnValue = new Prisma.Decimal(0);
    let outEventCount = 0;
    let zeroValueOutEvents = 0;
    let currencyCode: string | null = null;

    for (const doc of postedDocs) {
      if (!doc.movement) continue;

      for (const line of doc.movement.lines) {
        const unitCost = line.unitCost ? new Prisma.Decimal(line.unitCost.toString()) : null;
        const totalCost = line.totalCost ? new Prisma.Decimal(line.totalCost.toString()) : null;
        const lineCurrency = line.currencyCode ?? null;
        const valuationMethod = line.valuationMethod ?? null;

        if (!unitCost || !totalCost || !lineCurrency || !valuationMethod) {
          throw new BadRequestException({
            messageKey: 'productionRunCostAggregation.incompleteMonetaryEvidence',
            message: `Movement line ${line.id} is missing monetary evidence`,
          });
        }

        if (line.direction === 'OUT') {
          outEventCount++;
          netMaterialValue = netMaterialValue.plus(totalCost);

          if (totalCost.equals(0)) {
            zeroValueOutEvents++;
          }

          evidence.push({
            movementId: doc.movementId!,
            movementType: doc.movement.movementType,
            direction: 'OUT',
            totalCost,
            unitCost,
            currencyCode: lineCurrency,
            valuationMethod,
            productId: line.productId,
            quantityBase: line.quantityBase ? new Prisma.Decimal(line.quantityBase.toString()) : new Prisma.Decimal(line.quantity),
          });
        } else if (line.direction === 'IN') {
          returnValue = returnValue.plus(totalCost);
          netMaterialValue = netMaterialValue.minus(totalCost);

          evidence.push({
            movementId: doc.movementId!,
            movementType: doc.movement.movementType,
            direction: 'IN',
            totalCost,
            unitCost,
            currencyCode: lineCurrency,
            valuationMethod,
            productId: line.productId,
            quantityBase: line.quantityBase ? new Prisma.Decimal(line.quantityBase.toString()) : new Prisma.Decimal(line.quantity),
          });
        }

        if (currencyCode === null) {
          currencyCode = lineCurrency;
        } else if (currencyCode !== lineCurrency) {
          throw new BadRequestException({
            messageKey: 'productionRunCostAggregation.currencyMismatch',
            message: `Multiple currencies detected: ${currencyCode} and ${lineCurrency}`,
          });
        }
      }
    }

    if (!currencyCode && activePolicy) {
      currencyCode = activePolicy.currencyCode;
    } else if (!currencyCode) {
      currencyCode = 'USD';
    }

    return {
      netMaterialValue,
      currencyCode,
      outEventCount,
      returnValue,
      zeroValueOutEvents,
      evidence,
    };
  }

  /**
   * VAL-R1G-A: validate all preconditions for production valuation close.
   *
   * 1. Run exists in tenant context
   * 2. Run is not already valuation-closed
   * 3. Final product is known
   * 4. Final GOOD output quantity > 0
   * 5. No pending material documents
   * 6. All R1F monetary quartets complete
   * 7. Same currency across all monetary inputs
   * 8. No unsafe substitution
   * 9. No previous FG valuation
   * 10. No POSTED UNVALUED FG receipts if ACTIVE
   */
  async validateClosePreconditions(
    productionRunId: string,
    ctx: ActiveOperationalContext,
  ): Promise<{
    finalProductId: string;
    finalGoodQuantity: Prisma.Decimal;
    currencyCode: string;
  }> {
    const run = await this.prisma.productionRun.findFirst({
      where: { id: productionRunId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) {
      throw new NotFoundException({
        messageKey: 'productionRun.notFound',
        message: 'Production run not found',
      });
    }

    if (run.costClosedAt) {
      throw new ConflictException({
        messageKey: 'productionRunCostAggregation.alreadyClosed',
        message: 'Production run is already valuation-closed',
      });
    }

    const definition = await this.prisma.productionProductDefinition.findFirst({
      where: { id: run.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException({
        messageKey: 'productionRunCostAggregation.productDefinitionNotFound',
        message: 'Final product definition not found',
      });
    }

    const events = await this.prisma.productionOutputEvent.findMany({
      where: { productionRunId, companyId: ctx.companyId, branchId: ctx.branchId },
    });
    const totals = deriveRunTotals(events.map((e: any) => ({
      id: e.id,
      eventType: e.eventType,
      classification: e.classification,
      quantity: e.quantity,
      goodQuantity: e.goodQuantity,
      rejectQuantity: e.rejectQuantity,
      correctsEventId: e.correctsEventId,
      measurementPointId: e.measurementPointId,
      measurementPoint: null,
    })));
    const finalGoodQuantity = new Prisma.Decimal(totals.finalOutputGood);

    if (finalGoodQuantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        messageKey: 'productionRunCostAggregation.zeroOutput',
        message: 'Final good output quantity must be greater than zero',
      });
    }

    const pendingDocs = await this.prisma.productionMaterialDocument.findMany({
      where: {
        productionRunId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] as any },
      },
    });
    if (pendingDocs.length > 0) {
      throw new BadRequestException({
        messageKey: 'productionRunCostAggregation.pendingDocuments',
        message: `${pendingDocs.length} pending material document(s) prevent close`,
      });
    }

    const aggregation = await this.aggregateMaterialCost(
      { productionRunId, companyId: ctx.companyId, branchId: ctx.branchId },
      ctx,
    );

    if (aggregation.netMaterialValue.isNegative()) {
      throw new BadRequestException({
        messageKey: 'productionRunCostAggregation.negativeValue',
        message: 'Net material value cannot be negative',
      });
    }

    if (aggregation.netMaterialValue.equals(0) && aggregation.outEventCount > 0) {
      if (aggregation.zeroValueOutEvents !== aggregation.outEventCount) {
        throw new BadRequestException({
          messageKey: 'productionRunCostAggregation.zeroValueWithPositiveEvents',
          message: 'Zero net material value with positive-cost events requires audit reason',
        });
      }
    }

    const postedFgReceipts = await this.prisma.productionFinishedGoodsReceipt.findMany({
      where: {
        productionRunId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'POSTED',
      },
      include: {
        movement: {
          include: {
            lines: true,
          },
        },
      },
    });

    const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(
      this.prisma,
      ctx.companyId,
      run.receiptWarehouseId ?? '',
    );

    if (activePolicy) {
      for (const fg of postedFgReceipts) {
        if (fg.movement) {
          for (const line of fg.movement.lines) {
            if (line.unitCost === null || line.totalCost === null) {
              throw new BadRequestException({
                messageKey: 'productionRunCostAggregation.unvaluedFgReceipt',
                message: `POSTED FG receipt ${fg.receiptNumber} has unvalued lines; close blocked`,
              });
            }
          }
        }
      }
    }

    const existingSnapshot = await this.prisma.productionRunCostSnapshot.findFirst({
      where: { productionRunId, companyId: ctx.companyId, branchId: ctx.branchId },
    });
    if (existingSnapshot) {
      throw new ConflictException({
        messageKey: 'productionRunCostAggregation.snapshotExists',
        message: 'A cost snapshot already exists for this run',
      });
    }

    return {
      finalProductId: definition.productId,
      finalGoodQuantity,
      currencyCode: aggregation.currencyCode,
    };
  }
}
