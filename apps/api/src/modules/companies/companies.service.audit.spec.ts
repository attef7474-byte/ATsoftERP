import { CompaniesService } from './companies.service'

describe('CompaniesService audit emission', () => {
  const superCtx = { companyId: 'company-a', branchId: 'branch-a', source: 'SUPER_ADMIN' } as any
  const actor = { id: 'user-a', employeeId: 'employee-a' }
  let prisma: any
  let audit: any
  let service: CompaniesService

  beforeEach(() => {
    prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'company-b', code: 'B', name: 'B Co', status: 'ACTIVE', deletedAt: null }),
        create: jest.fn().mockResolvedValue({ id: 'company-b', code: 'B', name: 'B Co', status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue({ id: 'company-b', code: 'B2', name: 'B Co 2', status: 'ACTIVE' }),
      },
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() }
    service = new CompaniesService(prisma, { generateNumberAtomic: jest.fn().mockResolvedValue('COMP-1') } as any, audit)
  })

  it('audits a super-admin company create with actor, scope and resulting values', async () => {
    const created = await service.create({ name: 'B Co' } as any, superCtx, actor)
    expect(created.id).toBe('company-b')
    expect(audit.log).toHaveBeenCalledWith('user-a', 'CREATE', 'Company', 'company-b', expect.objectContaining({
      companyId: 'company-a',
      branchId: 'branch-a',
      scope: 'SUPER_ADMIN',
      userId: 'user-a',
      employeeId: 'employee-a',
      next: expect.objectContaining({ code: 'B' }),
    }))
  })

  it('audits an update with previous and next values', async () => {
    await service.update('company-b', { name: 'B Co 2' } as any, superCtx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'UPDATE', 'Company', 'company-b', expect.objectContaining({
      previous: expect.objectContaining({ name: 'B Co' }),
      next: expect.objectContaining({ name: 'B Co 2' }),
      changedFields: ['name'],
    }))
  })

  it('audits a soft delete with reason and authoritative scope', async () => {
    await service.remove('company-b', superCtx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'DELETE', 'Company', 'company-b', expect.objectContaining({
      reason: 'SOFT_DELETE',
      companyId: 'company-a',
      branchId: 'branch-a',
      previous: expect.objectContaining({ deletedAt: null }),
      next: expect.objectContaining({ deletedAt: expect.any(String) }),
    }))
  })

  it('does not audit a rejected non-super-admin mutation', async () => {
    await expect(service.create({ name: 'X' } as any, { companyId: 'a', branchId: 'b', source: 'EXPLICIT_SCOPE' } as any, actor)).rejects.toThrow()
    expect(audit.log).not.toHaveBeenCalled()
  })
})
