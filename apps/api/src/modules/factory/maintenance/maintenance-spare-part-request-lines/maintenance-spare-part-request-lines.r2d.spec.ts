import { BadRequestException } from '@nestjs/common';
import { MaintenanceSparePartRequestLinesService } from './maintenance-spare-part-request-lines.service';

describe('maintenance-spare-part-request-lines R2-D lifecycle normalization', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;

  const buildDb = () => {
    const tx: any = {
      maintenanceRequest: { findUnique: jest.fn() },
      sparePart: { findUnique: jest.fn() },
      machine: { findFirst: jest.fn() },
      machineComponent: { findUnique: jest.fn() },
      downtimeLog: { findUnique: jest.fn() },
      maintenanceRequestRequiredPart: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    return tx;
  };

  const machineOf = (companyId: string, branchId: string) => ({ id: 'm-1', companyId, branchId });
  const requestOf = (status = 'OPEN') => ({
    id: 'req-1',
    status,
    machineId: 'm-1',
    machine: machineOf('company-a', 'branch-a'),
  });

  const partLine = (overrides: any = {}) => ({
    id: 'line-1',
    maintenanceRequestId: 'req-1',
    status: 'RESERVED',
    quantity: 10,
    requestedQuantity: 10,
    approvedQuantity: null,
    reservedQuantity: 10,
    issuedQuantity: 0,
    returnedQuantity: 0,
    sparePart: { id: 'sp-1', productId: 'p-1' },
    ...overrides,
  });

  const audit: any = { log: jest.fn() };
  const notification: any = {
    notifyPartRequested: jest.fn(),
    notifyPartApproved: jest.fn(),
    notifyPartRejected: jest.fn(),
    notifyPartReserved: jest.fn(),
    notifyPartUsed: jest.fn(),
  };

  const serviceOf = (db: any) => new MaintenanceSparePartRequestLinesService(db, audit, notification);

  it('approve caps approvedQuantity at the requested quantity', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
      partLine({ status: 'REQUESTED', requestedQuantity: 5, quantity: 10 }),
    );
    db.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'line-1', status: 'APPROVED' });
    const service = serviceOf(db);

    await service.approve('req-1', 'line-1', 'user-1', ctx);
    expect(db.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED', approvedQuantity: 5 }) }),
    );
  });

  it('approve on a legacy REQUESTED line without requestedQuantity falls back to quantity (invariant holds)', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
      partLine({ status: 'REQUESTED', requestedQuantity: null, quantity: 7 }),
    );
    db.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'line-1', status: 'APPROVED' });
    const service = serviceOf(db);

    await service.approve('req-1', 'line-1', 'user-1', ctx);
    expect(db.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvedQuantity: 7 }) }),
    );
  });

  it('markUsed refuses a stock-controlled part that was never physically issued (T6)', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine({ issuedQuantity: 0 }));
    const service = serviceOf(db);

    await expect(service.markUsed('req-1', 'line-1', 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.markUsed('req-1', 'line-1', 'user-1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.usedRequiresStockIssue' },
    });
    expect(db.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled();
  });

  it('markUsed records net issued quantity for a stock-controlled part after physical issue', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
      partLine({ issuedQuantity: 5, returnedQuantity: 0 }),
    );
    db.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'line-1', status: 'USED' });
    const service = serviceOf(db);

    await service.markUsed('req-1', 'line-1', 'user-1', ctx);
    expect(db.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'USED', usedQuantity: 5 }) }),
    );
  });

  it('markUsed keeps the plain flow for non-stock parts (no inventory product)', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
      partLine({ sparePart: { id: 'sp-2' }, status: 'APPROVED', reservedQuantity: null, approvedQuantity: 3 }),
    );
    db.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'line-1', status: 'USED' });
    const service = serviceOf(db);

    await service.markUsed('req-1', 'line-1', 'user-1', ctx);
    expect(db.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'USED', usedQuantity: 3 }) }),
    );
  });

  it('create rejects a live duplicate line with the canonical localized key', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.sparePart.findUnique.mockResolvedValue({ id: 'sp-1', status: 'ACTIVE' });
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({ id: 'line-old', status: 'REQUESTED' });
    const service = serviceOf(db);

    await expect(
      service.create('req-1', { sparePartId: 'sp-1', quantity: 1 } as any, 'user-1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.sparePartAlreadyAddedToRequest' } });
    expect(db.maintenanceRequestRequiredPart.create).not.toHaveBeenCalled();
  });

  it('create converts a P2002 duplicate race into a canonical 400 (never a 500)', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.sparePart.findUnique.mockResolvedValue({ id: 'sp-1', status: 'ACTIVE' });
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(null);
    db.maintenanceRequestRequiredPart.create.mockRejectedValue({ code: 'P2002' });
    const service = serviceOf(db);

    await expect(
      service.create('req-1', { sparePartId: 'sp-1', quantity: 1 } as any, 'user-1', ctx),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('req-1', { sparePartId: 'sp-1', quantity: 1 } as any, 'user-1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.sparePartAlreadyAddedToRequest' } });
  });

  it('cancel rejects a terminal USED line with a canonical error', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine({ status: 'USED' }));
    const service = serviceOf(db);

    await expect(service.cancel('req-1', 'line-1', 'user-1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.partTerminalCannotCancel', params: { status: 'USED' } },
    });
    expect(db.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled();
  });

  it('cancel allows cancelling a live RESERVED line', async () => {
    const db = buildDb();
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf());
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine({ status: 'RESERVED' }));
    db.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'line-1', status: 'CANCELLED' });
    const service = serviceOf(db);

    await service.cancel('req-1', 'line-1', 'user-1', ctx);
    expect(db.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', cancelledByUserId: 'user-1' }) }),
    );
  });
});