import { MachineCategoriesService } from './machine-categories.service'

describe('machine-categories tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const db: any = {
      machineCategory: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cat-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      machine: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    return db
  }

  const buildService = (db: any) =>
    new MachineCategoriesService(
      db,
      { log: jest.fn() } as any,
      { generateNumberAtomic: jest.fn().mockResolvedValue('CAT-1') } as any,
    )

  it('scopes category machine counts to the active company and branch', async () => {
    const db = buildDb()
    const service = buildService(db)
    await service.categorySummary('cat-1', ctx)
    expect(db.machine.count.mock.calls[0][0].where).toEqual({
      categoryId: 'cat-1',
      companyId: 'company-a',
      deletedAt: null,
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
  })

  it('scopes category machine list to the active company and branch', async () => {
    const db = buildDb()
    const service = buildService(db)
    await service.categoryMachines('cat-1', ctx)
    expect(db.machine.findMany.mock.calls[0][0].where).toEqual({
      categoryId: 'cat-1',
      companyId: 'company-a',
      deletedAt: null,
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
  })

  it('category itself remains a global catalog (no tenant filter on category reads)', async () => {
    const db = buildDb()
    const service = buildService(db)
    await service.findOne('cat-1')
    expect(db.machineCategory.findUnique.mock.calls[0][0].where).toEqual({ id: 'cat-1' })
  })
})
