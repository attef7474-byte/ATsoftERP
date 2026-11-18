import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProductionMonitoringService } from './production-monitoring.service';
import { ProductionAnalyticsController } from './production-analytics.controller';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { MonitoringQueryDto } from './dto/monitoring-query.dto';
import { monitoringClassification, monitoringWindows, resolveMonitoringShift } from './production-monitoring.util';
import { deriveRunOutputByUnit } from '../production-runs/production-runs.util';
const now = new Date('2026-11-19T12:00:00Z');
const ctx: any = {
  companyId: 'a',
  branchId: 'a1'
};
const operation = (code = 'PACKAGING') => ({
  id: code,
  code,
  name: code
});
const line = (id = 'line-a', code = 'PACKAGING') => ({
  id,
  code: id,
  name: id,
  operationType: operation(code),
  status: 'ACTIVE',
  deletedAt: null,
  companyId: 'a',
  branchId: 'a1'
});
const machine = (id = 'machine-a') => ({
  id,
  code: id,
  name: id,
  operationType: operation(),
  category: null,
  productionLine: line(),
  status: 'ACTIVE',
  deletedAt: null,
  companyId: 'a',
  branchId: 'a1'
});
const run = (id = 'run-a', overrides: any = {}) => ({
  id,
  runNumber: id,
  productionLineId: 'line-a',
  machineId: 'machine-a',
  status: 'RUNNING',
  startedAt: new Date('2026-11-19T08:00:00Z'),
  companyId: 'a',
  branchId: 'a1',
  outputUnitSnapshot: 'PACK',
  productionProductDefinition: {
    id: 'product-a',
    code: 'PA',
    name: 'Product A'
  },
  ...overrides
});
const event = (id = 'event-a', quantity = '1000', overrides: any = {}) => ({
  id,
  productionRunId: 'run-a',
  eventType: 'PRODUCTION',
  classification: 'FINAL_OUTPUT',
  quantity,
  goodQuantity: quantity,
  rejectQuantity: '0',
  unit: 'PACK',
  occurredAt: new Date('2026-11-19T10:00:00Z'),
  correctsEventId: null,
  measurementPointId: 'point-a',
  measurementPoint: {
    isAuthoritativeFinal: true
  },
  companyId: 'a',
  branchId: 'a1',
  ...overrides
});
const shift = (startTime = '08:00', endTime = '16:00') => ({
  id: 'shift-a',
  code: 'SA',
  name: 'Shift A',
  startTime,
  endTime,
  companyId: 'a',
  branchId: 'a1'
});
function fixture() {
  const rows: any = {
    productionLine: [line(), line('line-b', 'MANUFACTURING')],
    machine: [machine(), machine('machine-b')],
    productionShift: [shift()],
    productionShiftCalendar: [],
    productionRun: [run()],
    productionOutputEvent: [event()]
  };
  const prisma: any = {};
  for (const name of Object.keys(rows)) {
    prisma[name] = {
      findMany: jest.fn(async ({
        where
      }: any) => rows[name].filter((row: any) => row.companyId === where.companyId && (where.branchId ? row.branchId === where.branchId : row.branchId === where.OR?.find((item: any) => item.branchId)?.branchId || row.branchId === null))),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn()
    };
  }
  return {
    rows,
    prisma,
    service: new ProductionMonitoringService(prisma)
  };
}
function quantity(values: any[], unit = 'PACK') {
  return values.find(row => row.unit === unit)?.quantity || '0';
}
describe('ProductionMonitoringService canonical resource projections', () => {
  it('shows the active run, product, native status and cumulative output', async () => {
    const {
      service
    } = fixture();
    const result = await service.monitoring({}, ctx, now);
    expect(result.lines[0].status).toBe('RUNNING');
    expect(result.lines[0].currentRuns[0]).toMatchObject({
      id: 'run-a',
      runNumber: 'run-a',
      product: {
        code: 'PA',
        name: 'Product A'
      }
    });
    expect(quantity(result.lines[0].totals.now)).toBe('1000');
    expect(result.lines[0].lastEventAt?.toISOString()).toBe('2026-11-19T10:00:00.000Z');
  });
  it('keeps a paused run cumulative count and exposes idle resources', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionRun[0].status = 'PAUSED';
    const result = await service.monitoring({}, ctx, now);
    expect(result.lines[0].status).toBe('PAUSED');
    expect(quantity(result.lines[0].totals.now)).toBe('1000');
    expect(result.lines[1].status).toBe('IDLE');
    expect(result.lines[1].totals.now).toEqual([]);
  });
  it('counts multiple completed/current runs in one shift and counts only active runs for NOW', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionRun = [run('run-a', {
      status: 'COMPLETED'
    }), run('run-b')];
    rows.productionOutputEvent = [event(), event('b', '2000', {
      productionRunId: 'run-b'
    })];
    const result = await service.monitoring({}, ctx, now);
    expect(quantity(result.lines[0].totals.currentShift!)).toBe('3000');
    expect(quantity(result.lines[0].totals.now)).toBe('2000');
    expect(result.lines[0].currentRuns).toHaveLength(1);
  });
  it('resolves a cross-midnight shift and limits TODAY independently', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionShift = [shift('20:00', '04:00')];
    rows.productionRun = [run('run-a', {
      startedAt: new Date('2026-11-18T20:00:00Z')
    })];
    rows.productionOutputEvent = [event('yesterday', '1000', {
      occurredAt: new Date('2026-11-18T21:00:00Z')
    }), event('today', '2000', {
      occurredAt: new Date('2026-11-19T00:30:00Z')
    })];
    const result = await service.monitoring({}, ctx, new Date('2026-11-19T01:00:00Z'));
    expect(result.windows.currentShift?.from.toISOString()).toBe('2026-11-18T20:00:00.000Z');
    expect(result.windows.currentShift?.to.toISOString()).toBe('2026-11-19T04:00:00.000Z');
    expect(quantity(result.lines[0].totals.currentShift!)).toBe('3000');
    expect(quantity(result.lines[0].totals.today)).toBe('2000');
  });
  it('uses exact canonical day/month boundaries while NOW includes the active run history', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionRun[0].startedAt = new Date('2026-10-31T20:00:00Z');
    rows.productionOutputEvent = [event('oct', '100', {
      occurredAt: new Date('2026-10-31T21:00:00Z')
    }), event('nov', '200', {
      occurredAt: new Date('2026-11-18T23:59:59Z')
    }), event('day', '300', {
      occurredAt: new Date('2026-11-19T00:00:00Z')
    })];
    const result = await service.monitoring({}, ctx, now);
    expect(quantity(result.lines[0].totals.now)).toBe('600');
    expect(quantity(result.lines[0].totals.today)).toBe('300');
    expect(quantity(result.lines[0].totals.monthToDate)).toBe('500');
    expect(result.timezone).toBe('UTC');
    expect(result.windows.monthToDate.to).toEqual(now);
  });
  it('isolates lines and machines and keeps line-only output unassigned to machines', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionRun = [run(), run('run-b', {
      machineId: 'machine-b'
    }), run('run-c', {
      productionLineId: 'line-b',
      machineId: null
    })];
    rows.productionOutputEvent = [event(), event('b', '2000', {
      productionRunId: 'run-b'
    }), event('c', '4000', {
      productionRunId: 'run-c'
    })];
    const result = await service.monitoring({}, ctx, now);
    expect(quantity(result.lines[0].totals.today)).toBe('3000');
    expect(quantity(result.lines[1].totals.today)).toBe('4000');
    expect(quantity(result.machines[0].totals.today)).toBe('1000');
    expect(quantity(result.machines[1].totals.today)).toBe('2000');
    expect(quantity(result.dataQuality.unassignedToMachine.today)).toBe('4000');
    expect(result.summary.find(row => row.classification === 'PACKAGING')?.totals.today[0].quantity).toBe('3000');
  });
  it('applies corrections to the original output and ignores resets and non-authoritative measurement points', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionOutputEvent = [event(), event('correction', '50', {
      eventType: 'CORRECTION',
      correctsEventId: 'event-a'
    }), event('reset', '0', {
      eventType: 'RESET'
    }), event('intermediate', '9999', {
      classification: 'INTERMEDIATE'
    }), event('not-final', '9999', {
      measurementPoint: {
        isAuthoritativeFinal: false
      }
    })];
    const result = await service.monitoring({}, ctx, now);
    expect(quantity(result.lines[0].totals.now)).toBe('950');
    expect(quantity(result.lines[0].totals.currentShift!)).toBe('950');
  });
  it('assigns a correction to its original production day', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionOutputEvent = [event('original', '1000', {
      occurredAt: new Date('2026-11-18T23:00:00Z')
    }), event('correction', '50', {
      eventType: 'CORRECTION',
      correctsEventId: 'original'
    })];
    const result = await service.monitoring({}, ctx, now);
    expect(quantity(result.lines[0].totals.now)).toBe('950');
    expect(quantity(result.lines[0].totals.today)).toBe('0');
    expect(quantity(result.lines[0].totals.monthToDate)).toBe('950');
  });
  it('retains incompatible unit breakdowns within a resource and factory group', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionOutputEvent.push(event('kg', '500', {
      unit: 'KG'
    }));
    const result = await service.monitoring({}, ctx, now);
    expect(result.lines[0].totals.today.map(({
      unit,
      quantity
    }) => ({
      unit,
      quantity
    }))).toEqual([{
      unit: 'KG',
      quantity: '500'
    }, {
      unit: 'PACK',
      quantity: '1000'
    }]);
    expect(result.summary[0].totals.today).toHaveLength(2);
  });
  it('switches the current product after a run change while retaining prior shift/day/month output', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionRun = [run('run-a', {
      status: 'COMPLETED'
    }), run('run-b', {
      productionProductDefinition: {
        id: 'pb',
        code: 'PB',
        name: 'Product B'
      }
    })];
    rows.productionOutputEvent.push(event('b', '2000', {
      productionRunId: 'run-b'
    }));
    const result = await service.monitoring({}, ctx, now);
    expect(result.lines[0].currentRuns[0].product.code).toBe('PB');
    expect(quantity(result.lines[0].totals.today)).toBe('3000');
  });
  it('starts a new shift window at its boundary while preserving TODAY', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionShift = [shift('08:00', '12:00'), {
      ...shift('12:00', '20:00'),
      id: 'shift-b'
    }];
    const result = await service.monitoring({}, ctx, now);
    expect(result.windows.currentShift?.shiftId).toBe('shift-b');
    expect(quantity(result.lines[0].totals.currentShift!)).toBe('0');
    expect(quantity(result.lines[0].totals.today)).toBe('1000');
  });
  it('returns null current shift when no configured shift is active and still calculates day/month', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionShift = [];
    const result = await service.monitoring({}, ctx, now);
    expect(result.windows.currentShift).toBeNull();
    expect(result.lines[0].totals.currentShift).toBeNull();
    expect(quantity(result.lines[0].totals.today)).toBe('1000');
  });
  it('never classifies by a name and keeps unclassified production visible', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionLine[0].operationType = {
      id: 'custom',
      code: 'CUSTOM',
      name: 'Packaging'
    };
    const result = await service.monitoring({}, ctx, now);
    expect(result.lines[0].classification).toBe('UNCLASSIFIED');
    expect(quantity(result.lines[0].totals.today)).toBe('1000');
    expect(monitoringClassification('PACKAGING')).toBe('PACKAGING');
    expect(monitoringClassification('MANUFACTURING')).toBe('MANUFACTURING');
  });
  it.each([{
    companyId: 'b',
    branchId: 'b1'
  }, {
    companyId: 'a',
    branchId: 'a2'
  }])('excludes foreign context %j and scopes all bulk reads', async foreign => {
    const {
      prisma,
      service
    } = fixture();
    const result = await service.monitoring({}, foreign as any, now);
    expect(result.lines).toEqual([]);
    expect(result.machines).toEqual([]);
    expect(result.summary).toEqual([]);
    for (const model of ['productionLine', 'productionShift', 'productionShiftCalendar', 'productionRun']) expect(prisma[model].findMany.mock.calls[0][0].where).toMatchObject(foreign);
  });
  it('rejects a missing active context and performs zero business writes', async () => {
    const {
      prisma,
      service
    } = fixture();
    await expect(service.monitoring({}, {} as any, now)).rejects.toThrow(ForbiddenException);
    await service.monitoring({}, ctx, now);
    for (const model of Object.values(prisma) as any[]) for (const action of ['create', 'update', 'delete', 'updateMany', 'deleteMany', 'createMany']) expect(model[action]).not.toHaveBeenCalled();
  });
  it('handles an empty factory and avoids event queries without runs', async () => {
    const {
      rows,
      prisma,
      service
    } = fixture();
    Object.keys(rows).forEach(key => {
      rows[key] = [];
    });
    const result = await service.monitoring({}, ctx, now);
    expect(result.summary).toEqual([]);
    expect(prisma.productionOutputEvent.findMany).not.toHaveBeenCalled();
  });
  it('keeps a constant six bulk reads at representative resource/event volume', async () => {
    const {
      rows,
      prisma,
      service
    } = fixture();
    rows.productionLine = Array.from({
      length: 200
    }, (_, index) => line(`line-${index}`));
    rows.machine = Array.from({
      length: 1000
    }, (_, index) => machine(`machine-${index}`));
    rows.productionRun = Array.from({
      length: 500
    }, (_, index) => run(`run-${index}`, {
      productionLineId: `line-${index % 200}`,
      machineId: `machine-${index}`
    }));
    rows.productionOutputEvent = Array.from({
      length: 5000
    }, (_, index) => event(`event-${index}`, '10', {
      productionRunId: `run-${index % 500}`
    }));
    const result = await service.monitoring({}, ctx, now);
    expect(result.meta.runCount).toBe(500);
    expect(result.meta.eventCount).toBe(5000);
    Object.values(prisma).forEach((model: any) => expect(model.findMany).toHaveBeenCalledTimes(1));
    expect(result.meta.elapsedMs).toBeGreaterThanOrEqual(0);
    console.info(JSON.stringify({
      monitoringRepresentativeLoad: {
        lines: 200,
        machines: 1000,
        runs: 500,
        events: 5000,
        bulkQueries: 6,
        elapsedMs: result.meta.elapsedMs
      }
    }));
  });
  it('fails clearly instead of silently truncating an oversized factory', async () => {
    const {
      rows,
      service
    } = fixture();
    rows.productionLine = Array.from({
      length: 5001
    }, (_, index) => line(`line-${index}`));
    await expect(service.monitoring({}, ctx, now)).rejects.toMatchObject({
      response: {
        messageKey: 'production.monitoring.tooMuchData'
      }
    });
  });
});
describe('monitoring calendar and authorization contract', () => {
  it('honors calendar overrides and non-work days without logging a resolve mutation', () => {
    const calendar = {
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      templateId: null,
      entries: [{
        date: new Date('2026-11-19'),
        isWorkDay: false,
        shiftId: 'shift-a',
        shift: shift()
      }]
    };
    expect(resolveMonitoringShift([calendar], [shift()], now).currentShift).toBeNull();
    calendar.entries[0].isWorkDay = true;
    expect(resolveMonitoringShift([calendar], [shift()], now).currentShift?.shiftId).toBe('shift-a');
  });
  it('resolves template day and reports overlapping shift ambiguity explicitly', () => {
    const calendar = {
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      templateId: 'template',
      entries: [],
      template: {
        status: 'ACTIVE',
        deletedAt: null,
        days: [{
          dayOfWeek: 4,
          isWorkDay: true,
          shiftId: 'shift-a',
          shift: shift()
        }]
      }
    };
    expect(resolveMonitoringShift([calendar], [shift()], now).currentShift?.shiftId).toBe('shift-a');
    expect(resolveMonitoringShift([], [shift(), {
      ...shift(),
      id: 'overlap'
    }], now)).toEqual({
      currentShift: null,
      ambiguous: true
    });
  });
  it('computes server-side windows in the existing analytics timezone', () => {
    const windows = monitoringWindows(new Date('2026-12-01T00:00:00Z'));
    expect(windows.today.from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(windows.monthToDate.from).toEqual(windows.today.from);
  });
  it('rejects client company/branch manipulation and invalid resource classification', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    });
    for (const value of [{
      companyId: 'b'
    }, {
      branchId: 'b'
    }, {
      classification: 'ANYTHING'
    }]) await expect(pipe.transform(value, {
      type: 'query',
      metatype: MonitoringQueryDto
    })).rejects.toThrow(BadRequestException);
  });
  it('enforces the existing production analytics permission for allowed and denied roles', async () => {
    const prisma: any = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([{
          role: {
            code: 'OPERATOR',
            status: 'ACTIVE',
            permissions: [{
              permission: {
                status: 'ACTIVE',
                key: 'production-analytics:read'
              }
            }]
          }
        }])
      }
    };
    const guard = new PermissionsGuard(new Reflector(), prisma);
    const context: any = {
      getHandler: () => ProductionAnalyticsController.prototype.monitoring,
      getClass: () => ProductionAnalyticsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'operator'
          }
        })
      })
    };
    await expect(guard.canActivate(context)).resolves.toBe(true);
    prisma.userRole.findMany.mockResolvedValue([]);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
  it('uses the same corrected output authority for unit-safe window projection', () => {
    const events = [event('original', '1000'), event('correction', '50', {
      eventType: 'CORRECTION',
      correctsEventId: 'original'
    })];
    expect(quantity(deriveRunOutputByUnit(events, {
      from: new Date('2026-11-19T00:00:00Z'),
      to: now
    }))).toBe('950');
  });
});
