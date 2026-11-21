import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AuditService } from './audit.service'

type AuditRow = {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  details: string | null
  ip: string | null
  userAgent: string | null
  createdAt: Date
}

const users: Record<string, any> = {
  'actor-a': { id: 'actor-a', companyId: 'company-a', branchId: 'branch-a', deletedAt: null, email: 'a@test.local', name: 'Actor A' },
  'actor-b': { id: 'actor-b', companyId: 'company-b', branchId: 'branch-b', deletedAt: null, email: 'b@test.local', name: 'Actor B' },
  'orphan': { id: 'orphan', companyId: null, branchId: null, deletedAt: null, email: 'orphan@test.local', name: 'Orphan' },
}

const ctxA = { companyId: 'company-a', branchId: 'branch-a' } as any
const ctxB = { companyId: 'company-b', branchId: 'branch-b' } as any

function makeRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: 'log-a1',
    userId: 'actor-a',
    action: 'CREATE',
    entity: 'Machine',
    entityId: 'machine-1',
    details: JSON.stringify({ value: 'ok' }),
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date('2026-11-20T10:00:00.000Z'),
    ...overrides,
  }
}

function matchesRow(row: AuditRow, where: any): boolean {
  if (!where) return true
  if (where.user?.is) {
    const user = row.userId ? users[row.userId] : undefined
    const expected = where.user.is
    if (!user) return false
    if (expected.companyId !== undefined && user.companyId !== expected.companyId) return false
    if (expected.branchId !== undefined && user.branchId !== expected.branchId) return false
    if (expected.deletedAt === null && user.deletedAt !== null) return false
  }
  if (where.id !== undefined && row.id !== where.id) return false
  if (where.userId !== undefined && row.userId !== where.userId) return false
  if (where.entity !== undefined && row.entity !== where.entity) return false
  if (where.action !== undefined) {
    if (where.action.in && !where.action.in.includes(row.action)) return false
    if (!where.action.in && row.action !== where.action) return false
  }
  if (where.createdAt) {
    if (where.createdAt.gte && row.createdAt < new Date(where.createdAt.gte)) return false
    if (where.createdAt.lte && row.createdAt > new Date(where.createdAt.lte)) return false
  }
  if (where.OR) {
    const anyMatch = where.OR.some((clause: Record<string, any>) => Object.entries(clause).some(([key, condition]: [string, any]) => {
      const value = (row as any)[key]
      if (condition && typeof condition === 'object' && typeof condition.contains === 'string') {
        return typeof value === 'string' && value.toLowerCase().includes(condition.contains.toLowerCase())
      }
      return value === condition
    }))
    if (!anyMatch) return false
  }
  return true
}

function makeFixture(seed: AuditRow[] = []) {
  const rows = [...seed]
  const writes: Array<{ data: any }> = []
  let sequence = 0

  const withUser = (row: AuditRow, selection?: Record<string, boolean>) => {
    const user = row.userId ? users[row.userId] : undefined
    if (!user) return { ...row, user: null }
    const userView = selection
      ? Object.keys(selection).reduce((acc: Record<string, any>, key) => { acc[key] = user[key]; return acc }, {})
      : { id: user.id, email: user.email, name: user.name }
    return { ...row, user: userView }
  }

  const prisma = {
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const row = makeRow({
          id: `created-${++sequence}`,
          userId: data.userId ?? null,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId ?? null,
          details: data.details ?? null,
          ip: data.ip ?? null,
          userAgent: data.userAgent ?? null,
          createdAt: new Date('2026-11-21T12:00:00.000Z'),
        })
        rows.push(row)
        writes.push({ data })
        return row
      }),
      findMany: jest.fn(async ({ where, skip = 0, take, include }: any) => {
        const filtered = rows.filter(row => matchesRow(row, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        const paged = typeof take === 'number' ? filtered.slice(skip, skip + take) : filtered
        return paged.map(row => withUser(row, include?.user?.select))
      }),
      count: jest.fn(async ({ where }: any) => rows.filter(row => matchesRow(row, where)).length),
      findFirst: jest.fn(async ({ where }: any) => {
        const found = rows.find(row => matchesRow(row, where))
        return found ? withUser(found) : null
      }),
      groupBy: jest.fn(async () => []),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => users[where.id] ?? null),
    },
  }

  return { prisma: prisma as any, rows, writes }
}

