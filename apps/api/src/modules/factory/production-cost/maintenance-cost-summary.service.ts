import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { MAINTENANCE_COST_PURPOSE } from '../../../common/cost-purpose/cost-purpose.constants';
import { ENTRY_ROLE_PRIMARY_COST, ENTRY_ROLE_REVERSAL, MAINTENANCE_LABOR_SOURCE_TYPE } from '../production-cost/production-cost.constants';

export type CanonicalCostScope = 'REQUEST' | 'WORK_ORDER';

export interface CanonicalCostBucket {
  key: string;
  netAmount: string;
  entryCount: number;
}

export interface CanonicalCostSummary {
  scope: CanonicalCostScope;
  entityId: string;
  entityNumber: string | null;
  status: string | null;
  currencyCode: string | null;
  netCost: string;
  postedEntryCount: number;
  reversalEntryCount: number;
  byEventType: CanonicalCostBucket[];
  byCostNature: CanonicalCostBucket[];
  byCurrency: CanonicalCostBucket[];
  nonCanonicalRowCount: number;
  nonCanonicalRowExplanation: string;
  sourceReconciliation: {
    sourceKind: string;
    sourceEntryCount: number;
    postedSourceEntryCount: number;
    unpostedSourceEntryCount: number;
    unpostedSourceEntryIds: string[];
    unpostedReason: 'WORK_ORDER_NOT_COMPLETED' | 'NO_UNPOSTED_SOURCES' | 'POSTING_GAP_AFTER_COMPLETION' | 'NOT_APPLICABLE';
    nextAction: string | null;
  };
}

/**
 * R2-H: the canonical maintenance cost read model.
 *
 * Every number returned here is read from OperationalCostTransaction, which is
 * the single frozen Cost Program authority for money. Nothing in this service
 * reads MaintenanceRequestPartUsage or MaintenanceRequestCostEntry for a
 * total: those legacy tables are historical evidence only and are reported as
 * a separate non-canonical count so an operator can see that they exist and
 * are deliberately excluded, rather than silently summing them.
 *
 * The arithmetic mirrors the frozen reconciliation service exactly: only rows
 * whose entryRole is PRIMARY_COST or REVERSAL contribute to the net position,
 * reversals are stored negated, and legacy or invalid rows are counted but
 * never summed (summing them would double-count). All amounts are
 * Prisma.Decimal and are serialized as strings so no binary float rounding
 * can enter the result.
 */
@Injectable()
export class MaintenanceCostSummaryService {
  constructor(private prisma: PrismaService) {}

