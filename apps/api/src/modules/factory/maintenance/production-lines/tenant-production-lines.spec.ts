import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { ProductionLinesService } from './production-lines.service'

describe('production-lines tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      productionLine: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      administration: { findFirst: jest.fn(), findUnique: jest.fn() },
      department: { findFirst: jest.fn(), findUnique: jest.fn() },
      costCenter: { findFirst: jest.fn(), findUnique: jest.fn() },
      operationType: { findFirst: jest.fn(), findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      company: { findUnique: jest.fn() },
      machine: { count: jest.fn().mockResolvedValue(0) },
      maintenanceRequest: { count: jest.fn().mockResolvedValue(0) },
    }
    return tx
  }

  const numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PL-0001') } as any
  const audit: any = { log: jest.fn() }

  const inContextLine = { id: 'pl-1', companyId: 'company-a', branchId: 'branch-a', code: 'PL-1', name: 'Line', deletedAt: null }
  const foreignLine = { id: 'pl-9', companyId: 'company-b', branchId: 'branch-b', code: 'PL-9', name: 'Other', deletedAt: null }

  it('creates with ctx tenant fields, ignoring client-supplied company/branch', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(null)
    db.productionLine.create.mockResolvedValue(inContextLine)
    db.operationType.findFirst.mockResolvedValue({ id: 'ot-1' })
    const service = new ProductionLinesService(db, audit, numbering)

    await service.create({ code: 'PL-C', name: 'x', companyId: 'company-evil', branchId: 'branch-evil', operationTypeId: 'ot-1' } as any, 'user-a', ctx)

    expect(db.productionLine.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }) }),
    )
  })

  it('rejects create when operation type is outside the active company', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(null)
    db.operationType.findFirst.mockResolvedValue(null)
    const service = new ProductionLinesService(db, audit, numbering)

    await expect(
      service.create({ name: 'x', companyId: 'company-a', branchId: 'branch-a', operationTypeId: 'ot-9' } as any, 'user-a', ctx),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(db.productionLine.create).not.toHaveBeenCalled()
  })

  it('rejects create when administration belongs to another branch', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(null)
    db.administration.findFirst.mockResolvedValue(null)
    const service = new ProductionLinesService(db, audit, numbering)

    await expect(
      service.create({ name: 'x', companyId: 'company-a', branchId: 'branch-a', administrationId: 'adm-b' } as any, 'user-a', ctx),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects create when department belongs to another company', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(null)
    db.department.findFirst.mockResolvedValue(null)
    const service = new ProductionLinesService(db, audit, numbering)

    await expect(
      service.create({ name: 'x', companyId: 'company-a', branchId: 'branch-a', departmentId: 'dept-b' } as any, 'user-a', ctx),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('scopes list to the active company/branch and ignores query tenant filters', async () => {
    const db = buildDb()
    const service = new ProductionLinesService(db, audit, numbering)

    await service.findAll({ companyId: 'company-evil', branchId: 'branch-evil', status: 'ACTIVE' } as any, ctx)

    expect(db.productionLine.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', status: 'ACTIVE' }),
    )
  })

  it('allows reading an in-context line and rejects foreign lines with 404', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValueOnce(foreignLine).mockResolvedValueOnce(inContextLine)
    const service = new ProductionLinesService(db, audit, numbering)

    await expect(service.findOne('pl-9', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.findOne('pl-1', ctx)).resolves.toEqual(inContextLine)
  })

  it('rejects update of a foreign line before any write', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(foreignLine)
    const service = new ProductionLinesService(db, audit, numbering)

    await expect(service.update('pl-9', { name: 'x' } as any, 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.productionLine.update).not.toHaveBeenCalled()
  })

  it('rejects tenant re-pointing on update (strips companyId/branchId)', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(inContextLine)
    db.productionLine.update.mockResolvedValue(inContextLine)
    const service = new ProductionLinesService(db, audit, numbering)

    await service.update('pl-1', { name: 'renamed', companyId: 'company-b', branchId: 'branch-b' } as any, 'user-a', ctx)

    expect(db.productionLine.update).toHaveBeenCalledWith({
      where: { id: 'pl-1' },
      data: { name: 'renamed' },
      include: expect.anything(),
    })
  })

  it('rejects delete of a foreign line', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(foreignLine)
    const service = new ProductionLinesService(db, audit, numbering)

    await expect(service.remove('pl-9', 'user-a', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.productionLine.update).not.toHaveBeenCalled()
  })

  it('rejects deleting a line that has linked machines (business rule preserved)', async () => {
    const db = buildDb()
    db.productionLine.findUnique.mockResolvedValue(inContextLine)
    db.machine.count.mockResolvedValue(1)
    const service = new ProductionLinesService(db, audit, numbering)

    await expect(service.remove('pl-1', 'user-a', ctx)).rejects.toBeInstanceOf(ConflictException)
  })
})
