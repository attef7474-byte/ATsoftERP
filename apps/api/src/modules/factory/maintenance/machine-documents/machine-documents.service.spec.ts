import { NotFoundException } from '@nestjs/common'
import { MachineDocumentsService } from './machine-documents.service'

describe('MachineDocumentsService tenant ownership', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any
  let prisma: any
  let tx: any
  let audit: any
  let service: MachineDocumentsService

  beforeEach(() => {
    tx = {
      machine: { findFirst: jest.fn() },
      machineDocument: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
    }
    prisma = {
      ...tx,
      machineDocument: { ...tx.machineDocument, findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((callback: any) => callback(tx)),
    }
    audit = { logWithClient: jest.fn() }
    service = new MachineDocumentsService(prisma, audit)
  })

  it('scopes list and history queries through the owning machine', async () => {
    await service.findAll({}, ctx)
    await service.getHistory({}, ctx)
    const scope = { companyId: 'company-a', deletedAt: null, OR: [{ branchId: 'branch-a' }, { branchId: null }] }
    expect(prisma.machineDocument.findMany.mock.calls[0][0].where.machine).toEqual(scope)
    expect(prisma.machineDocument.findMany.mock.calls[1][0].where.machine).toEqual(scope)
    expect(prisma.machineDocument.count.mock.calls[1][0].where.machine).toEqual(scope)
  })

  it('does not expose a foreign document by id', async () => {
    prisma.machineDocument.findFirst.mockResolvedValue(null)
    await expect(service.findOne('document-b', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.machineDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'document-b', machine: expect.objectContaining({ companyId: 'company-a' }) }),
    }))
  })

  it('rechecks ownership inside the mutation transaction and performs no foreign write', async () => {
    tx.machineDocument.findFirst.mockResolvedValue(null)
    await expect(service.update('document-b', { title: 'Changed' } as any, 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(tx.machineDocument.update).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })
})
