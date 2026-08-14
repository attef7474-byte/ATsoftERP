import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { CompaniesService } from './companies.service'

describe('CompaniesService explicit system scope', () => {
  const normalCtx = { companyId: 'company-a', branchId: 'branch-a', source: 'LEGACY_USER_ASSIGNMENT' } as any
  const superCtx = { companyId: 'company-a', branchId: 'branch-a', source: 'SUPER_ADMIN' } as any
  let prisma: any
  let service: CompaniesService

  beforeEach(() => {
    prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new CompaniesService(prisma, { generateNumberAtomic: jest.fn() } as any)
  })

  it('limits normal company lists to the active company', async () => {
    await service.findAll({}, normalCtx)
    expect(prisma.company.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'company-a', deletedAt: null }),
    }))
  })

  it('rejects cross-company by-id access without querying a replacement row', async () => {
    await expect(service.findOne('company-b', normalCtx)).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.company.findFirst).not.toHaveBeenCalled()
  })

  it('requires an explicit SUPER_ADMIN operational context for company mutation', async () => {
    await expect(service.create({ name: 'Other' } as any, normalCtx)).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it('retains global company administration for an explicit SUPER_ADMIN context', async () => {
    prisma.company.findUnique.mockResolvedValue(null)
    prisma.company.create.mockResolvedValue({ id: 'company-b' })
    const numbering = (service as any).numberingService
    numbering.generateNumberAtomic.mockResolvedValue('COMP-2')
    await service.create({ name: 'Other' } as any, superCtx)
    expect(prisma.company.create).toHaveBeenCalledWith({ data: expect.objectContaining({ code: 'COMP-2', name: 'Other' }) })
  })
})
