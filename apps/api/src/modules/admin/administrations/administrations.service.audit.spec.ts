import { AdministrationsService } from './administrations.service'

describe('AdministrationsService audit emission', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a', source: 'EXPLICIT_SCOPE' } as any
  const actor = { id: 'user-a', employeeId: 'employee-a' }
  const row = { id: 'adm1', code: 'ADM-1', name: 'Production', branchId: 'branch-a', status: 'ACTIVE', deletedAt: null }
  let prisma: any
  let audit: any
  let service: AdministrationsService

  beforeEach(() => {
    prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-a', companyId: 'company-a' }) },
      administration: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, name: 'Operations' }),
      },
      department: { count: jest.fn().mockResolvedValue(0) },
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() }
    service = new AdministrationsService(prisma, { generateNumberAtomic: jest.fn().mockResolvedValue('ADM-1') } as any, audit)
  })

  it('audits create with actor and authoritative branch scope', async () => {
    await service.create({ name: 'Production' } as any, ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'CREATE', 'Administration', 'adm1', expect.objectContaining({
      companyId: 'company-a', branchId: 'branch-a', userId: 'user-a', employeeId: 'employee-a',
      next: expect.objectContaining({ code: 'ADM-1' }),
    }))
  })

  it('audits update with previous and next values', async () => {
    prisma.administration.findFirst.mockResolvedValueOnce(row)
    await service.update('adm1', { name: 'Operations' } as any, ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'UPDATE', 'Administration', 'adm1', expect.objectContaining({
      previous: expect.objectContaining({ name: 'Production' }),
      next: expect.objectContaining({ name: 'Operations' }),
    }))
  })

  it('audits delete within tenant scope', async () => {
    prisma.administration.findFirst.mockResolvedValueOnce(row)
    await service.remove('adm1', ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'DELETE', 'Administration', 'adm1', expect.objectContaining({
      reason: 'SOFT_DELETE', companyId: 'company-a', branchId: 'branch-a',
    }))
  })

  it('does not audit when deletion is blocked by active departments', async () => {
    prisma.administration.findFirst.mockResolvedValueOnce(row)
    prisma.department.count.mockResolvedValue(1)
    await expect(service.remove('adm1', ctx, actor)).rejects.toThrow()
    expect(audit.log).not.toHaveBeenCalled()
  })
})
