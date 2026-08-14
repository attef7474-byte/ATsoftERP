import { NotFoundException } from '@nestjs/common'
import { BusinessPartnerAddressesService } from './addresses/addresses.service'
import { BusinessPartnerBankAccountsService } from './bank-accounts/bank-accounts.service'
import { BusinessPartnerContactsService } from './contacts/contacts.service'

describe('business-partner child tenant boundaries', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const prisma = () => ({
    businessPartner: { findFirst: jest.fn() },
    businessPartnerAddress: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn(), update: jest.fn() },
    businessPartnerContact: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn(), update: jest.fn() },
    businessPartnerBankAccount: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn(), update: jest.fn() },
  })

  it.each([
    ['address', (p: any) => new BusinessPartnerAddressesService(p), 'businessPartnerAddress'],
    ['contact', (p: any) => new BusinessPartnerContactsService(p), 'businessPartnerContact'],
    ['bank account', (p: any) => new BusinessPartnerBankAccountsService(p), 'businessPartnerBankAccount'],
  ])('scopes %s list queries through its owning partner', async (_name, factory, delegateName) => {
    const db: any = prisma()
    const service: any = factory(db)
    await service.findAll({}, ctx)
    expect(db[delegateName].findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        partner: { companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
      }),
    }))
  })

  it.each([
    ['address', (p: any) => new BusinessPartnerAddressesService(p), { partnerId: 'partner-b' }, 'businessPartnerAddress'],
    ['contact', (p: any) => new BusinessPartnerContactsService(p), { partnerId: 'partner-b', name: 'Contact' }, 'businessPartnerContact'],
    ['bank account', (p: any) => new BusinessPartnerBankAccountsService(p), { partnerId: 'partner-b', bankName: 'Bank' }, 'businessPartnerBankAccount'],
  ])('rejects a foreign partner before creating a %s', async (_name, factory, dto, delegateName) => {
    const db: any = prisma()
    db.businessPartner.findFirst.mockResolvedValue(null)
    const service: any = factory(db)
    await expect(service.create(dto, ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.businessPartner.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'partner-b', companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
    }))
    expect(db[delegateName].create).not.toHaveBeenCalled()
  })
})
