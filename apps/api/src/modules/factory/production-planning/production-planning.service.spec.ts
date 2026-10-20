import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProductionPlanningService } from './production-planning.service';
import { ApplyPlanningScheduleDto, ApplyPlanningItemDto } from './dto/planning-schedule.dto';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

// Shift/calendar times are local wall-clock. Build fixture instants from local
// components so assertions are timezone-independent.
const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);

const order = (overrides: Record<string, any> = {}) => ({
  id: 'po1',
  orderNumber: 'PO-000001',
  companyId: 'c1',
  branchId: 'b1',
  productionProductDefinitionId: 'p1',
  productionVersionId: 'v1',
  productionPackagingId: null,
  productionUnitId: 'u1',
  quantityUnit: 'UNIT',
  productionLineId: 'l1',
  machineId: null,
  plannedQuantity: '100.0000',
  capacityTimeBasis: 'HOUR',
  plannedStartAt: local(2026, 2, 1, 8, 0),
  plannedEndAt: local(2026, 2, 1, 16, 0),
  priority: 'NORMAL',
  status: 'DRAFT',
  lockVersion: 0,
  snapshotFrozenAt: null,
  capacityStandard: { id: 'cs1', code: 'PCS-000001' },
  ...overrides,
});

const calendar = (overrides: Record<string, any> = {}) => ({
  id: 'cal1',
  companyId: 'c1',
  branchId: 'b1',
  effectiveFrom: local(2026, 1, 1),
  effectiveTo: null,
  status: 'ACTIVE',
  templateId: 'tpl1',
  template: {
    days: [
      { dayOfWeek: 1, isWorkDay: true, shift: { id: 's1', code: 'SH1', startTime: '08:00', endTime: '16:00', breakMinutes: 0 } },
      { dayOfWeek: 2, isWorkDay: true, shift: { id: 's1', code: 'SH1', startTime: '08:00', endTime: '16:00', breakMinutes: 0 } },
      { dayOfWeek: 3, isWorkDay: true, shift: { id: 's1', code: 'SH1', startTime: '08:00', endTime: '16:00', breakMinutes: 0 } },
      { dayOfWeek: 4, isWorkDay: true, shift: { id: 's1', code: 'SH1', startTime: '08:00', endTime: '16:00', breakMinutes: 0 } },
      { dayOfWeek: 5, isWorkDay: true, shift: { id: 's1', code: 'SH1', startTime: '08:00', endTime: '16:00', breakMinutes: 0 } },
    ],
  },
  entries: [],
  ...overrides,
});

const capacity = (overrides: Record<string, any> = {}) => ({
  id: 'cs1',
  code: 'PCS-000001',
  revision: 1,
  standardRate: '100.0000',
  outputUnit: 'UNIT',
  timeBasis: 'HOUR',
  setupMinutes: '0',
  changeoverMinutes: '0',
  cleaningMinutes: '0',
  startupAllowanceMinutes: '0',
  shutdownAllowanceMinutes: '0',
  targetEfficiencyPercent: '100.0000',
  expectedYieldPercent: '100.0000',
  ...overrides,
});

