import { ConflictException, NotFoundException } from '@nestjs/common'
import { CompanyOperationalCurrencyPolicy } from './company-operational-currency.policy'
import { CompanyProfileService } from './company-profile.service'

const ctxA = { companyId: 'company-a', branchId: 'branch-a' } as any
const ctxAOtherBranch = { companyId: 'company-a', branchId: 'branch-a2' } as any
const ctxB = { companyId: 'company-b', branchId: 'branch-b' } as any

const company = (id: string, operationalCurrencyCode: string | null = null) => ({
  id,
  name: id,
  phone: null,
  email: null,
  address: null,
  deletedAt: null,
  operationalCurrencyCode,
})

describe('COST-R1A-C CompanyProfileService', () => {
  let prisma: any
  let audit: any
  let service: CompanyProfileService

  beforeEach(() => {
    prisma = {
      company: {
        findFirst: jest.fn().mockResolvedValue(company('company-a')),
        update: jest.fn().mockResolvedValue(company('company-a')),
      },
      systemSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      operationalCostTransaction: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    }
    audit = { logWithClient: jest.fn().mockResolvedValue({}) }
    service = new CompanyProfileService(prisma, audit, new CompanyOperationalCurrencyPolicy())
  })

  it('reads the configured company currency from the active company', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    const result = await service.getProfile(ctxA)
    expect(result.operationalCurrencyCode).toBe('USD')
    expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { id: 'company-a', deletedAt: null } })
  })

  it('returns null for a legacy company without inventing USD', async () => {
    const result = await service.getProfile(ctxA)
    expect(result.operationalCurrencyCode).toBeNull()
    expect(result.operationalCurrencyCode).not.toBe('USD')
  })

  it('returns null for a legacy company without inventing SAR', async () => {
    const result = await service.getProfile(ctxA)
    expect(result.operationalCurrencyCode).toBeNull()
    expect(result.operationalCurrencyCode).not.toBe('SAR')
  })

  it('does not let the legacy SystemSetting currency override company authority', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    prisma.systemSetting.findMany.mockResolvedValue([{ key: 'company.currencyCode', value: 'SAR' }])
    const result = await service.getProfile(ctxA)
    expect(result.currencyCode).toBe('SAR')
    expect(result.operationalCurrencyCode).toBe('USD')
  })

  it('isolates company A and company B currency reads', async () => {
    prisma.company.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === 'company-a' ? company('company-a', 'USD') : company('company-b', 'SAR')),
    )
    expect((await service.getProfile(ctxA)).operationalCurrencyCode).toBe('USD')
    expect((await service.getProfile(ctxB)).operationalCurrencyCode).toBe('SAR')
  })

  it('sets and normalizes a valid operational currency before the first cost row', async () => {
    await service.updateProfile({ operationalCurrencyCode: ' usd ' }, 'user-a', ctxA)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'company-a' },
      data: { operationalCurrencyCode: 'USD' },
    })
  })

  it('sets SAR as an explicitly supplied company currency', async () => {
    await service.updateProfile({ operationalCurrencyCode: 'sar' }, 'user-a', ctxA)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'company-a' },
      data: { operationalCurrencyCode: 'SAR' },
    })
  })

  it('allows currency change before the first operational cost row', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    await service.updateProfile({ operationalCurrencyCode: 'EUR' }, 'user-a', ctxA)
    expect(prisma.operationalCostTransaction.count).toHaveBeenCalledWith({ where: { companyId: 'company-a', entryRole: 'PRIMARY_COST' } })
    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({ data: { operationalCurrencyCode: 'EUR' } }))
  })

  it('COST-R1B: freeze count filters to canonical PRIMARY_COST history (reversal-only rows do not freeze)', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    prisma.operationalCostTransaction.count.mockResolvedValue(0)
    await service.updateProfile({ operationalCurrencyCode: 'EUR' }, 'user-a', ctxA)
    expect(prisma.operationalCostTransaction.count).toHaveBeenCalledWith({ where: { companyId: 'company-a', entryRole: 'PRIMARY_COST' } })
    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({ data: { operationalCurrencyCode: 'EUR' } }))
  })

  it('blocks currency change after the first operational cost row', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    prisma.operationalCostTransaction.count.mockResolvedValue(1)
    await expect(service.updateProfile({ operationalCurrencyCode: 'SAR' }, 'user-a', ctxA)).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('allows explicit clear before the first operational cost row', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    await service.updateProfile({ operationalCurrencyCode: null }, 'user-a', ctxA)
    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({ data: { operationalCurrencyCode: null } }))
  })

  it('blocks explicit clear after the first operational cost row', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    prisma.operationalCostTransaction.count.mockResolvedValue(2)
    await expect(service.updateProfile({ operationalCurrencyCode: null }, 'user-a', ctxA)).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('records an audit row for a currency mutation', async () => {
    await service.updateProfile({ operationalCurrencyCode: 'USD' }, 'user-a', ctxA)
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({
      userId: 'user-a',
      action: 'OPERATIONAL_CURRENCY_CHANGE',
      entity: 'Company',
      entityId: 'company-a',
      details: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', before: null, after: 'USD' }),
    }))
  })

  it('does not audit or count rows for a no-op currency submission', async () => {
    prisma.company.findFirst.mockResolvedValue(company('company-a', 'USD'))
    await service.updateProfile({ operationalCurrencyCode: 'USD' }, 'user-a', ctxA)
    expect(prisma.operationalCostTransaction.count).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })

  it('cannot override company currency through a branch field', async () => {
    await service.updateProfile({ operationalCurrencyCode: 'USD' }, 'user-a', ctxAOtherBranch)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'company-a' },
      data: { operationalCurrencyCode: 'USD' },
    })
    expect(prisma.company.update.mock.calls[0][0].data.branchId).toBeUndefined()
  })

  it('does not write operational currency to SystemSetting', async () => {
    await service.updateProfile({ operationalCurrencyCode: 'USD' }, 'user-a', ctxA)
    expect(prisma.systemSetting.upsert).not.toHaveBeenCalled()
  })

  it('does not consult InventoryValuationPolicy as operational authority', async () => {
    await service.getProfile(ctxA)
    expect(prisma.inventoryValuationPolicy).toBeUndefined()
  })

  it('retains existing non-currency profile setting updates', async () => {
    await service.updateProfile({ city: 'Aden' }, 'user-a', ctxA)
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'company.city' },
    }))
  })

  it('rejects invalid currency even when the service is called directly', async () => {
    await expect(service.updateProfile({ operationalCurrencyCode: 'BAD' }, 'user-a', ctxA)).rejects.toThrow()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('fails closed when the active company does not exist', async () => {
    prisma.company.findFirst.mockResolvedValue(null)
    await expect(service.getProfile(ctxA)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.updateProfile({ operationalCurrencyCode: 'USD' }, 'user-a', ctxA)).rejects.toBeInstanceOf(NotFoundException)
  })
})
