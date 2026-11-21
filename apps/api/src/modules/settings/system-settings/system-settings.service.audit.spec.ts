import { SystemSettingsService } from './system-settings.service'

describe('SystemSettingsService audit emission', () => {
  const actor = { id: 'user-a', employeeId: 'employee-a' }
  const ctx = { companyId: 'company-a', branchId: 'branch-a', source: 'EXPLICIT_SCOPE' } as any
  const setting = { id: 'setting-1', key: 'general.siteName', value: 'Old name', group: 'general', label: 'Site name', status: 'ACTIVE' }
  let current: any
  let prisma: any
  let audit: any
  let service: SystemSettingsService

  beforeEach(() => {
    current = { ...setting }
    prisma = {
      systemSetting: {
        findUnique: jest.fn((args: any) => {
          if (args.where.key !== undefined) return Promise.resolve(null)
          return Promise.resolve({ ...current })
        }),
        create: jest.fn((args: any) => Promise.resolve({ ...setting, ...args.data, id: 'setting-1' })),
        update: jest.fn((args: any) => {
          current = { ...current, ...args.data }
          return Promise.resolve({ ...current })
        }),
      },
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() }
    service = new SystemSettingsService(prisma, audit)
  })

  it('audits setting creation with actor, scope and next value', async () => {
    await service.create({ key: 'general.siteName', group: 'general', label: 'Site name', value: 'New name' } as any, actor, ctx)

    expect(audit.log).toHaveBeenCalledWith('user-a', 'CREATE', 'SystemSetting', 'setting-1', expect.objectContaining({
      companyId: 'company-a',
      branchId: 'branch-a',
      scope: 'EXPLICIT_SCOPE',
      userId: 'user-a',
      employeeId: 'employee-a',
      next: expect.objectContaining({ key: 'general.siteName', value: 'New name', status: 'ACTIVE' }),
    }))
  })

  it('audits setting update with previous, next and changed fields', async () => {
    await service.update('setting-1', { value: 'New name' } as any, actor, ctx)

    expect(audit.log).toHaveBeenCalledWith('user-a', 'UPDATE', 'SystemSetting', 'setting-1', expect.objectContaining({
      previous: expect.objectContaining({ key: 'general.siteName', value: 'Old name' }),
      next: expect.objectContaining({ key: 'general.siteName', value: 'New name' }),
      changedFields: ['value'],
    }))
  })

  it('audits dedicated activate and deactivate actions', async () => {
    await service.deactivate('setting-1', actor, ctx)
    await service.activate('setting-1', actor, ctx)

    expect(audit.log).toHaveBeenCalledWith('user-a', 'DEACTIVATE', 'SystemSetting', 'setting-1', expect.objectContaining({
      previous: { status: 'ACTIVE' },
      next: { status: 'INACTIVE' },
      reason: 'SYSTEM_SETTING_DEACTIVATED',
    }))
    expect(audit.log).toHaveBeenCalledWith('user-a', 'ACTIVATE', 'SystemSetting', 'setting-1', expect.objectContaining({
      previous: { status: 'INACTIVE' },
      next: { status: 'ACTIVE' },
      reason: 'SYSTEM_SETTING_ACTIVATED',
    }))
  })

  it('masks secret setting values in audit details', async () => {
    current = { ...current, key: 'security.jwtSecret', value: 'old-secret' }
    prisma.systemSetting.update.mockImplementation((args: any) => {
      current = { ...current, ...args.data }
      return Promise.resolve({ ...current })
    })

    await service.update('setting-1', { value: 'new-secret' } as any, actor, ctx)

    expect(audit.log).toHaveBeenCalledWith('user-a', 'UPDATE', 'SystemSetting', 'setting-1', expect.objectContaining({
      previous: expect.objectContaining({ value: '••••••••' }),
      next: expect.objectContaining({ value: '••••••••' }),
    }))
  })
})
