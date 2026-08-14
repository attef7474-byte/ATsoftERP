import { NotFoundException } from '@nestjs/common'
import { AuditReportsService } from './audit-reports.service'
import { InventoryReportsService } from './inventory-reports.service'
import { SystemReportsService } from './system-reports.service'

const delegate = () => ({
  count: jest.fn().mockResolvedValue(0),
  findMany: jest.fn().mockResolvedValue([]),
  findFirst: jest.fn().mockResolvedValue(null),
  aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
  groupBy: jest.fn().mockResolvedValue([]),
})

describe('tenant-scoped report queries', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  it('scopes inventory balances and warehouse cards to the accepted warehouse contract', async () => {
    const prisma: any = {
      inventoryBalance: delegate(),
      warehouse: delegate(),
    }
    const service = new InventoryReportsService(prisma)

    await service.getInventoryBalanceReport({}, ctx)

    const balanceWhere = prisma.inventoryBalance.findMany.mock.calls[0][0].where
    expect(balanceWhere.warehouse).toEqual({
      companyId: 'company-a',
      deletedAt: null,
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(prisma.warehouse.count).toHaveBeenCalledWith({ where: balanceWhere.warehouse })
  })

  it('uses a scoped by-id query and returns not found for a foreign movement', async () => {
    const prisma: any = { inventoryMovement: delegate() }
    const service = new InventoryReportsService(prisma)

    await expect(service.getMovementTraceability('movement-b', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.inventoryMovement.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'movement-b', companyId: 'company-a', deletedAt: null, OR: [{ branchId: 'branch-a' }, { branchId: null }] },
    }))
  })

  it('derives audit and notification report ownership through the actor user', async () => {
    const prisma: any = {
      auditLog: delegate(),
      notification: delegate(),
    }
    const service = new AuditReportsService(prisma)

    await service.getAuditTrailReport({}, ctx)
    await service.getNotificationsReport({}, ctx)

    expect(prisma.auditLog.findMany.mock.calls[0][0].where.user).toEqual({
      is: { companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
    })
    expect(prisma.notification.findMany.mock.calls[0][0].where.user).toEqual({
      is: { companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
    })
  })

  it('does not aggregate business-partner PII outside the active branch', async () => {
    const prisma: any = { businessPartner: delegate() }
    const service = new SystemReportsService(prisma)

    await service.getPartnersReport({}, ctx)

    const expected = expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', deletedAt: null })
    expect(prisma.businessPartner.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expected }))
    for (const call of prisma.businessPartner.count.mock.calls) {
      expect(call[0].where).toEqual(expected)
    }
    expect(prisma.businessPartner.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expected }))
  })
})
