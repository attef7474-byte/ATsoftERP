import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { acquireOverheadAllocationBoundary, overheadAllocationBoundary } from '../../../common/cost-purpose/overhead-allocation-boundary';
import { AuditService } from '../../audit/audit.service';
import { AllocationNotesDto, AllocationPageDto, AllocationQueryDto, CreateOverheadAllocationDto } from './overhead-allocation.dto';
import { calculateOverheadAllocation, OVERHEAD_ALLOCATION_MAX_SOURCES, OVERHEAD_ALLOCATION_MAX_TARGETS } from './overhead-allocation.engine';

const ENTITY = 'OperationalOverheadPeriodAllocation';
const headerInclude = { period: { select: { code: true } }, _count: { select: { lines: true, sources: true } } } satisfies Prisma.OperationalOverheadPeriodAllocationInclude;

@Injectable()
export class OverheadAllocationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
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
}