  async requestSummary(requestId: string, ctx: ActiveOperationalContext): Promise<CanonicalCostSummary> {
    const request = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, deletedAt: null, machine: { companyId: ctx.companyId, branchId: ctx.branchId } },
      select: { id: true, requestNumber: true, status: true },
    });
    if (!request) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');

    return this.build('REQUEST', request.id, request.requestNumber, request.status, {
      maintenanceRequestId: requestId,
    }, ctx, 'NOT_APPLICABLE', null);
  }

  async workOrderSummary(workOrderId: string, ctx: ActiveOperationalContext): Promise<CanonicalCostSummary> {
    const workOrder = await this.prisma.maintenanceWorkOrder.findFirst({
      where: {
        id: workOrderId,
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
      select: { id: true, workOrderNumber: true, status: true },
    });
    if (!workOrder) throw this.notFound('maintenance.workOrderNotFound', 'Maintenance work order not found');

    const sourceEntries = await this.prisma.maintenanceWorkOrderCostEntry.findMany({
      where: { workOrderId },
      select: { id: true, type: true },
    });

    return this.build('WORK_ORDER', workOrder.id, workOrder.workOrderNumber, workOrder.status, {
      maintenanceWorkOrderId: workOrderId,
    }, ctx, MAINTENANCE_LABOR_SOURCE_TYPE, sourceEntries);
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private async build(
    scope: CanonicalCostScope,
    entityId: string,
    entityNumber: string | null,
    status: string | null,
    ledgerScope: { maintenanceRequestId: string } | { maintenanceWorkOrderId: string },
    ctx: ActiveOperationalContext,
    sourceKind: string,
    unpostedCandidates: { id: string; type: string }[] | null,
  ): Promise<CanonicalCostSummary> {
    const rows = await this.prisma.operationalCostTransaction.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        costPurpose: MAINTENANCE_COST_PURPOSE,
        ...ledgerScope,
      },
      select: {
        id: true,
        eventType: true,
        entryRole: true,
        costNature: true,
        amount: true,
        currencyCode: true,
        sourceType: true,
        sourceId: true,
        status: true,
      },
    });

    const eventType = new Map<string, CanonicalCostBucket>();
    const costNature = new Map<string, CanonicalCostBucket>();
    const currency = new Map<string, CanonicalCostBucket>();
    let net = new Prisma.Decimal(0);
    let postedEntryCount = 0;
    let reversalEntryCount = 0;
    let nonCanonicalRowCount = 0;

    const add = (map: Map<string, CanonicalCostBucket>, key: string, amount: Prisma.Decimal) => {
      const existing = map.get(key);
      if (existing) {
        existing.netAmount = new Prisma.Decimal(existing.netAmount).add(amount).toString();
        existing.entryCount += 1;
      } else {
        map.set(key, { key, netAmount: amount.toString(), entryCount: 1 });
      }
    };

    for (const row of rows) {
      const role = row.entryRole;
      const isCanonical = role === ENTRY_ROLE_PRIMARY_COST || role === ENTRY_ROLE_REVERSAL;
      if (!isCanonical) {
        nonCanonicalRowCount += 1;
        continue;
      }
      net = net.add(row.amount);
      if (role === ENTRY_ROLE_REVERSAL) reversalEntryCount += 1;
      else postedEntryCount += 1;
      add(eventType, row.eventType, row.amount);
      add(costNature, row.costNature ?? 'UNCLASSIFIED', row.amount);
      add(currency, row.currencyCode, row.amount);
    }

    let postedSourceEntryCount = 0;
    const unpostedSourceEntryIds: string[] = [];
    if (unpostedCandidates) {
      const postedSourceIds = new Set(
        rows
          .filter(r => r.entryRole === ENTRY_ROLE_PRIMARY_COST && r.sourceType === sourceKind)
          .map(r => r.sourceId),
      );
      for (const candidate of unpostedCandidates) {
        if (postedSourceIds.has(candidate.id)) postedSourceEntryCount += 1;
        else unpostedSourceEntryIds.push(candidate.id);
      }
    }

    const unpostedCount = unpostedSourceEntryIds.length;
    const notCompleted = status !== 'COMPLETED';
    const reconciliation = {
      sourceKind,
      sourceEntryCount: unpostedCandidates?.length ?? 0,
      postedSourceEntryCount,
      unpostedSourceEntryCount: unpostedCount,
      unpostedSourceEntryIds,
      unpostedReason: (unpostedCount === 0
        ? 'NO_UNPOSTED_SOURCES'
        : notCompleted ? 'WORK_ORDER_NOT_COMPLETED' : 'POSTING_GAP_AFTER_COMPLETION') as
        'WORK_ORDER_NOT_COMPLETED' | 'NO_UNPOSTED_SOURCES' | 'POSTING_GAP_AFTER_COMPLETION' | 'NOT_APPLICABLE',
      nextAction: unpostedCount > 0
        ? (notCompleted
          ? 'Complete the work order so its labor and external-service assertions post to the operational cost ledger'
          : 'The work order is complete but an asserted cost has no ledger entry; review the posting failure before reconciling this total')
        : null,
    };

    return {
      scope,
      entityId,
      entityNumber,
      status,
      currencyCode: currency.size === 1 ? [...currency.keys()][0] : null,
      netCost: net.toString(),
      postedEntryCount,
      reversalEntryCount,
      byEventType: [...eventType.values()].sort((a, b) => a.key.localeCompare(b.key)),
      byCostNature: [...costNature.values()].sort((a, b) => a.key.localeCompare(b.key)),
      byCurrency: [...currency.values()].sort((a, b) => a.key.localeCompare(b.key)),
      nonCanonicalRowCount,
      nonCanonicalRowExplanation: nonCanonicalRowCount > 0
        ? 'Ledger rows without a canonical entry role exist in this scope and are excluded from the net total to prevent double counting'
        : 'NO_LEDGER_ROWS',
      sourceReconciliation: reconciliation,
    };
  }
}
