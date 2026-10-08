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

  /**
   * R4R — the category -> operation types relationship.
   *
   * There is NO operationTypeId on MachineCategory and no foreign key between the two
   * tables. The only structural link is Machine.categoryId -> Machine.operationTypeId.
   * The set of operation types for a category is therefore DERIVED from the machines
   * inside it, and it must be derived tenant-scoped like every other category read.
   */
  describe('R4R derived category -> operation types', () => {
    it('scopes the derivation to the active company and branch', async () => {
      const db = buildDb()
      const service = buildService(db)
      await service.categoryOperationTypes('cat-1', ctx)
      expect(db.machine.findMany.mock.calls[0][0].where).toEqual({
        categoryId: 'cat-1',
        companyId: 'company-a',
        deletedAt: null,
        OR: [{ branchId: 'branch-a' }, { branchId: null }],
      })
    })

    it('reads the machines WITH their operation type rather than joining a category-owned one', async () => {
      const db = buildDb()
      const service = buildService(db)
      await service.categoryOperationTypes('cat-1', ctx)
      const select = db.machine.findMany.mock.calls[0][0].select
      expect(select.operationType).toBeDefined()
    })

    it('groups machines under the operation type they actually use', async () => {
      const db = buildDb()
      db.machine.findMany.mockResolvedValue([
        { id: 'm1', code: 'M1', name: 'Machine 1', status: 'ACTIVE', operationType: { id: 'ot1', code: 'CUT', name: 'Cutting', status: 'ACTIVE', description: null } },
        { id: 'm2', code: 'M2', name: 'Machine 2', status: 'ACTIVE', operationType: { id: 'ot1', code: 'CUT', name: 'Cutting', status: 'ACTIVE', description: null } },
        { id: 'm3', code: 'M3', name: 'Machine 3', status: 'ACTIVE', operationType: { id: 'ot2', code: 'PACK', name: 'Packing', status: 'ACTIVE', description: 'Pack line' } },
      ])
      const service = buildService(db)
      const result = await service.categoryOperationTypes('cat-1', ctx)

      expect(result.derivedVia).toBe('Machine.categoryId -> Machine.operationTypeId -> OperationType')
      expect(result.data).toHaveLength(2)
      const cutting = result.data.find((d: any) => d.code === 'CUT') as any
      expect(cutting).toBeDefined()
      expect(cutting.machineCount).toBe(2)
      expect(cutting.machines.map((m: any) => m.code)).toEqual(['M1', 'M2'])
      const packing = result.data.find((d: any) => d.code === 'PACK') as any
      expect(packing).toBeDefined()
      expect(packing.machineCount).toBe(1)
      expect(packing.description).toBe('Pack line')
    })

    it('reports machines that have no operation type instead of hiding them', async () => {
      const db = buildDb()
      db.machine.findMany.mockResolvedValue([
        { id: 'm1', code: 'M1', name: 'Machine 1', status: 'ACTIVE', operationType: { id: 'ot1', code: 'CUT', name: 'Cutting', status: 'ACTIVE', description: null } },
        { id: 'm2', code: 'M2', name: 'Machine 2', status: 'ACTIVE', operationType: null },
      ])
      const service = buildService(db)
      const result = await service.categoryOperationTypes('cat-1', ctx)

      expect(result.machinesWithoutOperationType).toBe(1)
      expect(result.data).toHaveLength(1)
    })

    it('returns an empty derivation for a category with no machines', async () => {
      const db = buildDb()
      db.machine.findMany.mockResolvedValue([])
      const service = buildService(db)
      const result = await service.categoryOperationTypes('cat-1', ctx)

      expect(result.data).toEqual([])
      expect(result.machinesWithoutOperationType).toBe(0)
    })

    it('never writes: the derived relationship is a read model only', async () => {
      const db = buildDb()
      const service = buildService(db)
      await service.categoryOperationTypes('cat-1', ctx)
      expect(db.machineCategory.create).not.toHaveBeenCalled()
      expect(db.machineCategory.update).not.toHaveBeenCalled()
    })
  })
})
