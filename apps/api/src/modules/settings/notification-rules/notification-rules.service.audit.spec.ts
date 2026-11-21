import { NotificationRulesService } from './notification-rules.service'

describe('NotificationRulesService audit emission', () => {
  const actor = { id: 'user-a', employeeId: 'employee-a' }
  const ctx = { companyId: 'company-a', branchId: 'branch-a', source: 'EXPLICIT_SCOPE' } as any
  const rule = { id: 'rule-1', code: 'R1', eventType: 'MAINTENANCE_REQUEST_CREATED', channel: 'IN_APP', severity: 'INFO', enabled: true, targetRoleId: null, targetPermission: null }
  let currentRule: any
  let prisma: any
  let audit: any
  let service: NotificationRulesService

  beforeEach(() => {
    currentRule = { ...rule }
    prisma = {
      notificationRule: {
        findUnique: jest.fn(() => Promise.resolve({ ...currentRule })),
        create: jest.fn().mockResolvedValue({ ...currentRule }),
        update: jest.fn((args: any) => {
          currentRule = { ...currentRule, ...args.data }
          return Promise.resolve({ ...currentRule })
        }),
        delete: jest.fn().mockResolvedValue({ ...currentRule }),
      },
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn() }
    service = new NotificationRulesService(prisma, audit)
  })

  it('audits rule creation with actor and reason', async () => {
    await service.create({ code: 'R1', nameAr: 'قاعدة', nameEn: 'Rule', eventType: 'MAINTENANCE_REQUEST_CREATED', description: 'ops' }, actor, ctx)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'CREATE', 'NotificationRule', 'rule-1', expect.objectContaining({
      userId: 'user-a', employeeId: 'employee-a', companyId: 'company-a', branchId: 'branch-a', reason: 'ops',
    }))
  })

  it('audits rule update with previous and next values', async () => {
    await service.update('rule-1', { severity: 'CRITICAL' }, actor, ctx)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'UPDATE', 'NotificationRule', 'rule-1', expect.objectContaining({
      previous: expect.objectContaining({ severity: 'INFO' }),
      next: expect.objectContaining({ severity: 'CRITICAL' }),
    }))
  })

  it('audits dedicated activate and deactivate actions', async () => {
    await service.deactivate('rule-1', actor, ctx)
    await service.activate('rule-1', actor, ctx)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'DEACTIVATE', 'NotificationRule', 'rule-1', expect.objectContaining({
      previous: { enabled: true }, next: { enabled: false },
    }))
    expect(audit.log).toHaveBeenCalledWith('user-a', 'ACTIVATE', 'NotificationRule', 'rule-1', expect.objectContaining({
      previous: { enabled: false }, next: { enabled: true },
    }))
  })

  it('audits deletion only after the rule is found', async () => {
    await service.remove('rule-1', actor, ctx)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'DELETE', 'NotificationRule', 'rule-1', expect.objectContaining({
      previous: expect.objectContaining({ code: 'R1' }),
    }))
  })
})
