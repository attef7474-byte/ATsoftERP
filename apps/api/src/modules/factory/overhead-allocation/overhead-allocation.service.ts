import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { acquireOverheadAllocationBoundary, overheadAllocationBoundary } from '../../../common/cost-purpose/overhead-allocation-boundary';
import { AuditService } from '../../audit/audit.service';
import { AllocationNotesDto, AllocationPageDto, AllocationQueryDto, CreateOverheadAllocationDto, ReverseOverheadAllocationLedgerDto } from './overhead-allocation.dto';
import { calculateOverheadAllocation, OVERHEAD_ALLOCATION_MAX_SOURCES, OVERHEAD_ALLOCATION_MAX_TARGETS } from './overhead-allocation.engine';
import {
  ENTRY_ROLE_PRIMARY_COST,
  MANUAL_AMOUNT_UNIT,
  OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE,
  OVERHEAD_EVENT_TYPE,
} from '../production-cost/production-cost.constants';
import { ProductionCostService } from '../production-cost/production-cost.service';
import { OperationalCostReconciliationService } from '../production-cost/operational-cost-reconciliation.service';
import {
  nextOverheadAllocationGeneration,
  overheadAllocationClientRequestId,
  overheadAllocationLedgerFingerprint,
  parseOverheadAllocationGeneration,
  OVERHEAD_ALLOCATION_LEDGER_POST_ACTION,
  OVERHEAD_ALLOCATION_LEDGER_REVERSE_ACTION,
} from './overhead-allocation.ledger';

const ENTITY = 'OperationalOverheadPeriodAllocation';
const headerInclude = { period: { select: { code: true } }, _count: { select: { lines: true, sources: true } } } satisfies Prisma.OperationalOverheadPeriodAllocationInclude;

