import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { deriveRunOutputByUnit, UnitOutput } from '../production-runs/production-runs.util';
import { ANALYTICS_LIMITS, ANALYTICS_TIMEZONE } from './production-analytics.constants';
import { MonitoringQueryDto } from './dto/monitoring-query.dto';
import { addUnitOutputs, adjacentBusinessDate, businessDate, monitoringClassification, monitoringWindows, resolveMonitoringShift } from './production-monitoring.util';
const MAX_RESOURCES = 5000;
const MAX_EVENTS = 200000;
type Totals = {
  now: UnitOutput[];
  currentShift: UnitOutput[] | null;
  today: UnitOutput[];
  monthToDate: UnitOutput[];
};
function emptyTotals(hasShift: boolean): Totals {
  return {
    now: [],
    currentShift: hasShift ? [] : null,
    today: [],
    monthToDate: []
  };
}
function addTotals(target: Totals, value: Totals) {
  addUnitOutputs(target.now, value.now);
  addUnitOutputs(target.today, value.today);
  addUnitOutputs(target.monthToDate, value.monthToDate);
  if (target.currentShift && value.currentShift) addUnitOutputs(target.currentShift, value.currentShift);
}

/** Read-only composition over the canonical run/event output calculation. */
@Injectable()
export class ProductionMonitoringService {
  constructor(private readonly prisma: PrismaService) {}
  async monitoring(query: MonitoringQueryDto, ctx: ActiveOperationalContext, now = new Date()) {
    if (!ctx?.companyId || !ctx?.branchId) throw new ForbiddenException({
      messageKey: 'auth.insufficientPermissions'
    });
    const started = performance.now();
    const scope = {
      companyId: ctx.companyId,
      branchId: ctx.branchId
    };
    const windows = monitoringWindows(now);
    const today = businessDate(now);
    const operationSelect = {
      id: true,
      code: true,
      name: true
    };
    const [lines, machines, shifts, calendars] = await Promise.all([this.prisma.productionLine.findMany({
      where: {
        ...scope,
        ...(query.productionLineId ? {
          id: query.productionLineId
        } : {}),
        ...(query.machineId ? {
          OR: [{
            machines: {
              some: {
                id: query.machineId,
                companyId: ctx.companyId
              }
            }
          }, {
            productionRuns: {
              some: {
                ...scope,
                machineId: query.machineId
              }
            }
          }]
        } : {})
      },
      select: {
        id: true,
        code: true,
        name: true,
        operationType: {
          select: operationSelect
        },
        deletedAt: true,
        status: true
      },
      orderBy: [{
        code: 'asc'
      }, {
        id: 'asc'
      }],
      take: MAX_RESOURCES + 1
    }), this.prisma.machine.findMany({
      where: {
        companyId: ctx.companyId,
        OR: [{
          branchId: ctx.branchId
        }, {
          branchId: null
        }],
        AND: [{
          OR: [{
            productionLine: scope
          }, {
            productionLineId: null
          }]
        }],
        ...(query.productionLineId ? {
          productionLineId: query.productionLineId
        } : {}),
        ...(query.machineId ? {
          id: query.machineId
        } : {})
      },
      select: {
        id: true,
        code: true,
        name: true,
        operationType: {
          select: operationSelect
        },
        productionLine: {
          select: {
            id: true,
            code: true,
            name: true,
            operationType: {
              select: operationSelect
            }
          }
        },
        deletedAt: true,
        status: true
      },
      orderBy: [{
        code: 'asc'
      }, {
        id: 'asc'
      }],
      take: MAX_RESOURCES + 1
    }), this.prisma.productionShift.findMany({
      where: {
        ...scope,
        status: 'ACTIVE',
        deletedAt: null
      },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true
      },
      take: MAX_RESOURCES + 1
    }), this.prisma.productionShiftCalendar.findMany({
      where: {
        ...scope,
        status: 'ACTIVE',
        deletedAt: null,
        effectiveFrom: {
          lte: new Date(`${today}T23:59:59.999Z`)
        },
        OR: [{
          effectiveTo: null
        }, {
          effectiveTo: {
            gte: new Date(`${adjacentBusinessDate(today, -1)}T00:00:00Z`)
          }
        }]
      },
      include: {
        entries: {
          where: {
            date: {
              gte: new Date(`${adjacentBusinessDate(today, -1)}T00:00:00Z`),
              lte: new Date(`${today}T23:59:59.999Z`)
            }
          },
          include: {
            shift: true
          }
        },
        template: {
          include: {
            days: {
              include: {
                shift: true
              }
            }
          }
        }
      },
      take: MAX_RESOURCES + 1
    })]);
    if ([lines, machines, shifts, calendars].some(rows => rows.length > MAX_RESOURCES)) throw this.tooLarge();
    const shift = resolveMonitoringShift(calendars, shifts, now);
    const earliest = shift.currentShift && shift.currentShift.from < windows.monthToDate.from ? shift.currentShift.from : windows.monthToDate.from;
    const runs = await this.prisma.productionRun.findMany({
      where: {
        ...scope,
        deletedAt: null,
        productionLine: scope,
        productionProductDefinition: scope,
        ...(query.productionLineId ? {
          productionLineId: query.productionLineId
        } : {}),
        ...(query.machineId ? {
          machineId: query.machineId
        } : {}),
        startedAt: {
          lte: now
        },
        OR: [{
          status: {
            in: ['RUNNING', 'PAUSED']
          }
        }, {
          outputEvents: {
            some: {
              ...scope,
              occurredAt: {
                gte: earliest,
                lte: now
              }
            }
          }
        }]
      },
      select: {
        id: true,
        runNumber: true,
        status: true,
        productionLineId: true,
        machineId: true,
        startedAt: true,
        outputUnitSnapshot: true,
        shiftId: true,
        shiftCodeSnapshot: true,
        shiftNameSnapshot: true,
        shiftStartTimeSnapshot: true,
        shiftEndTimeSnapshot: true,
        productionProductDefinition: {
          select: operationSelect
        }
      },
      orderBy: [{
        startedAt: 'desc'
      }, {
        id: 'asc'
      }],
      take: ANALYTICS_LIMITS.maxSummaryRuns + 1
    });
    if (runs.length > ANALYTICS_LIMITS.maxSummaryRuns) throw this.tooLarge();
    const activeIds = runs.filter(run => ['RUNNING', 'PAUSED'].includes(run.status)).map(run => run.id);
    const events = runs.length ? await this.prisma.productionOutputEvent.findMany({
      where: {
        ...scope,
        productionRunId: {
          in: runs.map(run => run.id)
        },
        occurredAt: {
          lte: now
        },
        classification: 'FINAL_OUTPUT',
        measurementPoint: {
          ...scope,
          isAuthoritativeFinal: true
        },
        OR: [{
          productionRunId: {
            in: activeIds
          }
        }, {
          occurredAt: {
            gte: earliest
          }
        }, {
          correctsEvent: {
            ...scope,
            occurredAt: {
              gte: earliest,
              lte: now
            }
          }
        }]
      },
      select: {
        id: true,
        productionRunId: true,
        eventType: true,
        classification: true,
        quantity: true,
        goodQuantity: true,
        rejectQuantity: true,
        unit: true,
        occurredAt: true,
        correctsEventId: true,
        measurementPointId: true,
        measurementPoint: {
          select: {
            isAuthoritativeFinal: true
          }
        }
      },
      orderBy: [{
        occurredAt: 'asc'
      }, {
        id: 'asc'
      }],
      take: MAX_EVENTS + 1
    }) : [];
    if (events.length > MAX_EVENTS) throw this.tooLarge();
    const byRun = new Map<string, typeof events>();
    for (const event of events) {
      const group = byRun.get(event.productionRunId) ?? [];
      group.push(event);
      byRun.set(event.productionRunId, group);
    }
    const hasShift = Boolean(shift.currentShift);
    const lineRows = lines.map(line => this.resource(line, line.operationType, hasShift, 'LINE'));
    const machineRows = machines.map(machine => this.resource(machine, machine.operationType ?? machine.productionLine?.operationType, hasShift, 'MACHINE'));
    const lineMap = new Map(lineRows.map(line => [line.id, line]));
    const machineMap = new Map(machineRows.map(machine => [machine.id, machine]));
    const summaries = new Map<string, {
      classification: string;
      totals: Totals;
    }>();
    const unassignedToMachine = emptyTotals(hasShift);
    let inaccessibleMachineRuns = 0;
    for (const run of runs) {
      const line = lineMap.get(run.productionLineId);
      const machine = run.machineId ? machineMap.get(run.machineId) : null;
      if (!line) continue;
      if (run.machineId && !machine) inaccessibleMachineRuns += 1;
      const source = byRun.get(run.id) ?? [];
      const active = ['RUNNING', 'PAUSED'].includes(run.status);
      const currentOutput = active ? deriveRunOutputByUnit(source) : [];
      if (active && !currentOutput.length) currentOutput.push({
        unit: run.outputUnitSnapshot,
        quantity: '0',
        goodQuantity: '0',
        rejectQuantity: '0'
      });
      const totals: Totals = {
        now: currentOutput,
        currentShift: shift.currentShift ? deriveRunOutputByUnit(source, {
          from: shift.currentShift.from,
          to: now
        }) : null,
        today: deriveRunOutputByUnit(source, windows.today),
        monthToDate: deriveRunOutputByUnit(source, windows.monthToDate)
      };
      const current = {
        id: run.id,
        runNumber: run.runNumber,
        status: run.status,
        product: run.productionProductDefinition,
        startedAt: run.startedAt,
        output: totals.now,
        shift: {
          id: run.shiftId,
          code: run.shiftCodeSnapshot,
          name: run.shiftNameSnapshot,
          startTime: run.shiftStartTimeSnapshot,
          endTime: run.shiftEndTimeSnapshot
        }
      };
      const lastEventAt = source.length ? source[source.length - 1].occurredAt : null;
      for (const row of [line, machine].filter(Boolean) as typeof lineRows) {
        addTotals(row.totals, totals);
        row.runCount += 1;
        if (active) row.currentRuns.push(current);
        if (lastEventAt && (!row.lastEventAt || lastEventAt > row.lastEventAt)) row.lastEventAt = lastEventAt;
      }
      const summary = summaries.get(line.classification) ?? {
        classification: line.classification,
        totals: emptyTotals(hasShift)
      };
      addTotals(summary.totals, totals);
      summaries.set(line.classification, summary);
      if (!run.machineId) addTotals(unassignedToMachine, totals);
    }
    const visible = (row: typeof lineRows[number]) => {
      const search = query.search?.trim().toLocaleLowerCase();
      return (!row.deletedAt && row.masterStatus === 'ACTIVE' || row.runCount > 0) && (!query.classification || row.classification === query.classification) && (!query.operationTypeId || row.operationType?.id === query.operationTypeId) && (!search || `${row.code} ${row.name}`.toLocaleLowerCase().includes(search));
    };
    for (const row of [...lineRows, ...machineRows]) row.status = row.currentRuns.some(run => run.status === 'RUNNING') ? 'RUNNING' : row.currentRuns.length ? 'PAUSED' : 'IDLE';
    return {
      timezone: ANALYTICS_TIMEZONE,
      generatedAt: now.toISOString(),
      windows: {
        ...windows,
        currentShift: shift.currentShift
      },
      summary: [...summaries.values()].sort((a, b) => a.classification.localeCompare(b.classification)),
      lines: lineRows.filter(visible),
      machines: machineRows.filter(visible),
      dataQuality: {
        ambiguousShift: shift.ambiguous,
        unassignedToMachine,
        inaccessibleMachineRuns,
        unclassifiedResources: [...lineRows, ...machineRows].filter(row => visible(row) && row.classification === 'UNCLASSIFIED').length,
        multipleActiveResources: [...lineRows, ...machineRows].filter(row => visible(row) && row.currentRuns.length > 1).length
      },
      meta: {
        runCount: runs.length,
        eventCount: events.length,
        elapsedMs: Math.round(performance.now() - started)
      }
    };
  }
  private resource(record: any, operationType: any, hasShift: boolean, resourceType: 'LINE' | 'MACHINE') {
    return {
      resourceType,
      id: record.id as string,
      code: record.code as string,
      name: record.name as string,
      deletedAt: record.deletedAt,
      masterStatus: record.status,
      operationType,
      productionLine: record.productionLine ? {
        id: record.productionLine.id,
        code: record.productionLine.code,
        name: record.productionLine.name
      } : null,
      classification: monitoringClassification(operationType?.code),
      status: 'IDLE',
      totals: emptyTotals(hasShift),
      currentRuns: [] as any[],
      lastEventAt: null as Date | null,
      runCount: 0
    };
  }
  private tooLarge() {
    return new BadRequestException({
      messageKey: 'production.monitoring.tooMuchData'
    });
  }
}
