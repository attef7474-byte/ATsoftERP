import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMachineResponsibilityAssignmentDto, UpdateMachineResponsibilityAssignmentDto } from './dto/create-machine-responsibility-assignment.dto';

@Injectable()
export class MachineResponsibilityAssignmentsService {
  constructor(private prisma: PrismaService) {}

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private isMachineInScope(
    machine: { companyId?: string | null; branchId?: string | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async assertMachineOwned(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
    });
    if (!machine) throw new BadRequestException('Machine not found or not in the active company/branch');
    return machine;
  }

  private async assertPersonnelExists(maintenancePersonnelId: string) {
    const personnel = await this.prisma.maintenancePersonnel.findUnique({
      where: { id: maintenancePersonnelId },
    });
    if (!personnel) throw new BadRequestException('Maintenance personnel not found');
    return personnel;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const record = await this.prisma.machineResponsibilityAssignment.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true, location: true, companyId: true, branchId: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            specialty: true,
            operationalPerson: { select: { id: true, code: true, name: true, phone: true, email: true } },
          },
        },
      },
    });
    if (!record || !this.isMachineInScope(record.machine, ctx)) {
      throw new NotFoundException('Machine responsibility assignment not found');
    }
    return record;
  }

  async create(dto: CreateMachineResponsibilityAssignmentDto, ctx: ActiveOperationalContext) {
    await this.assertMachineOwned(dto.machineId, ctx);
    await this.assertPersonnelExists(dto.maintenancePersonnelId);
    const result = await this.prisma.machineResponsibilityAssignment.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    return this.mapAssignment(result);
  }

  async findAll(query: { page?: number; limit?: number; machineId?: string; maintenancePersonnelId?: string; responsibilityRole?: string; status?: string; isPrimary?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { machine: this.machineScope(ctx) };
    if (query.machineId) where.machine = { ...where.machine, id: query.machineId };
    if (query.maintenancePersonnelId) where.maintenancePersonnelId = query.maintenancePersonnelId;
    if (query.responsibilityRole) where.responsibilityRole = query.responsibilityRole;
    if (query.status) where.status = query.status;
    if (query.isPrimary !== undefined) where.isPrimary = query.isPrimary === 'true';

    const [data, total] = await Promise.all([
      this.prisma.machineResponsibilityAssignment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          maintenancePersonnel: {
            select: {
              id: true,
              role: true,
              operationalPerson: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.machineResponsibilityAssignment.count({ where }),
    ]);
    return { data: data.map(r => this.mapAssignment(r)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.mapAssignment(await this.findOwned(id, ctx));
  }

  async update(id: string, dto: UpdateMachineResponsibilityAssignmentDto, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    if (dto.machineId) await this.assertMachineOwned(dto.machineId, ctx);
    if (dto.maintenancePersonnelId) await this.assertPersonnelExists(dto.maintenancePersonnelId);
    const result = await this.prisma.machineResponsibilityAssignment.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : dto.endDate === null ? null : undefined,
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    return this.mapAssignment(result);
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    return this.prisma.machineResponsibilityAssignment.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  private mapAssignment(r: any) {
    return {
      ...r,
      maintenancePersonnel: {
        id: r.maintenancePersonnel.id,
        code: r.maintenancePersonnel.operationalPerson?.code ?? null,
        name: r.maintenancePersonnel.operationalPerson?.name ?? null,
        role: r.maintenancePersonnel.role,
        specialty: r.maintenancePersonnel.specialty,
        phone: r.maintenancePersonnel.operationalPerson?.phone ?? null,
        email: r.maintenancePersonnel.operationalPerson?.email ?? null,
      },
    };
  }
}