@Injectable()
export class OverheadAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly productionCost: ProductionCostService,
    private readonly reconciliationAuthority: OperationalCostReconciliationService,
  ) {}
  private bad(messageKey: string): never { throw new BadRequestException({ messageKey }); }
  private conflict(messageKey: string): never { throw new ConflictException({ messageKey }); }
  private tenant(ctx: ActiveOperationalContext) {
    overheadAllocationBoundary(ctx);
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }
  private scope(ctx: ActiveOperationalContext) {
    return { ...this.tenant(ctx), companyKey: ctx.companyId, branchKey: ctx.branchId };
  }
  private page(query: AllocationPageDto) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) this.bad('overheadAllocation.invalidInputs');
    return { page, limit, skip: (page - 1) * limit };
  }
  private async boundary<T>(ctx: ActiveOperationalContext, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    this.tenant(ctx);
    try {
      return await this.prisma.$transaction(async tx => {
        await acquireOverheadAllocationBoundary(tx, ctx);
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) this.conflict('overhead.concurrencyConflict');
      throw error;
    }
  }
  private async owned(client: Prisma.TransactionClient, id: string, ctx: ActiveOperationalContext) {
    const row = await client.operationalOverheadPeriodAllocation.findFirst({ where: { id, ...this.scope(ctx) }, include: headerInclude });
    if (!row) throw new NotFoundException({ messageKey: 'overheadAllocation.notFound' });
    return row;
  }
  private async closedPeriod(tx: Prisma.TransactionClient, id: string, ctx: ActiveOperationalContext) {
    const period = await tx.operationalOverheadPeriod.findFirst({ where: { id, ...this.scope(ctx), deletedAt: null } });
    if (!period) throw new NotFoundException({ messageKey: 'overhead.periodNotFound' });
    if (period.status !== 'CLOSED' || !period.closedAt || !period.closedById || period.periodTo > new Date()) this.conflict('overheadAllocation.periodNotReady');
    return period;
  }
  private async currency(tx: Prisma.TransactionClient, ctx: ActiveOperationalContext) {
    const company = await tx.company.findFirst({ where: { id: ctx.companyId }, select: { operationalCurrencyCode: true } });
    if (!company?.operationalCurrencyCode || !/^[A-Z]{3}$/.test(company.operationalCurrencyCode)) this.bad('overhead.currencyNotConfigured');
    return company.operationalCurrencyCode;
  }
  private log(tx: Prisma.TransactionClient, userId: string, id: string, action: string, ctx: ActiveOperationalContext, details: Record<string, unknown>) {
    return this.audit.logWithClient(tx, { userId, entity: ENTITY, entityId: id, action, details: { ...this.tenant(ctx), ...details } });
  }

  async create(dto: CreateOverheadAllocationDto, userId: string, ctx: ActiveOperationalContext) {
    return this.boundary(ctx, async tx => {
      const existing = await tx.operationalOverheadPeriodAllocation.findFirst({ where: { ...this.scope(ctx), clientRequestId: dto.clientRequestId }, include: headerInclude });
      if (existing) {
        if (existing.periodId !== dto.periodId || (existing.notes ?? '') !== (dto.notes ?? '')) this.conflict('overheadAllocation.requestConflict');
        return existing;
      }
      const period = await this.closedPeriod(tx, dto.periodId, ctx);
      const allocated = await tx.operationalOverheadPeriodAllocation.findFirst({ where: { ...this.scope(ctx), periodId: period.id } });
      if (allocated) this.conflict('overheadAllocation.periodAlreadyAllocated');
      const currencyCode = await this.currency(tx, ctx);
      const row = await tx.operationalOverheadPeriodAllocation.create({
        data: { ...this.scope(ctx), periodId: period.id, version: 1, status: 'DRAFT', clientRequestId: dto.clientRequestId,
          notes: dto.notes, currencyCode, periodFrom: period.periodFrom, periodTo: period.periodTo, createdById: userId, updatedById: userId },
        include: headerInclude,
      });
      await this.log(tx, userId, row.id, 'OVERHEAD_ALLOCATION_CREATE', ctx, { periodId: row.periodId, version: row.version, status: 'DRAFT' });
      return row;
    });
  }
  async update(id: string, dto: AllocationNotesDto, userId: string, ctx: ActiveOperationalContext) {
    return this.boundary(ctx, async tx => {
      const row = await this.owned(tx, id, ctx);
      if (row.status !== 'DRAFT') this.conflict('overheadAllocation.immutable');
      const updated = await tx.operationalOverheadPeriodAllocation.update({ where: { id, ...this.scope(ctx) }, data: { notes: dto.notes, updatedById: userId }, include: headerInclude });
      await this.log(tx, userId, id, 'OVERHEAD_ALLOCATION_UPDATE', ctx, { periodId: row.periodId, before: { notes: row.notes }, after: { notes: updated.notes } });
      return updated;
    });
  }
  async findAll(query: AllocationQueryDto, ctx: ActiveOperationalContext) {
    const { page, limit, skip } = this.page(query);
    const where: Prisma.OperationalOverheadPeriodAllocationWhereInput = { ...this.scope(ctx), ...(query.status ? { status: query.status } : {}), ...(query.search ? { period: { code: { contains: query.search } } } : {}) };
    const [total, data] = await Promise.all([
      this.prisma.operationalOverheadPeriodAllocation.count({ where }),
      this.prisma.operationalOverheadPeriodAllocation.findMany({ where, skip, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: headerInclude }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  findOne(id: string, ctx: ActiveOperationalContext) { return this.owned(this.prisma, id, ctx); }
  async periods(query: AllocationQueryDto, ctx: ActiveOperationalContext) {
    const { page, limit, skip } = this.page(query);
    const where: Prisma.OperationalOverheadPeriodWhereInput = { ...this.scope(ctx), deletedAt: null, status: 'CLOSED', periodTo: { lte: new Date() }, allocation: null, ...(query.search ? { code: { contains: query.search } } : {}) };
    const [total, data] = await Promise.all([
      this.prisma.operationalOverheadPeriod.count({ where }),
      this.prisma.operationalOverheadPeriod.findMany({ where, select: { id: true, code: true, periodFrom: true, periodTo: true }, skip, take: limit, orderBy: [{ periodFrom: 'desc' }, { id: 'asc' }] }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  private async inputs(tx: Prisma.TransactionClient, row: Awaited<ReturnType<OverheadAllocationService['owned']>>, ctx: ActiveOperationalContext) {
    const period = await this.closedPeriod(tx, row.periodId, ctx);
    if (+period.periodFrom !== +row.periodFrom || +period.periodTo !== +row.periodTo) this.conflict('overheadAllocation.invalidInputs');
    const currencyCode = await this.currency(tx, ctx);
    if (currencyCode !== row.currencyCode) this.conflict('overhead.currencyMismatch');
    const sources = await tx.operationalOverheadEntry.findMany({ where: { ...this.scope(ctx), periodId: period.id, deletedAt: null }, take: OVERHEAD_ALLOCATION_MAX_SOURCES + 1, orderBy: { id: 'asc' } });
    if (sources.length > OVERHEAD_ALLOCATION_MAX_SOURCES) this.bad('overheadAllocation.tooManyInputs');
    for (const source of sources) {
      if (source.status !== 'FINALIZED' || !source.finalizedAt || !source.finalizedById || source.incurredAt < period.periodFrom || source.incurredAt >= period.periodTo) this.conflict('overheadAllocation.invalidSource');
    }
    const targets = await tx.productionRun.findMany({
      where: { ...this.tenant(ctx), deletedAt: null, costClosedAt: { gte: period.periodFrom, lt: period.periodTo } },
      select: { id: true, companyId: true, branchId: true, runNumber: true, costCenterId: true, costClosedAt: true, outputUnitSnapshot: true,
        costSnapshot: { select: { id: true, companyId: true, branchId: true, productionRunId: true, finalGoodQuantity: true, currencyCode: true } } },
      take: OVERHEAD_ALLOCATION_MAX_TARGETS + 1, orderBy: { id: 'asc' },
    });
    if (targets.length > OVERHEAD_ALLOCATION_MAX_TARGETS) this.bad('overheadAllocation.tooManyInputs');
    const centerIds = [...new Set(targets.map(t => t.costCenterId))];
    const centers = new Map<string, { id: string; code: string }>();
    // Batches stay below SQL Server's 2,100-parameter limit; no per-target N+1.
    for (let offset = 0; offset < centerIds.length; offset += 250) {
      const batch = await tx.costCenter.findMany({ where: { id: { in: centerIds.slice(offset, offset + 250) }, companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }], deletedAt: null, status: 'ACTIVE' }, select: { id: true, code: true } });
      batch.forEach(center => centers.set(center.id, center));
    }
    for (const target of targets) {
      const snapshot = target.costSnapshot;
      if (target.id.length > 200 || target.costCenterId.length > 200 || !centers.has(target.costCenterId) || !target.costClosedAt) this.bad('overheadAllocation.invalidTarget');
      if (!snapshot || snapshot.companyId !== ctx.companyId || snapshot.branchId !== ctx.branchId || snapshot.productionRunId !== target.id || !snapshot.finalGoodQuantity.gt(0)) this.bad('overheadAllocation.invalidDriver');
      if (snapshot.currencyCode !== currencyCode) this.bad('overhead.currencyMismatch');
    }
    const calculation = calculateOverheadAllocation(
      sources.map(s => ({ id: s.id, costPurpose: s.costPurpose, amount: s.amount.toFixed(4), currencyCode: s.currencyCode })),
      targets.map(t => ({ id: t.id, driverQuantity: t.costSnapshot!.finalGoodQuantity.toFixed(4) })), currencyCode,
    );
    const targetMap = new Map(targets.map(t => [t.id, t]));
    const lines = calculation.lines.map(line => {
      const target = targetMap.get(line.productionRunId)!;
      return { ...line, ...this.scope(ctx), allocationId: row.id, periodId: row.periodId,
        productionRunKey: target.id, costSnapshotId: target.costSnapshot!.id, destinationCostCenterId: target.costCenterId,
        destinationCostCenterKey: target.costCenterId, driverUnit: target.outputUnitSnapshot,
        runCostClosedAt: target.costClosedAt!, runNumberSnapshot: target.runNumber,
        costCenterCodeSnapshot: centers.get(target.costCenterId)!.code };
    });
    return { sources, calculation, lines };
  }
  async calculate(id: string, query: AllocationPageDto, ctx: ActiveOperationalContext) {
    const { page, limit, skip } = this.page(query);
    return this.boundary(ctx, async tx => {
      const row = await this.owned(tx, id, ctx);
      if (row.status !== 'DRAFT') this.conflict('overheadAllocation.immutable');
      const { calculation, lines } = await this.inputs(tx, row, ctx);
      return { allocationId: id, status: 'DRAFT', currencyCode: row.currencyCode,
        sourceAmount: calculation.sourceAmount, targetCount: calculation.targetCount, purposeCount: calculation.purposeCount,
        sourceCount: calculation.sourceCount, data: lines.slice(skip, skip + limit),
        meta: { page, limit, total: lines.length, totalPages: Math.ceil(lines.length / limit) } };
    });
  }
  async finalize(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.boundary(ctx, async tx => {
      const row = await this.owned(tx, id, ctx);
      if (row.status === 'FINAL') return row; // immutable idempotent result, no second audit/write
      if (row.status !== 'DRAFT') this.conflict('overheadAllocation.immutable');
      const { sources, calculation, lines } = await this.inputs(tx, row, ctx);
      // Calculation/representability completes BEFORE the first successful-state write.
      for (let offset = 0; offset < sources.length; offset += 200) {
        await tx.operationalOverheadAllocationSource.createMany({ data: sources.slice(offset, offset + 200).map(s => ({ ...this.scope(ctx), sourceEntryId: s.id, allocationId: id })) });
      }
      for (let offset = 0; offset < lines.length; offset += 50) {
        await tx.operationalOverheadAllocationLine.createMany({ data: lines.slice(offset, offset + 50) });
      }
      const updated = await tx.operationalOverheadPeriodAllocation.update({
        where: { id, ...this.scope(ctx), status: 'DRAFT' },
        data: { status: 'FINAL', finalizedAt: new Date(), finalizedById: userId, updatedById: userId }, include: headerInclude,
      });
      await this.log(tx, userId, id, 'OVERHEAD_ALLOCATION_FINALIZE', ctx, {
        periodId: row.periodId, version: row.version, before: 'DRAFT', after: 'FINAL', currencyCode: row.currencyCode,
        sourceAmount: calculation.sourceAmount, sourceCount: sources.length, targetCount: calculation.targetCount,
        purposeCount: calculation.purposeCount, lineCount: lines.length, driverType: 'FINAL_GOOD_OUTPUT_QUANTITY',
      });
      return updated;
    });
  }
  async lines(id: string, query: AllocationPageDto, ctx: ActiveOperationalContext) {
    await this.owned(this.prisma, id, ctx);
    const { page, limit, skip } = this.page(query), where = { ...this.scope(ctx), allocationId: id };
    const [total, data] = await Promise.all([
      this.prisma.operationalOverheadAllocationLine.count({ where }),
      this.prisma.operationalOverheadAllocationLine.findMany({ where, skip, take: limit, orderBy: [{ productionRunKey: 'asc' }, { costPurpose: 'asc' }] }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async sources(id: string, query: AllocationPageDto, ctx: ActiveOperationalContext) {
    await this.owned(this.prisma, id, ctx);
    const { page, limit, skip } = this.page(query), where = { ...this.scope(ctx), allocationId: id };
    const [total, data] = await Promise.all([
      this.prisma.operationalOverheadAllocationSource.count({ where }),
      this.prisma.operationalOverheadAllocationSource.findMany({ where, skip, take: limit, orderBy: { sourceEntryId: 'asc' },
        include: { sourceEntry: { select: { reference: true, costPurpose: true, overheadCategory: true, amount: true, currencyCode: true, sourceCostCenterId: true } } } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async history(id: string, query: AllocationPageDto, ctx: ActiveOperationalContext) {
    await this.owned(this.prisma, id, ctx);
    const { page, limit, skip } = this.page(query), where = { entity: ENTITY, entityId: id };
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, action: true, userId: true, createdAt: true, details: true } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * COST-R2D-B3: atomically posts every eligible FINAL allocation line to the Unified
   * Cost Ledger through the single canonical writer, inside the shared B1/B2/B3
   * overhead boundary. Exactly-once per line is enforced by the canonical source
   * fingerprint + canonical_line_key filtered indexes; already-posted lines are
   * reported idempotently (ALREADY_POSTED) and re-submission never double-posts.
   */
  async postToLedger(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.boundary(ctx, async tx => {
      const row = await this.owned(tx, id, ctx);
      if (row.status !== 'FINAL') this.conflict('overheadAllocation.postingRequiresFinal');
      const operationalCurrencyCode = await this.currency(tx, ctx);
      if (row.currencyCode !== operationalCurrencyCode) this.conflict('overhead.currencyMismatch');
      const lines = await tx.operationalOverheadAllocationLine.findMany({ where: { ...this.scope(ctx), allocationId: id }, orderBy: { id: 'asc' } });
      const ledgerRows = await tx.operationalCostTransaction.findMany({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, sourceType: OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE, sourceId: id },
        select: { id: true, sourceLineId: true, entryRole: true, status: true, reversedAt: true, clientRequestId: true, amount: true, currencyCode: true },
      });
      const primariesByLine = new Map<string, Array<(typeof ledgerRows)[number]>>();
      for (const r of ledgerRows) {
        if (r.entryRole !== ENTRY_ROLE_PRIMARY_COST || !r.sourceLineId) continue;
        const list = primariesByLine.get(r.sourceLineId) ?? [];
        list.push(r);
        primariesByLine.set(r.sourceLineId, list);
      }
      const postedAt = new Date();
      const linesResult: Array<Record<string, unknown>> = [];
      let postedCount = 0, alreadyPostedCount = 0, zeroLineCount = 0;
      for (const line of lines) {
        const primaries = primariesByLine.get(line.id) ?? [];
        const live = primaries.find(p => p.status === 'POSTED' && p.reversedAt === null);
        if (!line.allocatedAmount.gt(0)) {
          if (line.allocatedAmount.lt(0)) this.conflict('overheadAllocation.invalidInputs');
          zeroLineCount++;
          linesResult.push({ lineId: line.id, productionRunId: line.productionRunId, status: 'SKIPPED_ZERO', amount: line.allocatedAmount.toString() });
          continue;
        }
        if (line.currencyCode && line.currencyCode !== row.currencyCode) this.conflict('overhead.currencyMismatch');
        if (live) {
          alreadyPostedCount++;
          linesResult.push({
            lineId: line.id, productionRunId: line.productionRunId, status: 'ALREADY_POSTED',
            amount: line.allocatedAmount.toString(), generation: parseOverheadAllocationGeneration(live.clientRequestId) ?? nextOverheadAllocationGeneration(primaries.length),
            ledgerEntryId: live.id, currencyCode: live.currencyCode,
          });
          continue;
        }
        const generation = nextOverheadAllocationGeneration(primaries.length);
        const clientRequestId = overheadAllocationClientRequestId(id, line.id, generation, OVERHEAD_ALLOCATION_LEDGER_POST_ACTION);
        const fingerprint = overheadAllocationLedgerFingerprint(id, line.id);
        const witness = await this.productionCost.postLedgerEntryWithinTransaction(tx, {
          eventType: OVERHEAD_EVENT_TYPE,
          sourceType: OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE,
          sourceId: id,
          sourceLineId: line.id,
          costNature: 'ACTUAL',
          costPurpose: line.costPurpose,
          entryRole: ENTRY_ROLE_PRIMARY_COST,
          amount: line.allocatedAmount,
          quantity: 1,
          unit: MANUAL_AMOUNT_UNIT,
          rate: line.allocatedAmount,
          currencyCode: line.currencyCode ?? row.currencyCode,
          occurredAt: row.finalizedAt ?? row.periodTo,
          postedAt,
          clientRequestId,
          requestPayloadFingerprint: `${OVERHEAD_EVENT_TYPE}|${OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE}|${id}|${line.id}`,
          sourceFingerprint: fingerprint,
          refs: { productionRunId: line.productionRunId, costCenterId: line.destinationCostCenterId },
          createdById: userId,
          ctx,
        });
        const entry = 'transaction' in (witness as any) && (witness as any).transaction ? (witness as any).transaction : witness;
        postedCount++;
        linesResult.push({
          lineId: line.id, productionRunId: line.productionRunId, status: 'POSTED',
          amount: line.allocatedAmount.toString(), generation, ledgerEntryId: entry.id, currencyCode: entry.currencyCode,
        });
      }
      await this.log(tx, userId, id, 'OVERHEAD_ALLOCATION_LEDGER_POST', ctx, {
        allocationStatus: row.status, lineCount: lines.length, postedCount, alreadyPostedCount, zeroLineCount, currencyCode: row.currencyCode,
      });
      return { allocationId: id, status: 'POSTED', currencyCode: row.currencyCode, counts: { lineCount: lines.length, postedCount, alreadyPostedCount, zeroLineCount }, lines: linesResult };
    });
  }

  /**
   * COST-R2D-B3: reverses a live PRIMARY posting of one allocation line through the
   * canonical writer (blocks double reversal, records the reversal reason). The B2
   * FINAL allocation evidence is never mutated.
   */
  async reverseLedger(id: string, dto: ReverseOverheadAllocationLedgerDto, userId: string, ctx: ActiveOperationalContext) {
    return this.boundary(ctx, async tx => {
      const row = await this.owned(tx, id, ctx);
      if (row.status !== 'FINAL') this.conflict('overheadAllocation.postingRequiresFinal');
      const line = await tx.operationalOverheadAllocationLine.findFirst({ where: { id: dto.allocationLineId, ...this.scope(ctx), allocationId: id } });
      if (!line) throw new NotFoundException({ messageKey: 'overheadAllocation.notFound' });
      const original = await tx.operationalCostTransaction.findFirst({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, sourceType: OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE, sourceId: id, sourceLineId: dto.allocationLineId, entryRole: ENTRY_ROLE_PRIMARY_COST, status: 'POSTED', reversedAt: null },
      });
      if (!original) this.conflict('overheadAllocation.ledgerLineNotPosted');
      const primaries = await tx.operationalCostTransaction.findMany({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, sourceType: OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE, sourceId: id, sourceLineId: dto.allocationLineId, entryRole: ENTRY_ROLE_PRIMARY_COST },
        select: { id: true, clientRequestId: true },
      });
      const generation = parseOverheadAllocationGeneration((original as any).clientRequestId) ?? nextOverheadAllocationGeneration(primaries.length);
      const clientRequestId = overheadAllocationClientRequestId(id, dto.allocationLineId, generation, OVERHEAD_ALLOCATION_LEDGER_REVERSE_ACTION);
      const witness = await this.productionCost.reverseLedgerEntry(tx, original, { reason: dto.reason, clientRequestId, createdById: userId, ctx });
      const reversalId = 'transaction' in (witness as any) && (witness as any).transaction ? (witness as any).transaction.id : (witness as any).id;
      await this.log(tx, userId, id, 'OVERHEAD_ALLOCATION_LEDGER_REVERSE', ctx, {
        allocationLineId: dto.allocationLineId, originalId: original.id, reversalId, generation, reason: dto.reason, currencyCode: (original as any).currencyCode,
      });
      return {
        allocationId: id, allocationLineId: dto.allocationLineId, originalId: original.id, reversalId, generation,
        reversedAt: 'updatedOriginal' in (witness as any) && (witness as any).updatedOriginal ? (witness as any).updatedOriginal.reversedAt : (original as any).reversedAt,
      };
    });
  }

  /**
   * COST-R2D-B3: read-only allocation-scoped reconciliation produced by the single
   * R1C reconciliation authority, serialized with posting/reversal through the shared
   * overhead boundary.
   */
  async reconciliation(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.boundary(ctx, async tx => {
      await this.owned(tx, id, ctx);
      const report = await this.reconciliationAuthority.reconcileOverheadAllocation(id, ctx, tx);
      await this.log(tx, userId, id, 'OVERHEAD_ALLOCATION_LEDGER_RECONCILE', ctx, {
        decision: (report as any).decision?.status ?? 'ISSUES_DETECTED',
        lineDefectCount: (report as any).counts?.lineDefectCount ?? 0,
        eligibleLineCount: (report as any).counts?.eligibleLineCount ?? 0,
        postedLineCount: (report as any).counts?.postedLineCount ?? 0,
        aggregateEqual: (report as any).decision?.reconciled ?? false,
      });
      return report;
    });
  }
}
