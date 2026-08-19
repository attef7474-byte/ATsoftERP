import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMachineResponsibilityAssignmentDto, UpdateMachineResponsibilityAssignmentDto, SCOPE_TYPES } from './dto/create-machine-responsibility-assignment.dto';

@Injectable()
export class MachineResponsibilityAssignmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private async assertMachineOwned(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
    });
    if (!machine) throw new BadRequestException('Machine not found or not in the active company/branch');
    return machine;
  }

  private async assertDepartmentOwned(departmentId: string, ctx: ActiveOperationalContext) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!dept) throw new BadRequestException('Department not found or not in the active company');
    return dept;
  }

  private async assertProductionLineOwned(productionLineId: string, ctx: ActiveOperationalContext) {
    const line = await this.prisma.productionLine.findFirst({
      where: { id: productionLineId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!line) throw new BadRequestException('Production line not found or not in the active company');
    return line;
  }

  private async assertPersonnelHasValidAssignment(maintenancePersonnelId: string, ctx: ActiveOperationalContext) {
    const personnel = await this.prisma.maintenancePersonnel.findUnique({
      where: { id: maintenancePersonnelId },
      include: { operationalPerson: { select: { id: true } } },
    });
    if (!personnel) throw new BadRequestException('Maintenance personnel not found');

    const hasValidAssignment = await this.prisma.operationalPersonAssignment.findFirst({
      where: {
        personnelId: personnel.operationalPersonId,
        companyId: ctx.companyId,
        effectiveTo: null,
        deletedAt: null,
      },
    });
    if (!hasValidAssignment) {
      throw new BadRequestException('Maintenance person does not have a valid current assignment compatible with the active company/branch');
    }
    return personnel;
  }

  private assertExactlyOneTarget(dto: CreateMachineResponsibilityAssignmentDto | UpdateMachineResponsibilityAssignmentDto, existing?: any) {
    const scopeType = dto.scopeType ?? existing?.scopeType ?? 'MACHINE';
    const machineId = dto.machineId !== undefined ? dto.machineId : existing?.machineId;
    const departmentId = dto.departmentId !== undefined ? dto.departmentId : existing?.departmentId;
    const productionLineId = dto.productionLineId !== undefined ? dto.productionLineId : existing?.productionLineId;

    switch (scopeType) {
      case 'MACHINE':
        if (!machineId) throw new BadRequestException('machineId is required when scopeType is MACHINE');
        if (departmentId) throw new BadRequestException('departmentId must be null when scopeType is MACHINE');
        if (productionLineId) throw new BadRequestException('productionLineId must be null when scopeType is MACHINE');
        break;
      case 'PRODUCTION_LINE':
        if (!productionLineId) throw new BadRequestException('productionLineId is required when scopeType is PRODUCTION_LINE');
        if (machineId) throw new BadRequestException('machineId must be null when scopeType is PRODUCTION_LINE');
        if (departmentId) throw new BadRequestException('departmentId must be null when scopeType is PRODUCTION_LINE');
        break;
      case 'DEPARTMENT':
        if (!departmentId) throw new BadRequestException('departmentId is required when scopeType is DEPARTMENT');
        if (machineId) throw new BadRequestException('machineId must be null when scopeType is DEPARTMENT');
        if (productionLineId) throw new BadRequestException('productionLineId must be null when scopeType is DEPARTMENT');
        break;
      default:
        throw new BadRequestException(`Invalid scopeType: ${scopeType}. Must be one of: ${SCOPE_TYPES.join(', ')}`);
    }
  }

  private async assertNoDuplicatePrimaryForScopeTarget(
    scopeType: string,
    targetId: string,
    excludeId: string | undefined,
    ctx: ActiveOperationalContext,
  ) {
    const now = new Date();
    const where: any = {
      scopeType,
      isPrimary: true,
      status: 'ACTIVE',
      OR: [{ endDate: null }, { endDate: { gt: now } }],
    };

    if (scopeType === 'MACHINE') where.machineId = targetId;
    else if (scopeType === 'DEPARTMENT') where.departmentId = targetId;
    else if (scopeType === 'PRODUCTION_LINE') where.productionLineId = targetId;

    if (excludeId) where.id = { not: excludeId };

    const existing = await this.prisma.machineResponsibilityAssignment.findFirst({ where });
    if (existing) {
      throw new BadRequestException(`Duplicate active PRIMARY responsibility already exists for this ${scopeType.toLowerCase()} scope target`);
    }
  }

  private async validateScopeTargetOwnership(scopeType: string, dto: CreateMachineResponsibilityAssignmentDto | UpdateMachineResponsibilityAssignmentDto, ctx: ActiveOperationalContext) {
    switch (scopeType) {
      case 'MACHINE':
        if (dto.machineId) await this.assertMachineOwned(dto.machineId, ctx);
        break;
      case 'DEPARTMENT':
        if (dto.departmentId) await this.assertDepartmentOwned(dto.departmentId, ctx);
        break;
      case 'PRODUCTION_LINE':
        if (dto.productionLineId) await this.assertProductionLineOwned(dto.productionLineId, ctx);
        break;
    }
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const record = await this.prisma.machineResponsibilityAssignment.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true, location: true, companyId: true, branchId: true } },
        department: { select: { id: true, code: true, name: true, companyId: true } },
        productionLine: { select: { id: true, code: true, name: true, companyId: true } },
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
    if (!record) throw new NotFoundException('Machine responsibility assignment not found');

    if (record.scopeType === 'MACHINE' && record.machine) {
      if (record.machine.companyId !== ctx.companyId) throw new NotFoundException('Machine responsibility assignment not found');
    } else if (record.scopeType === 'DEPARTMENT' && record.department) {
      if (record.department.companyId !== ctx.companyId) throw new NotFoundException('Machine responsibility assignment not found');
    } else if (record.scopeType === 'PRODUCTION_LINE' && record.productionLine) {
      if (record.productionLine.companyId !== ctx.companyId) throw new NotFoundException('Machine responsibility assignment not found');
    }

    return record;
  }

  async create(dto: CreateMachineResponsibilityAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const scopeType = dto.scopeType ?? 'MACHINE';
    this.assertExactlyOneTarget({ ...dto, scopeType });
    await this.validateScopeTargetOwnership(scopeType, dto, ctx);
    await this.assertPersonnelHasValidAssignment(dto.maintenancePersonnelId, ctx);

    if (dto.isPrimary) {
      const targetId = scopeType === 'MACHINE' ? dto.machineId! : scopeType === 'DEPARTMENT' ? dto.departmentId! : dto.productionLineId!;
      await this.assertNoDuplicatePrimaryForScopeTarget(scopeType, targetId, undefined, ctx);
    }

    const result = await this.prisma.machineResponsibilityAssignment.create({
      data: {
        scopeType,
        machineId: dto.machineId ?? null,
        departmentId: dto.departmentId ?? null,
        productionLineId: dto.productionLineId ?? null,
        maintenancePersonnelId: dto.maintenancePersonnelId,
        responsibilityRole: dto.responsibilityRole,
        isPrimary: dto.isPrimary ?? false,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes ?? null,
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        productionLine: { select: { id: true, code: true, name: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'MachineResponsibilityAssignment',
      entityId: result.id,
      details: JSON.stringify({ companyId: ctx.companyId, scopeType, machineId: dto.machineId, departmentId: dto.departmentId, productionLineId: dto.productionLineId }),
    });

    return this.mapAssignment(result);
  }

  async findAll(query: { page?: number; limit?: number; machineId?: string; maintenancePersonnelId?: string; responsibilityRole?: string; status?: string; isPrimary?: string; scopeType?: string; departmentId?: string; productionLineId?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};

    if (query.scopeType) where.scopeType = query.scopeType;
    if (query.machineId) where.machineId = query.machineId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.maintenancePersonnelId) where.maintenancePersonnelId = query.maintenancePersonnelId;
    if (query.responsibilityRole) where.responsibilityRole = query.responsibilityRole;
    if (query.status) where.status = query.status;
    if (query.isPrimary !== undefined) where.isPrimary = query.isPrimary === 'true';

    if (query.machineId) {
      where.machine = this.machineScope(ctx);
    } else if (query.departmentId) {
      where.department = { companyId: ctx.companyId };
    } else if (query.productionLineId) {
      where.productionLine = { companyId: ctx.companyId };
    } else {
      where.OR = [
        { machine: this.machineScope(ctx) },
        { department: { companyId: ctx.companyId } },
        { productionLine: { companyId: ctx.companyId } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.machineResponsibilityAssignment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          productionLine: { select: { id: true, code: true, name: true } },
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

  async update(id: string, dto: UpdateMachineResponsibilityAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwned(id, ctx);

    const mergedScopeType = dto.scopeType ?? existing.scopeType;
    const mergedDto = { ...dto, scopeType: mergedScopeType };
    this.assertExactlyOneTarget(mergedDto, existing);
    await this.validateScopeTargetOwnership(mergedScopeType, mergedDto, ctx);

    if (dto.maintenancePersonnelId) {
      await this.assertPersonnelHasValidAssignment(dto.maintenancePersonnelId, ctx);
    }

    if (dto.isPrimary) {
      const targetId = mergedScopeType === 'MACHINE'
        ? (dto.machineId ?? existing.machineId)
        : mergedScopeType === 'DEPARTMENT'
          ? (dto.departmentId ?? existing.departmentId)
          : (dto.productionLineId ?? existing.productionLineId);
      if (targetId) {
        await this.assertNoDuplicatePrimaryForScopeTarget(mergedScopeType, targetId, id, ctx);
      }
    }

    const updateData: any = {};
    if (dto.scopeType !== undefined) updateData.scopeType = dto.scopeType;
    if (dto.machineId !== undefined) updateData.machineId = dto.machineId;
    if (dto.departmentId !== undefined) updateData.departmentId = dto.departmentId;
    if (dto.productionLineId !== undefined) updateData.productionLineId = dto.productionLineId;
    if (dto.maintenancePersonnelId !== undefined) updateData.maintenancePersonnelId = dto.maintenancePersonnelId;
    if (dto.responsibilityRole !== undefined) updateData.responsibilityRole = dto.responsibilityRole;
    if (dto.isPrimary !== undefined) updateData.isPrimary = dto.isPrimary;
    if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const result = await this.prisma.machineResponsibilityAssignment.update({
      where: { id },
      data: updateData,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        productionLine: { select: { id: true, code: true, name: true } },
        maintenancePersonnel: {
          select: {
            id: true,
            role: true,
            operationalPerson: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'MachineResponsibilityAssignment',
      entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId, changes: Object.keys(updateData) }),
    });

    return this.mapAssignment(result);
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const result = await this.prisma.machineResponsibilityAssignment.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'MachineResponsibilityAssignment',
      entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId }),
    });

    return result;
  }

  private mapAssignment(r: any) {
    return {
      ...r,
      machine: r.machine ? { id: r.machine.id, code: r.machine.code, name: r.machine.name } : null,
      department: r.department ? { id: r.department.id, code: r.department.code, name: r.department.name } : null,
      productionLine: r.productionLine ? { id: r.productionLine.id, code: r.productionLine.code, name: r.productionLine.name } : null,
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
