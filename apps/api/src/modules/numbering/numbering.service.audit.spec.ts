import { NumberingService } from './numbering.service'

describe('NumberingService audit emission', () => {
  const actor = { id: 'user-a', employeeId: 'employee-a' }
  const ctx = { companyId: 'company-a', branchId: 'branch-a', source: 'EXPLICIT_SCOPE' } as any
  const seq = { id: 'seq-1', code: 'COMPANY', prefix: 'COMP-', suffix: null, padding: 4, currentNumber: 1, increment: 1, status: 'ACTIVE', resetPolicy: 'YEARLY', lastResetAt: null, lastGeneratedCode: 'COMP-0001' }
  let tx: any
  let prisma: any
  let audit: any
  let service: NumberingService

  beforeEach(() => {
    tx = {
      numberSequence: {
        findUnique: jest.fn().mockResolvedValue(seq),
        update: jest.fn().mockResolvedValue({ ...seq, currentNumber: 2, lastGeneratedCode: 'COMP-0002' }),
      },
    }
    prisma = {
      numberSequence: {
        create: jest.fn().mockResolvedValue(seq),
        findUnique: jest.fn().mockResolvedValue(seq),
        update: jest.fn().mockResolvedValue({ ...seq, status: 'INACTIVE' }),
      },
      $transaction: jest.fn((fn: any) => fn(tx)),
    }
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn().mockResolvedValue({}) }
    service = new NumberingService(prisma, audit)
  })

  it('audits sequence creation', async () => {
    await service.create({ code: 'COMPANY' } as any, actor, ctx)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'CREATE', 'NumberSequence', 'seq-1', expect.objectContaining({
      companyId: 'company-a', branchId: 'branch-a', userId: 'user-a', employeeId: 'employee-a',
    }))
  })

  it('audits sequence configuration update with previous and next values', async () => {
    await service.update('seq-1', { status: 'INACTIVE' } as any, actor, ctx)
    expect(audit.log).toHaveBeenCalledWith('user-a', 'UPDATE', 'NumberSequence', 'seq-1', expect.objectContaining({
      previous: expect.objectContaining({ status: 'ACTIVE' }),
      next: expect.objectContaining({ status: 'INACTIVE' }),
    }))
  })

  it('audits explicit number generation through the transactional writer', async () => {
    const result = await service.generateNumber('COMPANY', actor, ctx)
    expect(result.number).toBe('COMP-0002')
    expect(audit.logWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({
      userId: 'user-a',
      action: 'NUMBER_GENERATED',
      entity: 'NumberSequence',
      entityId: 'seq-1',
      details: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a', employeeId: 'employee-a' }),
    }))
  })

  it('audits atomic generation on the caller-supplied transaction client when metadata is given', async () => {
    const generated = await service.generateNumberAtomicWithClient('COMPANY', tx, actor, ctx)
    expect(generated).toBe('COMP-0002')
    expect(audit.logWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'NUMBER_GENERATED' }))
  })

  it('does not emit actorless audit rows for internal numbering side effects', async () => {
    await service.generateNumberAtomicWithClient('COMPANY', tx)
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })
})
