import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MachineResponsibilityAssignmentsService } from './machine-responsibility-assignments.service'

describe('machine-responsibility-assignments tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any
  const userId = 'user-1'

  const buildDb = () => {
    const tx: any = {
      machine: { findFirst: jest.fn() },
      department: { findFirst: jest.fn() },
      productionLine: { findFirst: jest.fn() },
      maintenancePersonnel: { findUnique: jest.fn() },
      operationalPersonAssignment: { findFirst: jest.fn() },
      machineResponsibilityAssignment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    return tx
  }

  const buildAudit = () => ({ log: jest.fn().mockResolvedValue(undefined) })

  const assignment = (machine: any) => ({
    id: 'ra-1',
    scopeType: 'MACHINE',
    machineId: 'm-1',
    departmentId: null,
    productionLineId: null,
    machine,
    department: null,
    productionLine: null,
    maintenancePersonnel: { id: 'p-1', role: 'ENGINEER', specialty: null, operationalPerson: { id: 'op-1', code: 'OP1', name: 'Person', phone: null, email: null } },
  })

  it('scopes list through the owning machine and merges machineId filter inside scope', async () => {
    const db = buildDb()
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)
    await service.findAll({ machineId: 'm-1', status: 'ACTIVE' }, ctx)
    const where = db.machineResponsibilityAssignment.findMany.mock.calls[0][0].where
    expect(where.machine).toBeDefined()
    expect(where.machine.companyId).toBe('company-a')
  })

  it('rejects create with a foreign machine', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue(null)
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.create({ machineId: 'm-b', maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', startDate: '2026-01-01' } as any, userId, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.machineResponsibilityAssignment.create).not.toHaveBeenCalled()
  })

  it('rejects create with a missing maintenance personnel', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue({ id: 'm-1' })
    db.maintenancePersonnel.findUnique.mockResolvedValue(null)
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.create({ machineId: 'm-1', maintenancePersonnelId: 'p-b', responsibilityRole: 'ENGINEER', startDate: '2026-01-01' } as any, userId, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.machineResponsibilityAssignment.create).not.toHaveBeenCalled()
  })

  it('creates only after both references validate', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue({ id: 'm-1' })
    db.maintenancePersonnel.findUnique.mockResolvedValue({ id: 'p-1', operationalPersonId: 'op-1' })
    db.operationalPersonAssignment.findFirst.mockResolvedValue({ id: 'a-1' })
    db.machineResponsibilityAssignment.create.mockResolvedValue(assignment({ id: 'm-1' }))
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await service.create({ machineId: 'm-1', maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', startDate: '2026-01-01' } as any, userId, ctx)
    expect(db.machineResponsibilityAssignment.create).toHaveBeenCalled()
  })

  it('allows reading an in-context assignment and rejects foreign ones with 404', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique
      .mockResolvedValueOnce(assignment({ id: 'm-9', companyId: 'company-b', branchId: 'branch-b' }))
      .mockResolvedValueOnce(assignment({ id: 'm-1', companyId: 'company-a', branchId: 'branch-a' }))
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.findOne('ra-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.findOne('ra-1', ctx)).resolves.toMatchObject({ id: 'ra-1' })
  })

  it('rejects update of a foreign assignment before any write', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique.mockResolvedValue(assignment({ id: 'm-9', companyId: 'company-b', branchId: 'branch-b' }))
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.update('ra-1', { status: 'ACTIVE' } as any, userId, ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.machineResponsibilityAssignment.update).not.toHaveBeenCalled()
  })

  it('rejects tenant re-pointing: machineId change must stay in active context', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique.mockResolvedValue(assignment({ id: 'm-1', companyId: 'company-a', branchId: 'branch-a' }))
    db.machine.findFirst.mockResolvedValue(null)
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.update('ra-1', { machineId: 'm-b' } as any, userId, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.machineResponsibilityAssignment.update).not.toHaveBeenCalled()
  })

  it('rejects remove of a foreign assignment', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique.mockResolvedValue(assignment({ id: 'm-9', companyId: 'company-b', branchId: 'branch-b' }))
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.remove('ra-1', userId, ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.machineResponsibilityAssignment.update).not.toHaveBeenCalled()
  })

  it('rejects a DEPARTMENT responsibility whose department is in another branch of the same company', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique.mockResolvedValue({
      id: 'ra-1',
      scopeType: 'DEPARTMENT',
      machineId: null,
      departmentId: 'd-1',
      productionLineId: null,
      machine: null,
      department: { id: 'd-1', companyId: 'company-a', branchId: 'branch-c' },
      productionLine: null,
      maintenancePersonnel: { id: 'p-1', role: 'ENGINEER', specialty: null, operationalPerson: { id: 'op-1', code: 'OP1', name: 'Person', phone: null, email: null } },
    })
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.findOne('ra-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('asserts department ownership within the active branch at create', async () => {
    const db = buildDb()
    db.department.findFirst.mockResolvedValue(null)
    const service = new MachineResponsibilityAssignmentsService(db, buildAudit() as any)

    await expect(service.create({ scopeType: 'DEPARTMENT', departmentId: 'd-x', maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', startDate: '2026-01-01' } as any, userId, ctx)).rejects.toBeInstanceOf(BadRequestException)

    const call = db.department.findFirst.mock.calls[0][0]
    expect(call.where).toMatchObject({ id: 'd-x', companyId: 'company-a', branchId: 'branch-a' })
  })
})