function build(overrides: Record<string, any> = {}) {
  let orderRows: any[] = [];
  const orderFindMany = jest.fn((args: any = {}) => {
    const statusIn = args?.where?.status?.in as string[] | undefined;
    if (statusIn) return Promise.resolve(orderRows.filter((o) => statusIn.includes(o.status)));
    return Promise.resolve(orderRows);
  });
  const prisma: any = {
    productionShiftCalendar: { findFirst: jest.fn().mockResolvedValue(calendar()), findMany: jest.fn().mockResolvedValue([{ id: 'cal1' }]) },
    productionOrder: {
      findMany: orderFindMany,
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    productionRun: { findMany: jest.fn().mockResolvedValue([]) },
    productionUnit: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', code: 'UNIT' }) },
    $transaction: jest.fn((fn: any) => fn(prisma)),
    ...overrides.prisma,
  };
  const audit: any = { logWithClient: jest.fn().mockResolvedValue({}) };
  const capacityStandards: any = { resolveWithClient: jest.fn().mockResolvedValue(capacity()) };
  const materialRequirements: any = { getOrderReadiness: jest.fn().mockResolvedValue({ status: 'READY', blockers: [], warnings: [], lines: [] }) };
  const service = new ProductionPlanningService(prisma, audit, capacityStandards, materialRequirements);
  const setOrders = (rows: any[]) => {
    orderRows = rows;
  };
  return { service, prisma, audit, capacityStandards, materialRequirements, setOrders };
}

describe('ProductionPlanningService (finite capacity)', () => {
  // P01
  it('preview persists nothing and returns the engine version', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order()]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-01T00:00:00.000Z', horizonTo: '2026-02-03T00:00:00.000Z' }, ctxA);
    expect(result.engineVersion).toBe('FINITE_CAPACITY_V1');
    expect(prisma.productionOrder.updateMany).not.toHaveBeenCalled();
    expect(prisma.productionOrder.create).toBeUndefined();
  });

  // P02
  it('schedules a single order into the earliest working interval', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ plannedQuantity: '800.0000' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.scheduled).toHaveLength(1);
    expect(result.totals.scheduled).toBe(1);
  });

  // P03
  it('is deterministic: identical inputs produce identical drafts', async () => {
    const a = build();
    a.setOrders([order(), order({ id: 'po2', orderNumber: 'PO-000002', priority: 'HIGH' })]);
    const b = build();
    b.setOrders([order(), order({ id: 'po2', orderNumber: 'PO-000002', priority: 'HIGH' })]);
    const r1 = await a.service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    const r2 = await b.service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(r1.scheduled.map((s) => `${s.orderId}@${s.scheduledStartAt}`)).toEqual(r2.scheduled.map((s) => `${s.orderId}@${s.scheduledStartAt}`));
  });

  // P04
  it('orders by priority URGENT before HIGH before NORMAL before LOW', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([
      order({ id: 'low', orderNumber: 'PO-LOW', priority: 'LOW' }),
      order({ id: 'urgent', orderNumber: 'PO-URG', priority: 'URGENT' }),
      order({ id: 'normal', orderNumber: 'PO-NRM', priority: 'NORMAL' }),
      order({ id: 'high', orderNumber: 'PO-HIGH', priority: 'HIGH' }),
    ]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.scheduled[0].orderId).toBe('urgent');
    expect(result.scheduled[1].orderId).toBe('high');
    expect(result.scheduled[2].orderId).toBe('normal');
    expect(result.scheduled[3].orderId).toBe('low');
  });

  // P05
  it('breaks ties by due date then order number', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([
      order({ id: 'b', orderNumber: 'PO-B', priority: 'NORMAL', plannedEndAt: new Date('2026-02-02T12:00:00.000Z') }),
      order({ id: 'a', orderNumber: 'PO-A', priority: 'NORMAL', plannedEndAt: new Date('2026-02-02T12:00:00.000Z') }),
      order({ id: 'c', orderNumber: 'PO-C', priority: 'NORMAL', plannedEndAt: new Date('2026-02-02T09:00:00.000Z') }),
    ]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.scheduled.map((s) => s.orderId)).toEqual(['c', 'a', 'b']);
  });

  // P06
  it('never double-books a line within the same interval', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([
      order({ id: 'po1', orderNumber: 'PO-1', plannedQuantity: '400.0000' }),
      order({ id: 'po2', orderNumber: 'PO-2', plannedQuantity: '400.0000' }),
    ]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    const [s1, s2] = result.scheduled;
    expect(new Date(s1.scheduledEndAt).getTime()).toBeLessThanOrEqual(new Date(s2.scheduledStartAt).getTime());
  });

  // P07
  it('routes around RELEASED order facts on the same line', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([
      order({ plannedQuantity: '800.0000', plannedEndAt: local(2026, 2, 2, 23, 0) }),
      order({ id: 'rel1', orderNumber: 'PO-REL', status: 'RELEASED', plannedStartAt: local(2026, 2, 2, 8, 0), plannedEndAt: local(2026, 2, 2, 12, 0) }),
    ]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: local(2026, 2, 2).toISOString(), horizonTo: local(2026, 2, 4).toISOString() }, ctxA);
    expect(result.scheduled).toHaveLength(1);
    const start = new Date(result.scheduled[0].scheduledStartAt).getTime();
    expect(start).toBeGreaterThanOrEqual(local(2026, 2, 2, 12, 0).getTime());
  });

  // P08
  it('routes around RUNNING runs on the same line', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ plannedQuantity: '200.0000', plannedEndAt: local(2026, 2, 2, 23, 0) })]);
    prisma.productionRun.findMany.mockResolvedValue([{ productionLineId: 'l1', startedAt: local(2026, 2, 2, 8, 0), endedAt: local(2026, 2, 2, 14, 0), status: 'RUNNING' }]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: local(2026, 2, 2).toISOString(), horizonTo: local(2026, 2, 4).toISOString() }, ctxA);
    expect(result.scheduled).toHaveLength(1);
    expect(new Date(result.scheduled[0].scheduledStartAt).getTime()).toBeGreaterThanOrEqual(local(2026, 2, 2, 14, 0).getTime());
  });

  // P09
  it('reports RESOURCE_FULL when the line working time is exhausted', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ plannedQuantity: '100000.0000' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-02T23:59:59.000Z' }, ctxA);
    expect(result.scheduled).toHaveLength(0);
    expect(result.unscheduled[0].reasons).toContain('RESOURCE_FULL');
    expect(result.unscheduled[0].reasonKeys[0]).toMatch(/^production\.planning\.reason/);
  });

  // P10
  it('reports NO_WORKING_SHIFT when the calendar has no working days', async () => {
    const { service, prisma, setOrders } = build();
    prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar({ template: { days: [] }, entries: [] }));
    setOrders([order()]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.unscheduled[0].reasons).toContain('NO_WORKING_SHIFT');
  });

  // P11
  it('maps ambiguous capacity resolution to AMBIENT_CAPACITY_AMBIGUOUS', async () => {
    const { service, prisma, capacityStandards, setOrders } = build();
    capacityStandards.resolveWithClient.mockRejectedValue(new ConflictException({ messageKey: 'capacityStandard.ambiguousResolution' }));
    setOrders([order()]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.unscheduled[0].reasons).toContain('AMBIENT_CAPACITY_AMBIGUOUS');
  });

  // P12
  it('maps missing capacity standard to NO_CAPACITY_STANDARD', async () => {
    const { service, prisma, capacityStandards, setOrders } = build();
    capacityStandards.resolveWithClient.mockRejectedValue(new NotFoundException({ messageKey: 'capacityStandard.notConfigured' }));
    setOrders([order()]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.unscheduled[0].reasons).toContain('NO_CAPACITY_STANDARD');
  });

  // P13
  it('does not reschedule non-editable (RELEASED) orders', async () => {
    const { service, setOrders } = build();
    setOrders([order({ status: 'RELEASED' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.totals.requested).toBe(0);
    expect(result.scheduled).toHaveLength(0);
  });

  // P14
  it('surfaces material SHORTAGE as a warning without blocking the schedule', async () => {
    const { service, prisma, materialRequirements, setOrders } = build();
    materialRequirements.getOrderReadiness.mockResolvedValue({ status: 'NOT_READY', blockers: [], warnings: ['productionMaterialRequirement.shortageWarning'], lines: [{ status: 'SHORT' }] });
    setOrders([order({ plannedQuantity: '200.0000' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0].materialState).toBe('SHORTAGE');
    expect(result.totals.shortageRisk).toBe(1);
  });

  // P15
  it('marks material UNKNOWN when there is no frozen snapshot', async () => {
    const { service, prisma, materialRequirements, setOrders } = build();
    materialRequirements.getOrderReadiness.mockResolvedValue({ status: 'NOT_READY', blockers: ['productionMaterialRequirement.missingFrozenSnapshot'], warnings: [], lines: [] });
    setOrders([order({ plannedQuantity: '200.0000' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.scheduled[0].materialState).toBe('UNKNOWN');
  });

  // P16
  it('computes LATE lateness against the original plannedEndAt (due target)', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([
      order({ id: 'po1', orderNumber: 'PO-1', plannedQuantity: '800.0000', plannedEndAt: new Date('2026-02-02T09:00:00.000Z') }),
    ]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(result.scheduled[0].latenessState).toBe('LATE');
    expect(Number(result.scheduled[0].latenessMinutes)).toBeGreaterThan(0);
    expect(result.totals.late).toBe(1);
  });

  // P17
  it('reports ON_TIME when the schedule finishes before the due target', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ plannedQuantity: '100.0000', plannedEndAt: local(2026, 2, 2, 23, 0) })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: local(2026, 2, 2).toISOString(), horizonTo: local(2026, 2, 4).toISOString() }, ctxA);
    expect(result.scheduled[0].latenessState).toBe('ON_TIME');
  });

  // P18
  it('subtracts breaks from the daily working capacity (8h work does not fit a 7.5h day)', async () => {
    const { service, setOrders } = build({ prisma: { productionShiftCalendar: { findFirst: jest.fn().mockResolvedValue(calendar({
      template: { days: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dayOfWeek: dow, isWorkDay: true, shift: { id: 's1', code: 'SH1', startTime: '08:00', endTime: '16:00', breakMinutes: 30 } })) },
    })), findMany: jest.fn().mockResolvedValue([{ id: 'cal1' }]) } } });
    setOrders([order({ plannedQuantity: '800.0000', plannedEndAt: local(2026, 2, 10, 23, 0) })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: local(2026, 2, 2).toISOString(), horizonTo: local(2026, 2, 5).toISOString() }, ctxA);
    const [op] = result.scheduled;
    const start = new Date(op.scheduledStartAt);
    const end = new Date(op.scheduledEndAt);
    // 8h of work cannot fit in a 7.5h day (with the 30m break) -> must span two days.
    expect(end.getTime() - start.getTime()).toBeGreaterThan(24 * 60 * 60 * 1000 - 60 * 1000);
    expect(start.getDate()).toBe(2);
  });

  // P19
  it('supports cross-midnight shifts', async () => {
    const { service, prisma, setOrders } = build();
    prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar({
      template: { days: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dayOfWeek: dow, isWorkDay: true, shift: { id: 's1', code: 'NIGHT', startTime: '22:00', endTime: '06:00', breakMinutes: 0 } })) },
    }));
    setOrders([order({ plannedQuantity: '200.0000', plannedEndAt: local(2026, 2, 3, 23, 0) })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: local(2026, 2, 2).toISOString(), horizonTo: local(2026, 2, 4).toISOString() }, ctxA);
    const [op] = result.scheduled;
    const start = new Date(op.scheduledStartAt);
    expect(start.getHours()).toBe(22);
    expect(start.getDate()).toBe(2);
  });

  // P20
  it('honors calendar entries over the template (holiday)', async () => {
    const { service, prisma, setOrders } = build();
    prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar({
      entries: [{ date: new Date('2026-02-02T00:00:00.000Z'), isWorkDay: false, shiftId: null, shift: null }],
    }));
    setOrders([order({ plannedQuantity: '200.0000' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-03T00:00:00.000Z' }, ctxA);
    expect(result.scheduled).toHaveLength(0);
    expect(result.unscheduled[0].reasons).toContain('NO_WORKING_SHIFT');
  });

  // P21
  it('computes resource utilization from used vs available minutes', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ plannedQuantity: '400.0000' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    expect(Number(result.resourceLoad[0].usedMinutes)).toBeGreaterThan(0);
    expect(Number(result.resourceLoad[0].utilizationPercent)).toBeGreaterThan(0);
  });

  // P22
  it('filters by explicit orderIds', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ id: 'po1' })]);
    await service.preview({ calendarId: 'cal1', orderIds: ['po1'], horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    const where = prisma.productionOrder.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ['po1'] });
  });

  // P23
  it('filters by productionLineId', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order()]);
    await service.preview({ calendarId: 'cal1', productionLineId: 'l1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    const where = prisma.productionOrder.findMany.mock.calls[0][0].where;
    expect(where.productionLineId).toBe('l1');
  });

  // P24
  it('scopes every query to the active company+branch', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order()]);
    await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    for (const call of prisma.productionOrder.findMany.mock.calls) {
      expect(call[0].where.companyId).toBe('c1');
      expect(call[0].where.branchId).toBe('b1');
    }
  });

  // P25
  it('rejects an explicit calendar that is not owned by the tenant', async () => {
    const { service, prisma, setOrders } = build();
    prisma.productionShiftCalendar.findFirst.mockResolvedValue(null);
    await expect(service.preview({ calendarId: 'foreign' }, ctxA)).rejects.toBeInstanceOf(NotFoundException);
  });

  // P26
  it('rejects when no active calendar exists and none is specified', async () => {
    const { service, prisma, setOrders } = build();
    prisma.productionShiftCalendar.findMany.mockResolvedValue([]);
    await expect(service.preview({}, ctxA)).rejects.toBeInstanceOf(NotFoundException);
  });

  // P27
  it('rejects when multiple active calendars exist and none is specified', async () => {
    const { service, prisma, setOrders } = build();
    prisma.productionShiftCalendar.findMany.mockResolvedValue([{ id: 'cal1' }, { id: 'cal2' }]);
    await expect(service.preview({}, ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });

  // P28
  it('rejects an inverted horizon', async () => {
    const { service, setOrders } = build();
    await expect(service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-04T00:00:00.000Z', horizonTo: '2026-02-02T00:00:00.000Z' }, ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });

  // P29
  it('rejects a horizon longer than the maximum', async () => {
    const { service, setOrders } = build();
    await expect(service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2028-02-02T00:00:00.000Z' }, ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('apply', () => {
    // P30
    it('persists plannedStartAt/plannedEndAt for a matched, current slot', async () => {
      const { service, prisma, setOrders } = build();
      const o = order({ plannedQuantity: '400.0000' });
      setOrders([o]);
      prisma.productionOrder.findOne = undefined;
      prisma.productionOrder.findFirst.mockResolvedValue(o);
      prisma.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      const draft = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
      const op = draft.scheduled[0];
      const result = await service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: op.orderId, lockVersion: 0, scheduledStartAt: op.scheduledStartAt, scheduledEndAt: op.scheduledEndAt }] }, 'user1', ctxA);
      expect(result.applied).toBe(1);
      expect(prisma.productionOrder.updateMany).toHaveBeenCalled();
    });

    // P31
    it('throws on a stale lockVersion', async () => {
      const { service, prisma, setOrders } = build();
      const o = order({ plannedQuantity: '400.0000', lockVersion: 5 });
      setOrders([o]);
      prisma.productionOrder.findFirst.mockResolvedValue(o);
      const draft = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
      const op = draft.scheduled[0];
      await expect(service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: op.orderId, lockVersion: 999, scheduledStartAt: op.scheduledStartAt, scheduledEndAt: op.scheduledEndAt }] }, 'user1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    // P32
    it('rejects a client slot that diverges from the recomputed deterministic slot', async () => {
      const { service, prisma, setOrders } = build();
      const o = order({ plannedQuantity: '400.0000' });
      setOrders([o]);
      prisma.productionOrder.findFirst.mockResolvedValue(o);
      await expect(service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: 'po1', lockVersion: 0, scheduledStartAt: '2026-02-02T09:00:00.000Z', scheduledEndAt: '2026-02-02T13:00:00.000Z' }] }, 'user1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    // P33
    it('rejects orders that are not editable (frozen)', async () => {
      const { service, prisma, setOrders } = build();
      const o = order({ plannedQuantity: '400.0000' });
      setOrders([o]);
      prisma.productionOrder.findFirst.mockResolvedValue(order({ status: 'RELEASED', snapshotFrozenAt: new Date(), plannedQuantity: '400.0000' }));
      const draft = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
      const op = draft.scheduled[0];
      const result = await service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: op.orderId, lockVersion: 0, scheduledStartAt: op.scheduledStartAt, scheduledEndAt: op.scheduledEndAt }] }, 'user1', ctxA);
      expect(result.rejected).toBe(1);
      expect(prisma.productionOrder.updateMany).not.toHaveBeenCalled();
    });

    // P34
    it('records an audit event on apply', async () => {
      const { service, prisma, audit, setOrders } = build();
      const o = order({ plannedQuantity: '400.0000' });
      setOrders([o]);
      prisma.productionOrder.findFirst.mockResolvedValue(o);
      prisma.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      const draft = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
      const op = draft.scheduled[0];
      await service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: op.orderId, lockVersion: 0, scheduledStartAt: op.scheduledStartAt, scheduledEndAt: op.scheduledEndAt }] }, 'user1', ctxA);
      expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'RESCHEDULE', entity: 'ProductionOrder' }));
    });

    // P35
    it('throws when the updateMany affects zero rows (concurrency)', async () => {
      const { service, prisma, setOrders } = build();
      const o = order({ plannedQuantity: '400.0000' });
      setOrders([o]);
      prisma.productionOrder.findFirst.mockResolvedValue(o);
      prisma.productionOrder.updateMany.mockResolvedValue({ count: 0 });
      const draft = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
      const op = draft.scheduled[0];
      await expect(service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: op.orderId, lockVersion: 0, scheduledStartAt: op.scheduledStartAt, scheduledEndAt: op.scheduledEndAt }] }, 'user1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    // P36
    it('rejects an order not present in the deterministic draft', async () => {
      const { service, prisma, setOrders } = build();
      setOrders([]);
      const result = await service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: 'ghost', lockVersion: 0, scheduledStartAt: '2026-02-02T08:00:00.000Z', scheduledEndAt: '2026-02-02T10:00:00.000Z' }] }, 'user1', ctxA);
      expect(result.rejected).toBe(1);
      expect(result.applied).toBe(0);
    });

    // P37
    it('rejects an invalid slot range', async () => {
      const { service, prisma, setOrders } = build();
      const o = order({ plannedQuantity: '400.0000' });
      setOrders([o]);
      prisma.productionOrder.findFirst.mockResolvedValue(o);
      await expect(service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: 'po1', lockVersion: 0, scheduledStartAt: '2026-02-02T10:00:00.000Z', scheduledEndAt: '2026-02-02T10:00:00.000Z' }] }, 'user1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // P38
  it('reports totals consistently', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([
      order({ id: 'po1', orderNumber: 'PO-1', priority: 'NORMAL', plannedQuantity: '200.0000' }),
      order({ id: 'po2', orderNumber: 'PO-2', priority: 'NORMAL', plannedQuantity: '100000.0000' }),
    ]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-02T23:59:59.000Z' }, ctxA);
    expect(result.totals.requested).toBe(2);
    expect(result.totals.scheduled + result.totals.unscheduled).toBe(2);
  });

  // P39
  it('produces only stable reason codes from the declared set', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ status: 'CANCELLED' })]);
    const result = await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxA);
    for (const u of result.unscheduled) {
      for (const reason of u.reasons) {
        expect(['NO_ELIGIBLE_RESOURCE', 'NO_CAPACITY_STANDARD', 'NO_WORKING_SHIFT', 'MATERIAL_SHORTAGE', 'RESOURCE_FULL', 'INVALID_ORDER_STATE', 'MISSING_DUE_DATA', 'CONTEXT_INVALID', 'AMBIENT_CAPACITY_AMBIGUOUS', 'INVALID_REFERENCES', 'UNIT_MISMATCH', 'HORIZON_EXCEEDED']).toContain(reason);
      }
    }
  });

  // P40
  it('has no persistence side effects in preview (read-only contract)', async () => {
    const { service, prisma, setOrders } = build();
    setOrders([order({ plannedQuantity: '200.0000' })]);
    await service.preview({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z' }, ctxB);
    expect(prisma.productionOrder.updateMany).not.toHaveBeenCalled();
    expect(prisma.productionRun.findMany).toBeDefined();
  });

  // P41 (regression): a freshly planned order has lockVersion 0 and must pass
  // ApplyPlanningScheduleDto validation. Fixes @Min(1) which rejected lockVersion 0.
  it('accepts lockVersion 0 in ApplyPlanningItemDto (fresh order)', async () => {
    const item = plainToInstance(ApplyPlanningItemDto, {
      orderId: 'po1',
      lockVersion: 0,
      scheduledStartAt: '2026-02-02T08:00:00.000Z',
      scheduledEndAt: '2026-02-02T10:00:00.000Z',
    });
    const errors = await validate(item);
    expect(errors).toHaveLength(0);

    const dto = plainToInstance(ApplyPlanningScheduleDto, {
      calendarId: 'cal1',
      plans: [{ orderId: 'po1', lockVersion: 0, scheduledStartAt: '2026-02-02T08:00:00.000Z', scheduledEndAt: '2026-02-02T10:00:00.000Z' }],
    });
    const dtoErrors = await validate(dto);
    expect(dtoErrors).toHaveLength(0);
  });

  it('still rejects a negative lockVersion', async () => {
    const item = plainToInstance(ApplyPlanningItemDto, {
      orderId: 'po1',
      lockVersion: -1,
      scheduledStartAt: '2026-02-02T08:00:00.000Z',
      scheduledEndAt: '2026-02-02T10:00:00.000Z',
    });
    const errors = await validate(item);
    expect(errors.some((e) => e.property === 'lockVersion')).toBe(true);
  });

  // P43 (regression): a serializable-transaction conflict (Prisma P2034 / SQL
  // deadlock 1205) under concurrent apply must degrade to a controlled 409,
  // never surface as an unhandled 500.
  it('translates a serializable transaction conflict into a controlled conflict', async () => {
    const { service, prisma } = build();
    const conflict: any = new Error('Transaction failed due to a write conflict or a deadlock');
    conflict.code = 'P2034';
    prisma.$transaction = jest.fn().mockRejectedValue(conflict);
    await expect(service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: 'po1', lockVersion: 0, scheduledStartAt: '2026-02-02T08:00:00.000Z', scheduledEndAt: '2026-02-02T10:00:00.000Z' }] }, 'user1', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not swallow non-concurrency errors from apply', async () => {
    const { service, prisma } = build();
    const boom: any = new Error('unexpected database failure');
    prisma.$transaction = jest.fn().mockRejectedValue(boom);
    await expect(service.apply({ calendarId: 'cal1', horizonFrom: '2026-02-02T00:00:00.000Z', horizonTo: '2026-02-04T00:00:00.000Z', plans: [{ orderId: 'po1', lockVersion: 0, scheduledStartAt: '2026-02-02T08:00:00.000Z', scheduledEndAt: '2026-02-02T10:00:00.000Z' }] }, 'user1', ctxA)).rejects.toBe(boom);
  });
});
