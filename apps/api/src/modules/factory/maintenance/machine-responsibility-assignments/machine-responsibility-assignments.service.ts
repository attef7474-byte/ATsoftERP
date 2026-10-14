import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMachineResponsibilityAssignmentDto, UpdateMachineResponsibilityAssignmentDto, CreateMachineResponsibilityBatchDto, UpdateMachineResponsibilityBatchDto, EndMachineResponsibilityAssignmentDto, SCOPE_TYPES } from './dto/create-machine-responsibility-assignment.dto';

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

  private tenancyOr(ctx: ActiveOperationalContext) {
    return {
      OR: [
        { machine: this.machineScope(ctx) },
        { department: { companyId: ctx.companyId, branchId: ctx.branchId } },
        { productionLine: { companyId: ctx.companyId, branchId: ctx.branchId } },
      ],
    };
  }

  private dedupe(ids?: string[]): string[] {
    return Array.from(new Set((ids ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)));
  }

  private targetKey(type: 'LINE' | 'MACHINE' | 'DEPARTMENT', id: string): string {
    return `${type}:${id}`;
  }

  private async assertMachineOwned(machineId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const machine = await client.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
    });
    if (!machine) throw new BadRequestException('Machine not found or not in the active company/branch');
    return machine;
  }

  private async assertDepartmentOwned(departmentId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const dept = await client.department.findFirst({
      where: { id: departmentId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!dept) throw new BadRequestException('Department not found or not in the active company/branch');
    return dept;
  }

  private async assertProductionLineOwned(productionLineId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const line = await client.productionLine.findFirst({
      where: { id: productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!line) throw new BadRequestException('Production line not found or not in the active company/branch');
    return line;
  }

  private async assertPersonnelHasValidAssignment(maintenancePersonnelId: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const personnel = await client.maintenancePersonnel.findUnique({
      where: { id: maintenancePersonnelId },
      include: { operationalPerson: { select: { id: true } } },
    });
    if (!personnel) throw new BadRequestException('Maintenance personnel not found');

    const hasValidAssignment = await client.operationalPersonAssignment.findFirst({
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
    client: any = this.prisma,
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

    const existing = await client.machineResponsibilityAssignment.findFirst({ where });
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
        department: { select: { id: true, code: true, name: true, companyId: true, branchId: true } },
        productionLine: { select: { id: true, code: true, name: true, companyId: true, branchId: true } },
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
      if (record.department.companyId !== ctx.companyId || record.department.branchId !== ctx.branchId) throw new NotFoundException('Machine responsibility assignment not found');
    } else if (record.scopeType === 'PRODUCTION_LINE' && record.productionLine) {
      if (record.productionLine.companyId !== ctx.companyId || record.productionLine.branchId !== ctx.branchId) throw new NotFoundException('Machine responsibility assignment not found');
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
      where.department = { companyId: ctx.companyId, branchId: ctx.branchId };
    } else if (query.productionLineId) {
      where.productionLine = { companyId: ctx.companyId, branchId: ctx.branchId };
    } else {
      where.OR = [
        { machine: this.machineScope(ctx) },
        { department: { companyId: ctx.companyId, branchId: ctx.branchId } },
        { productionLine: { companyId: ctx.companyId, branchId: ctx.branchId } },
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

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-scope (multi-line + multi-machine) logical assignment support.
  // A logical assignment = the active row set for (maintenancePersonnelId,
  // responsibilityRole). Full-line coverage is a LIVE relation over
  // Machine.productionLineId (dynamic inheritance, never a snapshot).
  // MIGRATION = NONE: one canonical single-target row per line / explicit machine.
  // ─────────────────────────────────────────────────────────────────────────

  private assertDateRange(startDate: Date, endDate: Date | null) {
    if (Number.isNaN(startDate.getTime())) throw new BadRequestException('startDate is invalid');
    if (endDate) {
      if (Number.isNaN(endDate.getTime())) throw new BadRequestException('endDate is invalid');
      if (endDate.getTime() < startDate.getTime()) throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  private rowTargetKey(r: any): string {
    if (r.scopeType === 'PRODUCTION_LINE') return this.targetKey('LINE', r.productionLineId);
    if (r.scopeType === 'MACHINE') return this.targetKey('MACHINE', r.machineId);
    return this.targetKey('DEPARTMENT', r.departmentId);
  }

  private async resolveDesiredTargets(
    client: any,
    input: { fullLineIds?: string[]; explicitMachineIds?: string[] },
    ctx: ActiveOperationalContext,
  ) {
    const lineIds = this.dedupe(input.fullLineIds);
    const explicitIds = this.dedupe(input.explicitMachineIds);

    const lines = lineIds.length
      ? await client.productionLine.findMany({
          where: { id: { in: lineIds }, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          select: { id: true, code: true, name: true },
        })
      : [];
    if (lines.length !== lineIds.length) {
      throw new BadRequestException('One or more production lines were not found or are not in the active company/branch');
    }
    const lineById = new Map<string, any>(lines.map((l: any) => [l.id, l]));

    const inherited = lineIds.length
      ? await client.machine.findMany({
          where: { productionLineId: { in: lineIds }, ...this.machineScope(ctx), deletedAt: null },
          select: { id: true, code: true, name: true, productionLineId: true },
        })
      : [];
    const inheritedIds = new Set<string>(inherited.map((m: any) => m.id));

    const redundantExplicitMachines: any[] = [];
    const explicitToPersistIds: string[] = [];
    for (const id of explicitIds) {
      if (inheritedIds.has(id)) {
        const m = inherited.find((x: any) => x.id === id)!;
        redundantExplicitMachines.push({
          machineId: id,
          coveredByLineId: m.productionLineId ?? null,
          coveredByLineCode: m.productionLineId ? (lineById.get(m.productionLineId)?.code ?? null) : null,
        });
      } else {
        explicitToPersistIds.push(id);
      }
    }

    const explicitMachines = explicitToPersistIds.length
      ? await client.machine.findMany({
          where: { id: { in: explicitToPersistIds }, ...this.machineScope(ctx), deletedAt: null },
          select: { id: true, code: true, name: true },
        })
      : [];
    if (explicitMachines.length !== explicitToPersistIds.length) {
      throw new BadRequestException('One or more machines were not found or are not in the active company/branch');
    }

    const inheritedMachines = inherited.map((m: any) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      productionLineId: m.productionLineId,
      lineCode: m.productionLineId ? (lineById.get(m.productionLineId)?.code ?? null) : null,
    }));

    const effectiveMachines = [
      ...inheritedMachines.map((m: any) => ({ id: m.id, code: m.code, name: m.name, source: 'INHERITED' as const, lineId: m.productionLineId, lineCode: m.lineCode })),
      ...explicitMachines.map((m: any) => ({ id: m.id, code: m.code, name: m.name, source: 'EXPLICIT' as const, lineId: null, lineCode: null })),
    ];

    return { lines, inheritedMachines, explicitMachines, redundantExplicitMachines, effectiveMachines };
  }

  private async getActiveRows(client: any, maintenancePersonnelId: string, responsibilityRole: string, ctx: ActiveOperationalContext) {
    const now = new Date();
    return client.machineResponsibilityAssignment.findMany({
      where: {
        maintenancePersonnelId,
        responsibilityRole,
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gt: now } }],
        AND: [this.tenancyOr(ctx)],
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        productionLine: { select: { id: true, code: true, name: true } },
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
  }

  private buildBatchSummary(personnelId: string, role: string, dto: any, desired: any, added: any[], removed: any[], skipped: any[]) {
    return {
      maintenancePersonnelId: personnelId,
      responsibilityRole: role,
      isPrimary: dto.isPrimary ?? false,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      notes: dto.notes ?? null,
      fullLines: desired.lines,
      inheritedMachines: desired.inheritedMachines,
      explicitMachines: desired.explicitMachines.map((m: any) => ({ id: m.id, code: m.code, name: m.name })),
      effectiveMachines: desired.effectiveMachines,
      redundantExplicitMachines: desired.redundantExplicitMachines,
      addedTargets: added,
      removedTargets: removed,
      skippedExistingTargets: skipped,
      counts: {
        fullLines: desired.lines.length,
        inheritedMachines: desired.inheritedMachines.length,
        explicitMachines: desired.explicitMachines.length,
        effectiveMachines: desired.effectiveMachines.length,
        added: added.length,
        removed: removed.length,
        skippedExisting: skipped.length,
        redundantExplicitMachines: desired.redundantExplicitMachines.length,
      },
    };
  }

  async createBatch(dto: CreateMachineResponsibilityBatchDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertPersonnelHasValidAssignment(dto.maintenancePersonnelId, ctx, tx);
      const desired = await this.resolveDesiredTargets(tx, dto, ctx);
      if (desired.lines.length + desired.explicitMachines.length === 0) {
        throw new BadRequestException('At least one production line or machine must be selected');
      }

      const startDate = new Date(dto.startDate);
      const endDate = dto.endDate ? new Date(dto.endDate) : null;
      this.assertDateRange(startDate, endDate);

      const existing = await this.getActiveRows(tx, dto.maintenancePersonnelId, dto.responsibilityRole, ctx);
      const existingKeys = new Set<string>(existing.map((r: any) => this.rowTargetKey(r)));

      const addedTargets: any[] = [];
      const skippedExistingTargets: any[] = [];

      for (const line of desired.lines) {
        const key = this.targetKey('LINE', line.id);
        if (existingKeys.has(key)) {
          skippedExistingTargets.push({ type: 'LINE', id: line.id, code: line.code });
          continue;
        }
        if (dto.isPrimary) await this.assertNoDuplicatePrimaryForScopeTarget('PRODUCTION_LINE', line.id, undefined, ctx, tx);
        await tx.machineResponsibilityAssignment.create({
          data: {
            scopeType: 'PRODUCTION_LINE', productionLineId: line.id, machineId: null, departmentId: null,
            maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole,
            isPrimary: dto.isPrimary ?? false, startDate, endDate, status: 'ACTIVE', notes: dto.notes ?? null,
          },
        });
        addedTargets.push({ type: 'LINE', id: line.id, code: line.code });
      }

      for (const m of desired.explicitMachines) {
        const key = this.targetKey('MACHINE', m.id);
        if (existingKeys.has(key)) {
          skippedExistingTargets.push({ type: 'MACHINE', id: m.id, code: m.code });
          continue;
        }
        if (dto.isPrimary) await this.assertNoDuplicatePrimaryForScopeTarget('MACHINE', m.id, undefined, ctx, tx);
        await tx.machineResponsibilityAssignment.create({
          data: {
            scopeType: 'MACHINE', machineId: m.id, productionLineId: null, departmentId: null,
            maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole,
            isPrimary: dto.isPrimary ?? false, startDate, endDate, status: 'ACTIVE', notes: dto.notes ?? null,
          },
        });
        addedTargets.push({ type: 'MACHINE', id: m.id, code: m.code });
      }

      await this.auditService.log({
        userId,
        action: 'CREATE',
        entity: 'MachineResponsibilityAssignment',
        entityId: `${dto.maintenancePersonnelId}:${dto.responsibilityRole}`,
        details: JSON.stringify({
          companyId: ctx.companyId, mode: 'BATCH_CREATE',
          maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole,
          fullLineIds: desired.lines.map((l: any) => l.id), explicitMachineIds: desired.explicitMachines.map((m: any) => m.id),
          effectiveMachineIds: desired.effectiveMachines.map((m: any) => m.id),
          added: addedTargets, skippedExisting: skippedExistingTargets, redundantExplicitMachines: desired.redundantExplicitMachines,
        }),
      });

      return this.buildBatchSummary(dto.maintenancePersonnelId, dto.responsibilityRole, dto, desired, addedTargets, [], skippedExistingTargets);
    });
  }

  async updateBatch(dto: UpdateMachineResponsibilityBatchDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertPersonnelHasValidAssignment(dto.maintenancePersonnelId, ctx, tx);
      const desired = await this.resolveDesiredTargets(tx, dto, ctx);
      if (desired.lines.length + desired.explicitMachines.length === 0) {
        throw new BadRequestException('At least one production line or machine must be selected');
      }

      // DEPARTMENT-scoped responsibilities are unrelated to line/machine multi-scope editing and must be preserved.
      const existing = (await this.getActiveRows(tx, dto.maintenancePersonnelId, dto.responsibilityRole, ctx))
        .filter((r: any) => r.scopeType !== 'DEPARTMENT');
      const existingByKey = new Map<string, any>(existing.map((r: any) => [this.rowTargetKey(r), r]));

      const desiredKeys = new Set<string>([
        ...desired.lines.map((l: any) => this.targetKey('LINE', l.id)),
        ...desired.explicitMachines.map((m: any) => this.targetKey('MACHINE', m.id)),
      ]);

      const startDate = dto.startDate !== undefined ? new Date(dto.startDate) : undefined;
      const endDate = dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined;
      if (startDate) this.assertDateRange(startDate, endDate ?? null);

      const keptRows = existing.filter((r: any) => desiredKeys.has(this.rowTargetKey(r)));
      const removedRows = existing.filter((r: any) => !desiredKeys.has(this.rowTargetKey(r)));

      for (const row of keptRows) {
        const data: any = {};
        if (startDate !== undefined) data.startDate = startDate;
        if (endDate !== undefined) data.endDate = endDate;
        if (dto.notes !== undefined) data.notes = dto.notes;
        if (dto.isPrimary !== undefined) {
          if (dto.isPrimary) {
            const targetId = row.scopeType === 'PRODUCTION_LINE' ? row.productionLineId : row.machineId;
            await this.assertNoDuplicatePrimaryForScopeTarget(row.scopeType, targetId, row.id, ctx, tx);
          }
          data.isPrimary = dto.isPrimary;
        }
        if (Object.keys(data).length) {
          await tx.machineResponsibilityAssignment.update({ where: { id: row.id }, data });
        }
      }

      for (const row of removedRows) {
        await tx.machineResponsibilityAssignment.update({
          where: { id: row.id },
          data: { status: 'INACTIVE', endDate: row.endDate ?? new Date() },
        });
      }

      const addedTargets: any[] = [];
      const effStart = startDate ?? new Date();
      const effEnd = endDate !== undefined ? endDate : null;

      for (const line of desired.lines) {
        const key = this.targetKey('LINE', line.id);
        if (existingByKey.has(key)) continue;
        if (dto.isPrimary) await this.assertNoDuplicatePrimaryForScopeTarget('PRODUCTION_LINE', line.id, undefined, ctx, tx);
        await tx.machineResponsibilityAssignment.create({
          data: {
            scopeType: 'PRODUCTION_LINE', productionLineId: line.id, machineId: null, departmentId: null,
            maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole,
            isPrimary: dto.isPrimary ?? false, startDate: effStart, endDate: effEnd, status: 'ACTIVE', notes: dto.notes ?? null,
          },
        });
        addedTargets.push({ type: 'LINE', id: line.id, code: line.code });
      }

      for (const m of desired.explicitMachines) {
        const key = this.targetKey('MACHINE', m.id);
        if (existingByKey.has(key)) continue;
        if (dto.isPrimary) await this.assertNoDuplicatePrimaryForScopeTarget('MACHINE', m.id, undefined, ctx, tx);
        await tx.machineResponsibilityAssignment.create({
          data: {
            scopeType: 'MACHINE', machineId: m.id, productionLineId: null, departmentId: null,
            maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole,
            isPrimary: dto.isPrimary ?? false, startDate: effStart, endDate: effEnd, status: 'ACTIVE', notes: dto.notes ?? null,
          },
        });
        addedTargets.push({ type: 'MACHINE', id: m.id, code: m.code });
      }

      await this.auditService.log({
        userId,
        action: 'UPDATE',
        entity: 'MachineResponsibilityAssignment',
        entityId: `${dto.maintenancePersonnelId}:${dto.responsibilityRole}`,
        details: JSON.stringify({
          companyId: ctx.companyId, mode: 'BATCH_UPDATE',
          maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole,
          fullLineIds: desired.lines.map((l: any) => l.id), explicitMachineIds: desired.explicitMachines.map((m: any) => m.id),
          added: addedTargets,
          removed: removedRows.map((r: any) => ({ id: r.id, scopeType: r.scopeType, machineId: r.machineId, productionLineId: r.productionLineId })),
          redundantExplicitMachines: desired.redundantExplicitMachines,
        }),
      });

      return this.buildBatchSummary(
        dto.maintenancePersonnelId,
        dto.responsibilityRole,
        { ...dto, startDate: startDate ? startDate.toISOString() : undefined, endDate: endDate ? endDate.toISOString() : undefined },
        desired,
        addedTargets,
        removedRows.map((r: any) => ({ id: r.id, scopeType: r.scopeType })),
        [],
      );
    });
  }

  async endAssignment(dto: EndMachineResponsibilityAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await this.getActiveRows(tx, dto.maintenancePersonnelId, dto.responsibilityRole, ctx);
      const now = new Date();
      for (const r of rows) {
        await tx.machineResponsibilityAssignment.update({
          where: { id: r.id },
          data: { status: 'INACTIVE', endDate: r.endDate ?? now },
        });
      }

      await this.auditService.log({
        userId,
        action: 'DELETE',
        entity: 'MachineResponsibilityAssignment',
        entityId: `${dto.maintenancePersonnelId}:${dto.responsibilityRole}`,
        details: JSON.stringify({
          companyId: ctx.companyId, mode: 'BATCH_END',
          maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole,
          ended: rows.map((r: any) => r.id),
        }),
      });

      return { maintenancePersonnelId: dto.maintenancePersonnelId, responsibilityRole: dto.responsibilityRole, ended: rows.length };
    });
  }

  async getCoverage(maintenancePersonnelId: string, responsibilityRole: string, ctx: ActiveOperationalContext) {
    if (!maintenancePersonnelId || !responsibilityRole) {
      throw new BadRequestException('maintenancePersonnelId and responsibilityRole are required');
    }
    const rows = await this.getActiveRows(this.prisma, maintenancePersonnelId, responsibilityRole, ctx);
    await this.assertPersonnelHasValidAssignment(maintenancePersonnelId, ctx);

    const lineRows = rows.filter((r: any) => r.scopeType === 'PRODUCTION_LINE' && r.productionLine);
    const explicitRows = rows.filter((r: any) => r.scopeType === 'MACHINE' && r.machine);
    const lineIds = lineRows.map((r: any) => r.productionLineId);

    const inherited = lineIds.length
      ? await this.prisma.machine.findMany({
          where: { productionLineId: { in: lineIds }, ...this.machineScope(ctx), deletedAt: null },
          select: { id: true, code: true, name: true, productionLineId: true },
        })
      : [];
    const lineById = new Map<string, any>(lineRows.map((r: any) => [r.productionLineId, r.productionLine]));
    const inheritedMachines = inherited.map((m: any) => ({
      id: m.id, code: m.code, name: m.name, productionLineId: m.productionLineId,
      lineCode: m.productionLineId ? (lineById.get(m.productionLineId)?.code ?? null) : null,
    }));
    const inheritedSet = new Set<string>(inherited.map((m: any) => m.id));
    const explicitMachines = explicitRows.map((r: any) => ({
      id: r.machine.id, code: r.machine.code, name: r.machine.name, coveredByLine: inheritedSet.has(r.machine.id),
    }));

    const effectiveMap = new Map<string, any>();
    for (const m of inheritedMachines) effectiveMap.set(m.id, { id: m.id, code: m.code, name: m.name, source: 'INHERITED', lineId: m.productionLineId, lineCode: m.lineCode });
    for (const m of explicitMachines) if (!effectiveMap.has(m.id)) effectiveMap.set(m.id, { id: m.id, code: m.code, name: m.name, source: 'EXPLICIT', lineId: null, lineCode: null });
    const effectiveMachines = [...effectiveMap.values()];

    return {
      maintenancePersonnelId,
      responsibilityRole,
      fullLines: lineRows.map((r: any) => ({ id: r.productionLine.id, code: r.productionLine.code, name: r.productionLine.name })),
      inheritedMachines,
      explicitMachines,
      effectiveMachines,
      counts: {
        fullLines: lineRows.length,
        inheritedMachines: inheritedMachines.length,
        explicitMachines: explicitMachines.length,
        effectiveMachines: effectiveMachines.length,
      },
    };
  }

  async findGrouped(
    query: { page?: number; limit?: number; search?: string; status?: string; responsibilityRole?: string; maintenancePersonnelId?: string },
    ctx: ActiveOperationalContext,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.responsibilityRole) where.responsibilityRole = query.responsibilityRole;
    if (query.maintenancePersonnelId) where.maintenancePersonnelId = query.maintenancePersonnelId;
    const and: any[] = [this.tenancyOr(ctx)];
    const q = (query.search ?? '').trim();
    if (q) {
      and.push({
        OR: [
          { responsibilityRole: { contains: q } },
          { maintenancePersonnel: { operationalPerson: { OR: [{ name: { contains: q } }, { code: { contains: q } }] } } },
          { productionLine: { OR: [{ name: { contains: q } }, { code: { contains: q } }] } },
          { machine: { OR: [{ name: { contains: q } }, { code: { contains: q } }] } },
        ],
      });
    }
    where.AND = and;

    const rows = await this.prisma.machineResponsibilityAssignment.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 2000,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        productionLine: { select: { id: true, code: true, name: true } },
        maintenancePersonnel: {
          select: {
            id: true, role: true, specialty: true,
            operationalPerson: { select: { id: true, code: true, name: true, phone: true, email: true } },
          },
        },
      },
    });

    const groups = new Map<string, any>();
    for (const r of rows) {
      const key = `${r.maintenancePersonnelId}::${r.responsibilityRole}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          maintenancePersonnelId: r.maintenancePersonnelId,
          responsibilityRole: r.responsibilityRole,
          isPrimary: false,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          notes: r.notes,
          updatedAt: r.updatedAt,
          personnel: r.maintenancePersonnel
            ? {
                id: r.maintenancePersonnel.id,
                code: r.maintenancePersonnel.operationalPerson?.code ?? null,
                name: r.maintenancePersonnel.operationalPerson?.name ?? null,
                role: r.maintenancePersonnel.role,
                specialty: r.maintenancePersonnel.specialty,
                phone: r.maintenancePersonnel.operationalPerson?.phone ?? null,
                email: r.maintenancePersonnel.operationalPerson?.email ?? null,
              }
            : null,
          rows: [],
        };
        groups.set(key, g);
      }
      g.rows.push(r);
      if (r.isPrimary) g.isPrimary = true;
    }

    const allLineIds = this.dedupe(rows.filter((r: any) => r.scopeType === 'PRODUCTION_LINE' && r.productionLineId).map((r: any) => r.productionLineId));
    const machines = allLineIds.length
      ? await this.prisma.machine.findMany({
          where: { productionLineId: { in: allLineIds }, ...this.machineScope(ctx), deletedAt: null },
          select: { id: true, code: true, name: true, productionLineId: true },
        })
      : [];
    const machinesByLine = new Map<string, any[]>();
    for (const m of machines) {
      const lineKey = m.productionLineId as string;
      const arr = machinesByLine.get(lineKey) ?? [];
      arr.push(m);
      machinesByLine.set(lineKey, arr);
    }

    const list: any[] = [];
    for (const g of groups.values()) {
      const lineRows = g.rows.filter((r: any) => r.scopeType === 'PRODUCTION_LINE' && r.productionLine);
      const machineRows = g.rows.filter((r: any) => r.scopeType === 'MACHINE' && r.machine);
      const lineCodeById = new Map<string, string>(lineRows.map((r: any) => [r.productionLineId, r.productionLine.code]));
      const inheritedMachines: any[] = [];
      const inheritedSet = new Set<string>();
      for (const lr of lineRows) {
        for (const m of machinesByLine.get(lr.productionLineId) ?? []) {
          if (inheritedSet.has(m.id)) continue;
          inheritedSet.add(m.id);
          inheritedMachines.push({ id: m.id, code: m.code, name: m.name, productionLineId: m.productionLineId, lineCode: lineCodeById.get(m.productionLineId) ?? null });
        }
      }
      const explicitMachines = machineRows.map((r: any) => ({ id: r.machine.id, code: r.machine.code, name: r.machine.name }));
      const effectiveMap = new Map<string, any>();
      for (const m of inheritedMachines) effectiveMap.set(m.id, { id: m.id, code: m.code, name: m.name, source: 'INHERITED', lineCode: m.lineCode });
      for (const m of explicitMachines) if (!effectiveMap.has(m.id)) effectiveMap.set(m.id, { id: m.id, code: m.code, name: m.name, source: 'EXPLICIT', lineCode: null });
      list.push({
        key: g.key,
        maintenancePersonnelId: g.maintenancePersonnelId,
        responsibilityRole: g.responsibilityRole,
        personnel: g.personnel,
        fullLines: lineRows.map((r: any) => ({ id: r.productionLine.id, code: r.productionLine.code, name: r.productionLine.name })),
        inheritedMachines,
        explicitMachines,
        effectiveMachines: [...effectiveMap.values()],
        isPrimary: g.isPrimary,
        startDate: g.startDate,
        endDate: g.endDate,
        status: g.status,
        notes: g.notes,
        counts: {
          fullLines: lineRows.length,
          inheritedMachines: inheritedMachines.length,
          explicitMachines: explicitMachines.length,
          effectiveMachines: effectiveMap.size,
        },
        _updatedAtMs: g.updatedAt ? new Date(g.updatedAt).getTime() : 0,
      });
    }

    list.sort((a, b) => b._updatedAtMs - a._updatedAtMs);
    const total = list.length;
    const paged = list.slice((page - 1) * limit, (page - 1) * limit + limit).map(({ _updatedAtMs, ...rest }) => rest);
    return { data: paged, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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