describe('AuditService audit identity validation', () => {
  it('rejects empty or blank action/entity in positional log without writing', async () => {
    const { prisma } = makeFixture()
    const service = new AuditService(prisma)

    await expect(service.log('actor-a', '', 'Machine')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.log('actor-a', '   ', 'Machine')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.log('actor-a', 'CREATE', '')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.log(undefined, 'CREATE', '   ')).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('rejects empty or blank action/entity in object-form log and logWithClient', async () => {
    const { prisma } = makeFixture()
    const service = new AuditService(prisma)
    const tx: any = { auditLog: { create: jest.fn(async () => ({})) } }

    await expect(service.log({ userId: 'actor-a', action: '', entity: 'Machine' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.log({ userId: 'actor-a', action: 'CREATE', entity: '\t' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.logWithClient(tx, { userId: 'actor-a', action: 'CREATE', entity: '' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.logWithClient(tx, { userId: 'actor-a', action: ' ', entity: 'Machine' })).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.auditLog.create).not.toHaveBeenCalled()
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('AuditService normalized business audit', () => {
  it('writes a stable structured details object with scope, actor, previous, next and reason', async () => {
    const { prisma, writes } = makeFixture()
    const service = new AuditService(prisma)

    await service.logBusiness({
      userId: 'actor-a',
      action: 'UPDATE',
      entity: 'Machine',
      entityId: 'machine-1',
      companyId: 'company-a',
      branchId: 'branch-a',
      employeeId: 'employee-1',
      previous: { status: 'ACTIVE' },
      next: { status: 'DOWN' },
      reason: 'BREAKDOWN',
    })

    expect(writes).toHaveLength(1)
    expect(writes[0].data).toMatchObject({ userId: 'actor-a', action: 'UPDATE', entity: 'Machine', entityId: 'machine-1' })
    expect(JSON.parse(writes[0].data.details)).toEqual({
      schemaVersion: 1,
      scope: { companyId: 'company-a', branchId: 'branch-a' },
      actor: { userId: 'actor-a', employeeId: 'employee-1' },
      previous: { status: 'ACTIVE' },
      next: { status: 'DOWN' },
      reason: 'BREAKDOWN',
      metadata: null,
    })
  })

  it('writes through the supplied transaction client and not the default client', async () => {
    const { prisma } = makeFixture()
    const service = new AuditService(prisma)
    const tx: any = { auditLog: { create: jest.fn(async () => ({})) } }

    await service.logWithClientBusiness(tx, {
      userId: 'actor-a',
      action: 'STATUS_TRANSITION',
      entity: 'MaintenanceRequest',
      companyId: 'company-a',
      branchId: 'branch-a',
    })

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1)
    expect(JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details).scope).toEqual({ companyId: 'company-a', branchId: 'branch-a' })
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('rejects empty business identity and missing tenant scope', async () => {
    const { prisma } = makeFixture()
    const service = new AuditService(prisma)

    await expect(service.logBusiness({ action: '', entity: 'Machine', companyId: 'company-a' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.logBusiness({ action: 'UPDATE', entity: '  ', companyId: 'company-a' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.logBusiness({ action: 'UPDATE', entity: 'Machine', companyId: '' })).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('AuditService detail redaction', () => {
  it('redacts sensitive keys on every writer path while preserving safe values', async () => {
    const { prisma, writes } = makeFixture()
    const service = new AuditService(prisma)
    const tx: any = { auditLog: { create: jest.fn(async () => ({})) } }
    const details = {
      email: 'user@test.local',
      password: 'PlainSecret',
      nested: { token: 'jwt-value', accessToken: 'access-value', safe: 'keep' },
      list: [{ apiKey: 'key-value', label: 'ok' }],
    }

    await service.log('actor-a', 'CREATE', 'Machine', 'm1', details)
    await service.logWithClient(tx, { userId: 'actor-a', action: 'UPDATE', entity: 'Machine', details: JSON.stringify(details) })
    await service.logBusiness({
      userId: 'actor-a',
      action: 'UPDATE',
      entity: 'Machine',
      companyId: 'company-a',
      branchId: 'branch-a',
      previous: { jwt: 'raw-secret', safe: 'old' },
      next: { safe: 'visible' },
    })

    const positional = JSON.parse(writes[0].data.details)
    expect(positional.email).toBe('user@test.local')
    expect(positional.password).toBe('***')
    expect(positional.nested.token).toBe('***')
    expect(positional.nested.accessToken).toBe('***')
    expect(positional.nested.safe).toBe('keep')
    expect(positional.list[0].apiKey).toBe('***')
    expect(positional.list[0].label).toBe('ok')

    const clientWrite = JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details)
    expect(clientWrite.password).toBe('***')
    expect(clientWrite.nested.token).toBe('***')

    const business = JSON.parse(writes[1].data.details)
    expect(business.previous.jwt).toBe('***')
    expect(business.previous.safe).toBe('old')
    expect(business.next.safe).toBe('visible')
  })

  it('uses the same sensitive-key list on read sanitization for legacy stored details', async () => {
    const fixture = makeFixture([makeRow({ details: JSON.stringify({ password: 'raw-password', authorization: 'Bearer raw', safe: 'ok' }) })])
    const service = new AuditService(fixture.prisma)

    const found = await service.findOne('log-a1', ctxA)

    expect(found.details).toMatchObject({ password: '***', authorization: '***', safe: 'ok' })
    expect(fixture.rows[0].details).toContain('raw-password')
  })
})

describe('AuditService tenant-scoped reads', () => {
  it('returns only the active company/branch rows from list, search and export', async () => {
    const fixture = makeFixture([
      makeRow({ id: 'a1', entityId: 'entity-a', userId: 'actor-a', entity: 'SharedEntity' }),
      makeRow({ id: 'b1', entityId: 'entity-b', userId: 'actor-b', entity: 'SharedEntity', createdAt: new Date('2026-11-21T09:00:00.000Z') }),
      makeRow({ id: 'orphan-1', entityId: 'entity-orphan', userId: 'orphan', entity: 'SharedEntity' }),
    ])
    const service = new AuditService(fixture.prisma)

    const listA = await service.findAll({ search: 'shared' }, ctxA)
    const listB = await service.findAll({ search: 'shared' }, ctxB)

    expect(listA.data.map(log => log.id)).toEqual(['a1'])
    expect(listB.data.map(log => log.id)).toEqual(['b1'])
    expect(fixture.prisma.auditLog.findMany.mock.calls[0][0].where.user.is).toEqual({ companyId: 'company-a', branchId: 'branch-a', deletedAt: null })
    expect(fixture.prisma.auditLog.findMany.mock.calls[1][0].where.user.is).toEqual({ companyId: 'company-b', branchId: 'branch-b', deletedAt: null })

    const csv = await service.exportCsv({ entity: 'SharedEntity' }, ctxB)
    expect(csv).toContain('entity-b')
    expect(csv).not.toContain('entity-a')
    expect(csv).not.toContain('entity-orphan')
  })

  it('does not expose another tenant log by id', async () => {
    const fixture = makeFixture([
      makeRow({ id: 'a1', userId: 'actor-a' }),
      makeRow({ id: 'b1', userId: 'actor-b' }),
    ])
    const service = new AuditService(fixture.prisma)

    await expect(service.findOne('a1', ctxB)).rejects.toBeInstanceOf(NotFoundException)
    expect(fixture.prisma.auditLog.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'a1',
      user: { is: { companyId: 'company-b', branchId: 'branch-b', deletedAt: null } },
    })
    await expect(service.findOne('b1', ctxB)).resolves.toMatchObject({ id: 'b1' })
  })
})

describe('AuditService export audit event', () => {
  it('audits a successful CSV export with actor, context scope, filter summary and row count', async () => {
    const fixture = makeFixture([
      makeRow({ id: 'a1', entityId: 'machine-a', userId: 'actor-a', entity: 'Machine', createdAt: new Date('2026-11-20T10:00:00.000Z') }),
      makeRow({ id: 'a2', entityId: 'count-a', userId: 'actor-a', entity: 'InventoryCount', createdAt: new Date('2026-11-21T10:00:00.000Z') }),
      makeRow({ id: 'b1', entityId: 'machine-b', userId: 'actor-b', entity: 'Machine', createdAt: new Date('2026-11-20T11:00:00.000Z') }),
    ])
    const service = new AuditService(fixture.prisma)
    const filters = { entity: 'Machine', startDate: '2026-11-01', endDate: '2026-11-30' }

    const csv = await service.exportCsv(filters, ctxA, 'actor-a')

    expect(csv).toContain('timestamp,user,email,action,entity,entityId,ip,userAgent')
    expect(csv).toContain('machine-a')
    expect(csv).not.toContain('count-a')
    expect(csv).not.toContain('machine-b')
    expect(fixture.writes).toHaveLength(1)
    expect(fixture.writes[0].data).toMatchObject({ userId: 'actor-a', action: 'EXPORT', entity: 'AuditLog' })
    const details = JSON.parse(fixture.writes[0].data.details)
    expect(details.schemaVersion).toBe(1)
    expect(details.scope).toEqual({ companyId: 'company-a', branchId: 'branch-a' })
    expect(details.actor).toEqual({ userId: 'actor-a', employeeId: null })
    expect(details.reason).toBe('AUDIT_LOG_CSV_EXPORT')
    expect(details.metadata.filters).toEqual(filters)
    expect(details.metadata.rowCount).toBe(1)
  })

  it('derives the audit event scope from the actor user when the active context is unavailable', async () => {
    const fixture = makeFixture()
    const service = new AuditService(fixture.prisma)

    await expect((service as any).resolveBusinessScope(undefined, 'actor-a')).resolves.toEqual({ companyId: 'company-a', branchId: 'branch-a' })
    expect(fixture.prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'actor-a' }, select: { companyId: true, branchId: true } })
    await expect((service as any).resolveBusinessScope(undefined, 'missing')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('keeps legacy export callers that have no actor working without writing an orphan audit row', async () => {
    const fixture = makeFixture([makeRow({ id: 'a1', entityId: 'legacy-a', userId: 'actor-a' })])
    const service = new AuditService(fixture.prisma)

    const csv = await service.exportCsv({}, ctxA)

    expect(csv).toContain('legacy-a')
    expect(fixture.writes).toHaveLength(0)
  })
})
