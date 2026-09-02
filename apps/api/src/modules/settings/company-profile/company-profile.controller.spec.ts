import { ForbiddenException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Reflector } from '@nestjs/core'
import { PermissionsGuard } from '../../../common/guards/permissions.guard'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { CompanyProfileController } from './company-profile.controller'

describe('COST-R1A-C CompanyProfileController contract', () => {
  const service = { getProfile: jest.fn(), updateProfile: jest.fn() }
  const controller = new CompanyProfileController(service as any)

  it('uses the seeded company:read permission', () => {
    expect(Reflect.getMetadata('permissions', controller.getProfile)).toEqual(['company:read'])
  })

  it('uses the seeded company:update permission for mutation', () => {
    expect(Reflect.getMetadata('permissions', controller.updateProfile)).toEqual(['company:update'])
  })

  it('passes active tenant context to reads', async () => {
    const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any
    await controller.getProfile(ctx)
    expect(service.getProfile).toHaveBeenCalledWith(ctx)
  })

  it('passes actor and active tenant context to writes', async () => {
    const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any
    await controller.updateProfile({ operationalCurrencyCode: 'USD' }, 'user-a', ctx)
    expect(service.updateProfile).toHaveBeenCalledWith({ operationalCurrencyCode: 'USD' }, 'user-a', ctx)
  })
})

describe('COST-R1A-C company:update authorization', () => {
  let guard: PermissionsGuard
  let prisma: { userRole: { findMany: jest.Mock } }

  const activeRole = (code: string, permissionKeys: string[]) => ({
    role: {
      status: 'ACTIVE',
      code,
      permissions: permissionKeys.map((key) => ({ permission: { status: 'ACTIVE', key } })),
    },
  })

  const makeContext = (user: unknown, handler: () => void, target: object) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => handler,
      getClass: () => target,
    }) as any

  beforeEach(async () => {
    prisma = { userRole: { findMany: jest.fn() } }
    const moduleRef = await Test.createTestingModule({
      providers: [Reflector, PermissionsGuard, { provide: PrismaService, useValue: prisma }],
    }).compile()
    guard = moduleRef.get(PermissionsGuard)
  })

  it('denies an operator who lacks company:update from mutating the company currency', async () => {
    const handler = () => undefined
    Reflect.defineMetadata('permissions', ['company:update'], handler)
    prisma.userRole.findMany.mockResolvedValue([activeRole('OPERATOR', ['company:read'])])
    const ctx = makeContext({ id: 'u1' }, handler, {})
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('allows a user who holds company:update to mutate the company currency', async () => {
    const handler = () => undefined
    Reflect.defineMetadata('permissions', ['company:update'], handler)
    prisma.userRole.findMany.mockResolvedValue([activeRole('COMPANY_ADMIN', ['company:update'])])
    const ctx = makeContext({ id: 'u1' }, handler, {})
    await expect(guard.canActivate(ctx)).resolves.toBe(true)
  })
})
