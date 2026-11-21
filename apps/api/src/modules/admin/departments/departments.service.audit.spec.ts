import { DepartmentsService } from './departments.service'

describe('DepartmentsService audit emission', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a', source: 'EXPLICIT_SCOPE' } as any
  const actor = { id: 'user-a', employeeId: 'employee-a' }
  const row = { id: 'd1', code: 'DEP-1', name: 'Quality', companyId: 'company-a', branchId: 'branch-a', administrationId: 'a1', parentId: null, classification: 'OPERATIONAL', deletedAt: null }
  let prisma: any
  let audit: any
  let service: DepartmentsService

  beforeEach(() => {
    prisma = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: 'company-a' }) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-a', companyId: 'company-a' }) },
      administration: { findFirst: jest.fn().mockResolvedValue({ id: 'a1', branchId: 'branch-a' }) },
      department: {
        findFirst: jest.fn().mockResolvedValue(row),
        create: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, name: 'Renamed', classification: 'SECTION' }),
      },
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() }
    service = new DepartmentsService(prisma, { generateNumberAtomic: jest.fn().mockResolvedValue('DEP-1') } as any, audit)
  })

  it('audits create with tenant scope and created values', async () => {
    await service.create({ name: 'Quality' } as any, ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'CREATE', 'Department', 'd1', expect.objectContaining({
      companyId: 'company-a', branchId: 'branch-a', userId: 'user-a', employeeId: 'employee-a',
      next: expect.objectContaining({ code: 'DEP-1', name: 'Quality' }),
    }))
  })

  it('audits update with previous and next values', async () => {
    await service.update('d1', { name: 'Renamed' } as any, ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'UPDATE', 'Department', 'd1', expect.objectContaining({
      previous: expect.objectContaining({ name: 'Quality' }),
      next: expect.objectContaining({ name: 'Renamed' }),
      changedFields: ['name'],
    }))
  })

  it('audits soft delete with a reason', async () => {
    await service.remove('d1', ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'DELETE', 'Department', 'd1', expect.objectContaining({
      reason: 'SOFT_DELETE', companyId: 'company-a', branchId: 'branch-a',
    }))
  })

  it('audits classification as a dedicated action', async () => {
    await service.classify('d1', 'SECTION', ctx, actor)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'CLASSIFY', 'Department', 'd1', expect.objectContaining({
      previous: { classification: 'OPERATIONAL' },
      next: { classification: 'SECTION' },
    }))
  })

  it('does not audit an invalid classification', async () => {
    await expect(service.classify('d1', 'INVALID', ctx, actor)).rejects.toThrow()
    expect(audit.log).not.toHaveBeenCalled()
  })
})
