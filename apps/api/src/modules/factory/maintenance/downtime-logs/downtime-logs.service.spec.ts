import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DowntimeLogsService } from './downtime-logs.service';

describe('DowntimeLogsService canonical errors and fixes', () => {
  let service: DowntimeLogsService;
  let prisma: any;
  let audit: any;

  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  const ownedMachine = { id: 'm1', name: 'M', companyId: 'c1', branchId: 'b1' };
  const foreignMachine = { id: 'm9', name: 'M9', companyId: 'c2', branchId: 'b2' };
  const ownedLog = (overrides: any = {}) => ({
    id: 'd1',
    machineId: 'm1',
    startTime: new Date('2026-01-01T10:00:00Z'),
    endTime: null,
    cancelledAt: null,
    machine: { id: 'm1', code: 'M1', name: 'M', productionLineId: null, companyId: 'c1', branchId: 'b1' },
    request: null,
    rcaCompletedBy: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn() },
      maintenanceRequest: { findUnique: jest.fn() },
      downtimeLog: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new DowntimeLogsService(prisma, audit);
  });

  it('normalizes empty requestId to null instead of failing FK', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.downtimeLog.findFirst.mockResolvedValue(null);
    prisma.downtimeLog.create.mockResolvedValue({ id: 'd1' });
    await service.create({ machineId: 'm1', requestId: '', reason: 'r' } as any, 'u1', ctx);
    const data = prisma.downtimeLog.create.mock.calls[0][0].data;
    expect(data.requestId).toBeNull();
  });

  it('rejects create when a machine already has an active downtime log', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.downtimeLog.findFirst.mockResolvedValue({ id: 'd0', endTime: null, cancelledAt: null });
    const promise = service.create({ machineId: 'm1', reason: 'r' } as any, 'u1', ctx);
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({ response: { messageKey: 'maintenance.activeDowntimeExists' } });
  });

  it('throws canonical not-found when machine does not exist', async () => {
    prisma.machine.findUnique.mockResolvedValue(null);
    await expect(service.create({ machineId: 'x', reason: 'r' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.machineNotFound' },
    });
  });

  it('throws canonical not-found when linked request does not exist', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
    await expect(service.create({ machineId: 'm1', requestId: 'rq', reason: 'r' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.requestNotFound' },
    });
  });

  it('throws canonical error when end time is not after start time', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.downtimeLog.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ machineId: 'm1', reason: 'r', startTime: new Date('2026-01-01T10:00:00Z'), endTime: new Date('2026-01-01T09:00:00Z') } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.endTimeAfterStartTime' } });
  });

  it('cannot close a cancelled downtime log', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(ownedLog({ cancelledAt: new Date() }));
    await expect(service.close('d1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.cannotCloseCancelledDowntime' } });
  });

  it('cannot close when duration would be zero or negative', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(ownedLog({ startTime: new Date(Date.now() + 60000) }));
    await expect(service.close('d1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.durationMustBePositive' } });
  });

  it('cannot delete an active (open) downtime log', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(ownedLog({ startTime: new Date() }));
    await expect(service.remove('d1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.closeOrCancelBeforeDelete' } });
  });

  it('cannot end an already-ended downtime log', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(ownedLog({ endTime: new Date('2026-01-01T11:00:00Z') }));
    await expect(service.endDowntime('d1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.downtimeAlreadyEnded' } });
  });

  it('cannot set failure cause on a cancelled log', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(ownedLog({ endTime: new Date(), cancelledAt: new Date() }));
    await expect(service.setFailureCause('d1', 'cause', undefined, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.cannotUpdateCancelledDowntime' },
    });
  });

  it('not found error uses canonical messageKey', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(null);
    await expect(service.findOne('d1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.downtimeLogNotFound' } });
  });

  it('rejects create when machine belongs to another company (tenant isolation)', async () => {
    prisma.machine.findUnique.mockResolvedValue(foreignMachine);
    await expect(service.create({ machineId: 'm9', reason: 'r' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.machineNotFound' },
    });
  });

  it('rejects create when linked request belongs to another company (tenant isolation)', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);
    prisma.maintenanceRequest.findUnique.mockResolvedValue({ id: 'rq', machine: foreignMachine });
    await expect(service.create({ machineId: 'm1', requestId: 'rq', reason: 'r' } as any, 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.requestNotFound' },
    });
  });

  it('cannot read a downtime log whose machine belongs to another company (tenant isolation)', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(ownedLog({ machine: foreignMachine }));
    await expect(service.findOne('d1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.downtimeLogNotFound' } });
  });

  it('cannot close a downtime log whose machine belongs to another company (tenant isolation)', async () => {
    prisma.downtimeLog.findUnique.mockResolvedValue(ownedLog({ machine: foreignMachine }));
    await expect(service.close('d1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.downtimeLogNotFound' } });
  });
});
