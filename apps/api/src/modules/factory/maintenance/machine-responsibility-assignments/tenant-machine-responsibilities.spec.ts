import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MachineResponsibilityAssignmentsService } from './machine-responsibility-assignments.service'

describe('machine-responsibility-assignments tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      machine: { findFirst: jest.fn() },
      maintenancePersonnel: { findUnique: jest.fn() },
      machineResponsibilityAssignment: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    return tx
  }

  const assignment = (machine: any) => ({
    id: 'ra-1',
    machine,
    maintenancePersonnel: { id: 'p-1', role: 'ENGINEER', specialty: null, operationalPerson: { id: 'op-1', code: 'OP1', name: 'Person', phone: null, email: null } },
  })

  it('scopes list through the owning machine and merges machineId filter inside scope', async () => {
    const db = buildDb()
    const service = new MachineResponsibilityAssignmentsService(db)
    await service.findAll({ machineId: 'm-1', status: 'ACTIVE' }, ctx)
    expect(db.machineResponsibilityAssignment.findMany.mock.calls[0][0].where).toEqual({
      machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }], id: 'm-1' },
      status: 'ACTIVE',
    })
  })

  it('rejects create with a foreign machine', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue(null)
    const service = new MachineResponsibilityAssignmentsService(db)

    await expect(service.create({ machineId: 'm-b', maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', startDate: '2026-01-01' } as any, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.machineResponsibilityAssignment.create).not.toHaveBeenCalled()
  })

  it('rejects create with a missing maintenance personnel', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue({ id: 'm-1' })
    db.maintenancePersonnel.findUnique.mockResolvedValue(null)
    const service = new MachineResponsibilityAssignmentsService(db)

    await expect(service.create({ machineId: 'm-1', maintenancePersonnelId: 'p-b', responsibilityRole: 'ENGINEER', startDate: '2026-01-01' } as any, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.machineResponsibilityAssignment.create).not.toHaveBeenCalled()
  })

  it('creates only after both references validate', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue({ id: 'm-1' })
    db.maintenancePersonnel.findUnique.mockResolvedValue({ id: 'p-1' })
    db.machineResponsibilityAssignment.create.mockResolvedValue(assignment({ id: 'm-1' }))
    const service = new MachineResponsibilityAssignmentsService(db)

    await service.create({ machineId: 'm-1', maintenancePersonnelId: 'p-1', responsibilityRole: 'ENGINEER', startDate: '2026-01-01' } as any, ctx)
    expect(db.machineResponsibilityAssignment.create).toHaveBeenCalled()
  })

  it('allows reading an in-context assignment and rejects foreign ones with 404', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique
      .mockResolvedValueOnce(assignment({ id: 'm-9', companyId: 'company-b', branchId: 'branch-b' }))
      .mockResolvedValueOnce(assignment({ id: 'm-1', companyId: 'company-a', branchId: 'branch-a' }))
    const service = new MachineResponsibilityAssignmentsService(db)

    await expect(service.findOne('ra-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.findOne('ra-1', ctx)).resolves.toMatchObject({ id: 'ra-1' })
  })

  it('rejects update of a foreign assignment before any write', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique.mockResolvedValue(assignment({ id: 'm-9', companyId: 'company-b', branchId: 'branch-b' }))
    const service = new MachineResponsibilityAssignmentsService(db)

    await expect(service.update('ra-1', { status: 'ACTIVE' } as any, ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.machineResponsibilityAssignment.update).not.toHaveBeenCalled()
  })

  it('rejects tenant re-pointing: machineId change must stay in active context', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique.mockResolvedValue(assignment({ id: 'm-1', companyId: 'company-a', branchId: 'branch-a' }))
    db.machine.findFirst.mockResolvedValue(null)
    const service = new MachineResponsibilityAssignmentsService(db)

    await expect(service.update('ra-1', { machineId: 'm-b' } as any, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.machineResponsibilityAssignment.update).not.toHaveBeenCalled()
  })

  it('rejects remove of a foreign assignment', async () => {
    const db = buildDb()
    db.machineResponsibilityAssignment.findUnique.mockResolvedValue(assignment({ id: 'm-9', companyId: 'company-b', branchId: 'branch-b' }))
    const service = new MachineResponsibilityAssignmentsService(db)

    await expect(service.remove('ra-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.machineResponsibilityAssignment.update).not.toHaveBeenCalled()
  })
})
