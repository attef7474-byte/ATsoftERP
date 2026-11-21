import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { AttachmentsService } from './attachments.service'

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}))

describe('AttachmentsService audit emission', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a', source: 'EXPLICIT_SCOPE' } as any
  const actor = { id: 'user-b', employeeId: 'employee-b' }
  const row = { id: 'att-1', companyId: 'company-a', branchId: 'branch-a', entityName: 'MACHINE', entityId: 'machine-a', originalName: 'manual.pdf', filePath: 'manual.pdf', mimeType: 'application/pdf', uploadedById: 'user-a' }
  let prisma: any
  let audit: any
  let service: AttachmentsService

  beforeEach(() => {
    ;(existsSync as jest.Mock).mockReturnValue(true)
    ;(mkdirSync as jest.Mock).mockClear()
    ;(writeFileSync as jest.Mock).mockClear().mockImplementation(() => undefined)
    ;(unlinkSync as jest.Mock).mockClear()
    prisma = {
      attachment: {
        findFirst: jest.fn().mockResolvedValue(row),
        create: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, entityId: 'machine-b' }),
        delete: jest.fn().mockResolvedValue(row),
      },
      machine: { findFirst: jest.fn().mockResolvedValue({ id: 'machine-a' }) },
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() }
    service = new AttachmentsService(prisma, audit)
  })

  afterEach(() => jest.restoreAllMocks())

  it('audits upload with uploader, tenant scope and description as reason', async () => {
    const file = { originalname: 'manual.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 } as any
    await service.create(file, 'MACHINE', 'machine-a', 'Maintenance manual', 'user-a', ctx)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'CREATE', 'Attachment', 'att-1', expect.objectContaining({
      companyId: 'company-a', branchId: 'branch-a', userId: 'user-a',
      reason: 'Maintenance manual',
      next: expect.objectContaining({ entityName: 'MACHINE', entityId: 'machine-a' }),
    }))
  })

  it('audits metadata update with previous and next entity references', async () => {
    await service.update('att-1', { entityId: 'machine-b' }, ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-b', 'UPDATE', 'Attachment', 'att-1', expect.objectContaining({
      previous: expect.objectContaining({ entityId: 'machine-a' }),
      next: expect.objectContaining({ entityId: 'machine-b' }),
      employeeId: 'employee-b',
    }))
  })

  it('audits deletion with tenant scope', async () => {
    await service.remove('att-1', ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-b', 'DELETE', 'Attachment', 'att-1', expect.objectContaining({
      reason: 'ATTACHMENT_DELETED', companyId: 'company-a', branchId: 'branch-a',
    }))
  })

  it('does not audit a rejected cross-tenant entity reference', async () => {
    prisma.machine.findFirst.mockResolvedValue(null)
    const file = { originalname: 'manual.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 } as any
    await expect(service.create(file, 'MACHINE', 'foreign', undefined, 'user-a', ctx)).rejects.toThrow()
    expect(audit.log).not.toHaveBeenCalled()
  })
})
