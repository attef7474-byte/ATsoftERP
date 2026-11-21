import { SecurityService } from './security.service'

describe('SecurityService audit emission', () => {
  const actor = { id: 'user-a', employeeId: 'employee-a' }
  const ctx = { companyId: 'company-a', branchId: 'branch-a', source: 'EXPLICIT_SCOPE' } as any
  let prisma: any
  let audit: any
  let service: SecurityService

  beforeEach(() => {
    prisma = {
      systemSetting: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'security.sessionTimeoutMinutes', value: '30' },
          { key: 'security.maxLoginAttempts', value: '3' },
        ]),
        upsert: jest.fn().mockResolvedValue({}),
      },
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() }
    service = new SecurityService(prisma, audit)
  })

  it('audits security settings update with actor, scope, previous and next values', async () => {
    await service.update({ sessionTimeoutMinutes: 45, maxLoginAttempts: 5 }, actor, ctx)

    expect(audit.log).toHaveBeenCalledWith('user-a', 'SECURITY_SETTINGS_UPDATE', 'SecuritySettings', 'security', expect.objectContaining({
      companyId: 'company-a',
      branchId: 'branch-a',
      scope: 'EXPLICIT_SCOPE',
      userId: 'user-a',
      employeeId: 'employee-a',
      changedFields: ['security.sessionTimeoutMinutes', 'security.maxLoginAttempts'],
      previous: {
        'security.sessionTimeoutMinutes': '30',
        'security.maxLoginAttempts': '3',
      },
      next: {
        'security.sessionTimeoutMinutes': '45',
        'security.maxLoginAttempts': '5',
      },
    }))
  })

  it('does not emit an audit event when no setting changed', async () => {
    await service.update({}, actor, ctx)
    expect(audit.log).not.toHaveBeenCalled()
  })
})
