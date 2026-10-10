import { AuditService } from '../../../../common/audit/audit.service';
import { DowntimeLogsService } from './downtime-logs.service';

const ctx: any = { companyId: 'company', branchId: 'branch' };
const startTime = new Date('2026-01-01T10:00:00Z');
function fixture() {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    machine: { findFirst: jest.fn().mockResolvedValue({ id: 'machine', ...ctx, productionLineId: 'line' }) },
    maintenanceRequest: { findFirst: jest.fn().mockResolvedValue({ id: 'request', machineId: 'machine' }) },
    maintenanceTask: { findFirst: jest.fn().mockResolvedValue({ id: 'execution', machineId: 'machine' }) },
    downtimeLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ ...data, id: 'downtime' })),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...data, id: 'downtime' })),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const service = new DowntimeLogsService({} as any, new AuditService({} as any));
  return { tx, service };
}

describe('Downtime execution transaction authority', () => {
  it('starts one request machine stop with authoritative start, tenant and production line', async () => {
    const f = fixture(); await f.service.startOrReuseInTx(f.tx, {
      machineId: 'machine', requestId: 'request', reason: 'Motor failure', startTime,
    }, 'user', ctx);
    expect(f.tx.downtimeLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      machineId: 'machine', requestId: 'request', executionId: null, machineStopped: true,
      companyId: 'company', branchId: 'branch', productionLineId: 'line', startTime, detectedAt: startTime,
    }) });
    expect(f.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(f.tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('reuses a request stop and links its execution without resetting the original start', async () => {
    const f = fixture(); f.tx.downtimeLog.findFirst.mockResolvedValue({ id: 'downtime', requestId: 'request', executionId: null, startTime });
    await f.service.startOrReuseInTx(f.tx, { machineId: 'machine', requestId: 'request', executionId: 'execution', reason: 'Repair' }, 'user', ctx);
    expect(f.tx.downtimeLog.create).not.toHaveBeenCalled();
    expect(f.tx.downtimeLog.update).toHaveBeenCalledWith({ where: { id: 'downtime' }, data: { executionId: 'execution' } });
  });

  it('rejects taking over another maintenance event downtime', async () => {
    const f = fixture(); f.tx.downtimeLog.findFirst.mockResolvedValue({ id: 'downtime', requestId: 'other-request' });
    await expect(f.service.startOrReuseInTx(f.tx, { machineId: 'machine', requestId: 'request', reason: 'Failure' }, 'user', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.activeDowntimeExists' } });
    expect(f.tx.downtimeLog.update).not.toHaveBeenCalled();
  });

  it('tenant-scoped lookup rejects a foreign machine without mutating downtime', async () => {
    const f = fixture(); f.tx.machine.findFirst.mockResolvedValue(null);
    await expect(f.service.startOrReuseInTx(f.tx, { machineId: 'foreign', reason: 'Failure' }, 'user', ctx))
      .rejects.toMatchObject({ status: 404 });
    expect(f.tx.downtimeLog.create).not.toHaveBeenCalled();
    expect(f.tx.machine.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: 'company' }) });
  });

  it('rejects mismatched source request before opening downtime', async () => {
    const f = fixture(); f.tx.maintenanceRequest.findFirst.mockResolvedValue(null);
    await expect(f.service.startOrReuseInTx(f.tx, { machineId: 'machine', requestId: 'wrong', reason: 'Failure' }, 'user', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
  });

  it('return-to-service closes proper downtime using wall time independently of engineer sessions', async () => {
    const f = fixture(); f.tx.downtimeLog.findFirst.mockResolvedValue({ id: 'downtime', startTime });
    const endTime = new Date('2026-01-01T11:30:00Z');
    const result = await f.service.closeInTx(f.tx, { machineId: 'machine', requestId: 'request', executionId: 'execution', endTime }, 'user', ctx);
    expect(result).toMatchObject({ status: 'CLOSED', durationHours: 1.5, durationMinutes: 90 });
    expect(f.tx.downtimeLog.findFirst.mock.calls[0][0].where.OR).toEqual([{ requestId: 'request' }, { executionId: 'execution' }]);
    expect(f.tx.downtimeLog.update).toHaveBeenCalledWith({ where: { id: 'downtime' }, data: {
      endTime, durationMinutes: 90, status: 'CLOSED', repairCompletedAt: endTime,
    } });
  });

  it('idempotently returns null when no matching active downtime exists', async () => {
    const f = fixture(); await expect(f.service.closeInTx(f.tx, { machineId: 'machine', executionId: 'execution' }, 'user', ctx)).resolves.toBeNull();
    expect(f.tx.downtimeLog.update).not.toHaveBeenCalled();
  });

  it('rejects return timestamp at or before the actual stop start', async () => {
    const f = fixture(); f.tx.downtimeLog.findFirst.mockResolvedValue({ id: 'downtime', startTime });
    await expect(f.service.closeInTx(f.tx, { machineId: 'machine', requestId: 'request', endTime: startTime }, 'user', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.durationMustBePositive' } });
    expect(f.tx.downtimeLog.update).not.toHaveBeenCalled();
  });
});
