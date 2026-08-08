import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

/**
 * Shared Phase 2 foundation for analytics source-change / invalidation watermarks.
 *
 * Analytics are always computed live from the source tables; there is no cache to
 * invalidate. This service is the single, tenant-scoped place that records when a
 * fact feeding analytics changed (material-document reversal, cost reversal,
 * snapshot/rate correction) and lets read endpoints surface that metadata/warning.
 *
 * It is intentionally a small helper + one table, not a cross-domain framework.
 * Every write is scoped by the active operational context and never trusts a
 * client-supplied company/branch.
 */

export const OPERATIONAL_SOURCE_CHANGE_SCOPE_TYPES = ['BRANCH', 'ORDER', 'RUN', 'PRODUCT', 'LINE', 'MACHINE'] as const;
export const OPERATIONAL_SOURCE_CHANGE_TYPES = ['REVERSAL', 'CORRECTION', 'SOURCE_UPDATE'] as const;
export const OPERATIONAL_SOURCE_CHANGE_ENTITY_TYPES = [
  'PRODUCTION_MATERIAL_DOCUMENT',
  'OPERATIONAL_COST_TRANSACTION',
  'OPERATIONAL_STANDARD_COST_SNAPSHOT',
  'OPERATIONAL_COST_RATE',
] as const;

export type OperationalSourceChangeScopeType = (typeof OPERATIONAL_SOURCE_CHANGE_SCOPE_TYPES)[number];
export type OperationalSourceChangeType = (typeof OPERATIONAL_SOURCE_CHANGE_TYPES)[number];

export interface RecordSourceChangeInput {
  scopeType: OperationalSourceChangeScopeType;
  scopeId: string;
  entityType: string;
  entityId: string;
  changeType: OperationalSourceChangeType;
  reason?: string;
}

export interface SourceChangeSummary {
  changeCount: number;
  lastChangeAt: string | null;
  changes: Array<{
    id: string;
    scopeType: string;
    scopeId: string;
    entityType: string;
    entityId: string;
    changeType: string;
    reason: string | null;
    actorId: string;
    createdAt: string;
  }>;
}

@Injectable()
export class OperationalSourceChangesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a tenant-scoped source change inside the caller's transaction. Returns
   * the created watermark row. Must only be called with a validated operational
   * context; company/branch are taken from the context, never from the input.
   */
  async recordChange(
    client: any,
    ctx: ActiveOperationalContext,
    input: RecordSourceChangeInput,
    userId: string,
    actorName?: string,
  ) {
    return client.operationalSourceChange.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        entityType: input.entityType,
        entityId: input.entityId,
        changeType: input.changeType,
        reason: input.reason ?? null,
        actorId: userId,
        actorName: actorName ?? null,
      },
    });
  }

  /**
   * Deterministic watermark for a scope: latest change timestamp + recent change
   * rows. Used to surface "source data was adjusted" metadata on read endpoints.
   */
  async summaryForScope(scopeType: string, scopeId: string, ctx: ActiveOperationalContext, limit = 10): Promise<SourceChangeSummary> {
    const where = { companyId: ctx.companyId, branchId: ctx.branchId, scopeType, scopeId };
    const [changes, count] = await Promise.all([
      (this.prisma as any).operationalSourceChange.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      }),
      (this.prisma as any).operationalSourceChange.count({ where }),
    ]);
    return {
      changeCount: count,
      lastChangeAt: changes[0]?.createdAt?.toISOString() ?? null,
      changes: changes.map((change: any) => ({
        id: change.id,
        scopeType: change.scopeType,
        scopeId: change.scopeId,
        entityType: change.entityType,
        entityId: change.entityId,
        changeType: change.changeType,
        reason: change.reason,
        actorId: change.actorId,
        createdAt: change.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Recent source changes inside a reporting window, tenant/branch scoped and
   * optionally narrowed by scope filters. Used by analytics read endpoints.
   */
  async findByWindow(
    ctx: ActiveOperationalContext,
    window: { from: Date; to: Date },
    scope: { orderId?: string; runId?: string; productionLineId?: string; machineId?: string; productDefinitionId?: string },
    limit = 20,
  ) {
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      createdAt: { gte: window.from, lte: window.to },
      OR: [],
    };
    const addScope = (scopeType: string, scopeId: string | undefined | null) => {
      if (scopeId) where.OR.push({ scopeType, scopeId });
    };
    addScope('ORDER', scope.orderId);
    addScope('RUN', scope.runId);
    addScope('LINE', scope.productionLineId);
    addScope('MACHINE', scope.machineId);
    addScope('PRODUCT', scope.productDefinitionId);
    if (where.OR.length === 0) {
      where.OR.push({ scopeType: 'BRANCH', scopeId: ctx.branchId });
    }
    const rows = await (this.prisma as any).operationalSourceChange.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
    return rows.map((change: any) => ({
      id: change.id,
      scopeType: change.scopeType,
      scopeId: change.scopeId,
      entityType: change.entityType,
      entityId: change.entityId,
      changeType: change.changeType,
      reason: change.reason,
      actorId: change.actorId,
      createdAt: change.createdAt.toISOString(),
    }));
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const change = await (this.prisma as any).operationalSourceChange.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
    });
    if (!change) throw new NotFoundException({ messageKey: 'analytics.sourceChangeNotFound', message: 'analytics.sourceChangeNotFound' });
    return change;
  }
}
