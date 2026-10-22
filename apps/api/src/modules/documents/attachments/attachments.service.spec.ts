import { BadRequestException, NotFoundException } from '@nestjs/common'
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { AttachmentsService } from './attachments.service'

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}))

describe('AttachmentsService tenant ownership', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any
  let prisma: any
  let service: AttachmentsService

  beforeEach(() => {
    (existsSync as jest.Mock).mockReturnValue(true)
    ;(mkdirSync as jest.Mock).mockClear()
    ;(writeFileSync as jest.Mock).mockClear().mockImplementation(() => undefined)
    ;(unlinkSync as jest.Mock).mockClear()
    prisma = {
      attachment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      machine: { findFirst: jest.fn() },
      maintenanceRequest: { findFirst: jest.fn() },
      productionOrder: { findFirst: jest.fn() },
      productionNonconformance: { findFirst: jest.fn() },
      shiftHandover: { findFirst: jest.fn() },
    }
    service = new AttachmentsService(prisma)
  })

  afterEach(() => jest.restoreAllMocks())

  it('scopes list queries at the database to the active company and branch', async () => {
    await service.findAll(ctx, 1, 20, 'MACHINE')
    expect(prisma.attachment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', entityName: 'MACHINE' }),
    }))
    expect(prisma.attachment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
    })
  })

  it('does not expose a foreign or unowned legacy attachment by id', async () => {
    prisma.attachment.findFirst.mockResolvedValue(null)
    await expect(service.findOne('foreign-id', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign-id', companyId: 'company-a', branchId: 'branch-a' },
    }))
  })

  it('creates a tenant-owned attachment only after validating its entity', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'machine-a' })
    prisma.attachment.create.mockResolvedValue({ id: 'attachment-a' })
    const file = { originalname: 'manual.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 } as any

    await service.create(file, 'MACHINE', 'machine-a', undefined, 'user-a', ctx)

    expect(prisma.machine.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'machine-a', companyId: 'company-a' }),
    }))
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', entityName: 'MACHINE', entityId: 'machine-a' }),
    })
  })

  it('rejects a foreign entity before writing a file or database row', async () => {
    prisma.machine.findFirst.mockResolvedValue(null)
    const file = { originalname: 'manual.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 } as any

    await expect(service.create(file, 'MACHINE', 'foreign-machine', undefined, 'user-a', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(writeFileSync).not.toHaveBeenCalled()
    expect(prisma.attachment.create).not.toHaveBeenCalled()
  })

  it('resolves a shift handover entity with a branch-or-null scope that Prisma accepts', async () => {
    prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho-a' })
    prisma.attachment.create.mockResolvedValue({ id: 'attachment-a' })
    const file = { originalname: 'handover.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 } as any

    await service.create(file, 'SHIFT_HANDOVER', 'ho-a', undefined, 'user-a', ctx)

    const call = prisma.shiftHandover.findFirst.mock.calls[0][0]
    // Regression: `in: [branchId, null]` is rejected by Prisma for a nullable
    // field (PrismaClientValidationError); the scope must be an explicit OR.
    expect(call.where.branchId).toBeUndefined()
    expect(call.where.OR).toEqual([{ branchId: 'branch-a' }, { branchId: null }])
    expect(call.where).toMatchObject({ id: 'ho-a', companyId: 'company-a', deletedAt: null })
  })

  it('rejects an attachment to a shift handover of another company or branch', async () => {
    prisma.shiftHandover.findFirst.mockResolvedValue(null)
    const file = { originalname: 'handover.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 } as any

    await expect(service.create(file, 'SHIFT_HANDOVER', 'ho-foreign', undefined, 'user-a', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(writeFileSync).not.toHaveBeenCalled()
    expect(prisma.attachment.create).not.toHaveBeenCalled()
  })
})
