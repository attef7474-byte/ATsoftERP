import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import {
  CreateMachineComponentDto,
  UpdateMachineComponentDto,
  BatchCreateMachineComponentDto,
  MachineComponentMachineInputDto,
} from './dto/create-machine-component.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const COMPONENT_TYPES = ['MECHANICAL', 'ELECTRICAL', 'CONTROL', 'PNEUMATIC', 'HYDRAULIC', 'HEATING', 'COOLING', 'SENSOR', 'SAFETY', 'CONVEYOR', 'FRAME', 'UTILITY', 'OTHER'];
const CRITICALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

type MachineRef = { id: string; code?: string; name?: string; companyId?: string | null; branchId?: string | null; status?: string; deletedAt?: Date | null };
type LinkRef = {
  id?: string;
  machineId: string;
  status: string;
  locationInMachine?: string | null;
  serialNumber?: string | null;
  linkedAt?: Date;
  unlinkedAt?: Date | null;
  machine?: { id: string; code?: string; name?: string } | null;
};
type MachineData = { locationInMachine?: string | null; serialNumber?: string | null };

@Injectable()
export class MachineComponentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === undefined || machine.branchId === ctx.branchId);
  }

  private dedupe(ids: string[]): string[] {
    return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim())));
  }

  private normalizeMachineIds(dto: { machineIds?: string[]; machineId?: string }): string[] {
    if (Array.isArray(dto.machineIds) && dto.machineIds.length > 0) return this.dedupe(dto.machineIds);
    if (dto.machineId) return this.dedupe([dto.machineId]);
    return [];
  }

  private machineDataMap(dto: { machineData?: MachineComponentMachineInputDto[] }, machineIds: string[]): Map<string, MachineData> {
    const map = new Map<string, MachineData>();
    for (const item of dto.machineData ?? []) {
      if (!item || typeof item.machineId !== 'string' || !item.machineId) {
        throw this.validationError('machineData', 'validation.required', 'Each machine data row requires a machineId');
      }
      if (!machineIds.includes(item.machineId)) {
        throw this.validationError('machineData', 'validation.invalidReference', 'Machine data references a machine outside the selection');
      }
      if (map.has(item.machineId)) {
        throw this.validationError('machineData', 'validation.duplicateValue', 'Machine data contains duplicate machine ids');
      }
      map.set(item.machineId, {
        locationInMachine: item.locationInMachine ?? null,
        serialNumber: item.serialNumber ?? null,
      });
    }
    return map;
  }

  private dataFor(machineId: string, map: Map<string, MachineData>, dto: { locationInMachine?: string; serialNumber?: string }, single: boolean): MachineData {
    const explicit = map.get(machineId);
    if (explicit) return explicit;
    return {
      locationInMachine: dto.locationInMachine ?? null,
      serialNumber: single ? (dto.serialNumber ?? null) : null,
    };
  }

  private activeIds(links: LinkRef[]): string[] {
    return this.dedupe((links ?? []).filter((l) => l.status === 'ACTIVE').map((l) => l.machineId));
  }

  private componentOwned(component: { companyId?: string | null; branchId?: string | null; machine?: { companyId?: string | null; branchId?: string | null } | null }, ctx: ActiveOperationalContext): boolean {
    const companyId = component.companyId ?? component.machine?.companyId ?? null;
    const branchId = component.branchId ?? component.machine?.branchId ?? null;
    if (!companyId) return ctx.source === 'SUPER_ADMIN';
    return companyId === ctx.companyId && (!branchId || branchId === ctx.branchId);
  }

  private async componentAccess(id: string, ctx: ActiveOperationalContext, client: any = this.prisma, includeAllLinks = false) {
    const component = await client.machineComponent.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true, companyId: true, branchId: true } },
        machineLinks: {
          ...(includeAllLinks ? {} : { where: { status: 'ACTIVE' } }),
          select: {
            id: true,
            machineId: true,
            status: true,
            locationInMachine: true,
            serialNumber: true,
            linkedAt: true,
            unlinkedAt: true,
            machine: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!component || component.deletedAt || !this.componentOwned(component, ctx)) {
      throw this.notFound('maintenance.componentNotFound', 'Machine component not found');
    }
    return component;
  }

  private present(component: any) {
    const links: LinkRef[] = component.machineLinks ?? [];
    const machines = links.map((link) => ({
      machineId: link.machineId,
      code: link.machine?.code,
      name: link.machine?.name,
      associationId: link.id,
      status: link.status,
      linkedAt: link.linkedAt,
      unlinkedAt: link.unlinkedAt,
      locationInMachine: link.locationInMachine ?? null,
      serialNumber: link.serialNumber ?? null,
    }));
    return { ...component, machines };
  }

  private async validateMachines(client: any, machineIds: string[], ctx: ActiveOperationalContext): Promise<MachineRef[]> {
    const machines: MachineRef[] = await client.machine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true, code: true, name: true, companyId: true, branchId: true, status: true, deletedAt: true },
    });
    const byId = new Map(machines.map((m) => [m.id, m]));
    const ordered: MachineRef[] = [];
    for (const id of machineIds) {
      const machine = byId.get(id);
      if (!machine || machine.deletedAt || !this.machineOwns(machine, ctx)) {
        throw this.validationError('machineIds', 'validation.invalidReference', 'Machine not found');
      }
      if (machine.status !== 'ACTIVE') {
        throw this.validationError('machineIds', 'maintenance.machineInactive', 'The selected machine is inactive');
      }
      ordered.push(machine);
    }
    return ordered;
  }

  private async validateCodeUnique(client: any, code: string, ctx: ActiveOperationalContext, excludeId?: string) {
    const conflict = await client.machineComponent.findFirst({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        code,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (conflict) throw this.validationError('code', 'validation.duplicateValue', 'Component code already exists in this company and branch');
  }

  private async validateParent(
    client: any,
    parentComponentId: string,
    childMachineIds: string[],
    ctx: ActiveOperationalContext,
    childComponentId?: string,
  ) {
    if (parentComponentId === childComponentId) {
      throw this.validationError('parentComponentId', 'validation.invalidValue', 'A component cannot be its own parent');
    }
    const parent: any = await this.componentAccess(parentComponentId, ctx, client);
    if (parent.status !== 'ACTIVE') {
      throw this.validationError('parentComponentId', 'validation.invalidReference', 'Parent component is inactive');
    }
    const parentIds = this.activeIds(parent.machineLinks);
    const missing = childMachineIds.filter((id) => !parentIds.includes(id));
    if (missing.length > 0) {
      throw this.validationError('parentComponentId', 'maintenance.parentMachineScopeMismatch', 'Child machines must be a subset of the parent component machines');
    }
    await this.detectCycle(client, childComponentId, parentComponentId);
  }

  private async detectCycle(client: any, componentId: string | undefined, proposedParentId: string) {
    if (!componentId) return;
    let currentId: string | null = proposedParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === componentId || visited.has(currentId)) {
        throw this.validationError('parentComponentId', 'validation.invalidValue', 'Setting this parent would create a circular reference');
      }
      visited.add(currentId);
      const current: { parentComponentId: string | null } | null = await client.machineComponent.findUnique({
        where: { id: currentId },
        select: { parentComponentId: true },
      });
      currentId = current?.parentComponentId ?? null;
    }
  }

  private async assertRemovalAllowed(client: any, componentId: string, removingIds: string[], remainingIds: string[], ctx: ActiveOperationalContext) {
    if (removingIds.length === 0) return;
    const children: any[] = await client.machineComponent.findMany({
      where: { parentComponentId: componentId, deletedAt: null },
      select: { id: true, code: true, machineLinks: { where: { status: 'ACTIVE' }, select: { machineId: true } } },
    });
    const remaining = new Set(remainingIds);
    for (const child of children) {
      const needed = this.activeIds(child.machineLinks).filter((id) => removingIds.includes(id) && !remaining.has(id));
      if (needed.length > 0) {
        throw this.validationError('machineIds', 'maintenance.parentMachineRemovalBlocked', 'A child component still needs the machine being removed');
      }
    }
  }

  private async createCore(client: any, dto: any, userId: string, ctx: ActiveOperationalContext, correlationId?: string) {
    const machineIds = this.normalizeMachineIds(dto);
    if (machineIds.length === 0) {
      throw this.validationError('machineIds', 'validation.required', 'At least one machine must be selected');
    }
    if (machineIds.length > 1 && dto.serialNumber && dto.serialNumber.trim().length > 0) {
      throw this.validationError('serialNumber', 'maintenance.batchSerialPerMachineRequired', 'Serial number must be provided per machine when multiple machines are selected');
    }

    const machines = await this.validateMachines(client, machineIds, ctx);
    await this.validateCodeUnique(client, dto.code, ctx);
    if (dto.parentComponentId) {
      await this.validateParent(client, dto.parentComponentId, machineIds, ctx);
    }

    const dataMap = this.machineDataMap(dto, machineIds);
    const primary = machines[0];
    const primaryData = this.dataFor(primary.id, dataMap, dto, machineIds.length === 1);
    const now = new Date();
    const batchCorrelationId = correlationId ?? `mcbatch:${userId}:${Date.now()}`;

    const component = await client.machineComponent.create({
      data: {
        // Legacy identity pointer only; canonical membership is machineLinks.
        machineId: primary.id,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        parentComponentId: dto.parentComponentId ?? null,
        code: dto.code,
        name: dto.name,
        componentType: dto.componentType,
        description: dto.description ?? null,
        manufacturer: dto.manufacturer ?? null,
        model: dto.model ?? null,
        criticality: dto.criticality ?? 'MEDIUM',
        status: dto.status ?? 'ACTIVE',
        locationInMachine: primaryData.locationInMachine ?? null,
        serialNumber: primaryData.serialNumber ?? null,
      },
    });

    await client.machineComponentMachine.createMany({
      data: machines.map((machine) => {
        const machineData = this.dataFor(machine.id, dataMap, dto, machineIds.length === 1);
        return {
          componentId: component.id,
          machineId: machine.id,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: 'ACTIVE',
          linkedAt: now,
          unlinkedAt: null,
          locationInMachine: machineData.locationInMachine ?? null,
          serialNumber: machineData.serialNumber ?? null,
          createdAt: now,
          updatedAt: now,
        };
      }),
    });

    await this.auditService.logWithClient(client, {
      userId,
      action: 'CREATE',
      entity: 'MachineComponent',
      entityId: component.id,
      details: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        code: component.code,
        batch: machineIds.length > 1,
        batchCorrelationId,
        batchSize: machineIds.length,
        machineIds,
        addedMachines: machineIds,
      },
    });

    const full = await this.componentAccess(component.id, ctx, client);
    return this.present(full);
  }

  private async createTransaction(dto: any, userId: string, ctx: ActiveOperationalContext, correlationId?: string) {
    try {
      return await this.prisma.$transaction((tx: any) => this.createCore(tx, dto, userId, ctx, correlationId));
    } catch (err: any) {
      if (err && err.code === 'P2002') {
        throw this.validationError('code', 'validation.duplicateValue', 'Component code already exists in this company and branch');
      }
      throw err;
    }
  }

  async create(dto: CreateMachineComponentDto, userId: string, ctx: ActiveOperationalContext) {
    return this.createTransaction(dto, userId, ctx);
  }

  /**
   * Compatibility endpoint. Creates ONE component with N associations in one
   * transaction; it never creates one component row per machine.
   */
  async createBatch(dto: BatchCreateMachineComponentDto, userId: string, ctx: ActiveOperationalContext) {
    const machineIds = this.normalizeMachineIds(dto);
    if (machineIds.length === 0) {
      throw this.validationError('machineIds', 'validation.required', 'At least one machine must be selected');
    }
    const component = await this.createTransaction(dto, userId, ctx);
    const machines = component.machines ?? [];
    return {
      createdCount: 1,
      componentId: component.id,
      component,
      createdComponents: machines.map((m: any) => ({
        id: component.id,
        code: component.code,
        name: component.name,
        machineId: m.machineId,
        machineCode: m.code,
        machineName: m.name,
      })),
    };
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; parentComponentId?: string;
    componentType?: string; criticality?: string; status?: string;
  }, ctx: ActiveOperationalContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (ctx.source !== 'SUPER_ADMIN') {
      where.companyId = ctx.companyId;
      where.OR = [{ branchId: ctx.branchId }, { branchId: null }];
    }
    if (query.search) {
      where.AND = [{ OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] }];
    }
    if (query.machineId) {
      await this.validateMachines(this.prisma, [query.machineId], ctx);
      where.machineLinks = { some: { machineId: query.machineId, status: 'ACTIVE' } };
    }
    if (query.parentComponentId) where.parentComponentId = query.parentComponentId;
    if (query.componentType) where.componentType = query.componentType;
    if (query.criticality) where.criticality = query.criticality;
    if (query.status) where.status = query.status;

    const include = {
      machine: { select: { id: true, name: true, code: true } },
      parentComponent: { select: { id: true, name: true, code: true } },
      machineLinks: {
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          machineId: true,
          status: true,
          locationInMachine: true,
          serialNumber: true,
          linkedAt: true,
          unlinkedAt: true,
          machine: { select: { id: true, code: true, name: true } },
        },
      },
      _count: { select: { children: true } },
    };

    const [rows, total] = await Promise.all([
      this.prisma.machineComponent.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include }),
      this.prisma.machineComponent.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.present(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.present(await this.componentAccess(id, ctx));
  }

  private resolveMachineChanges(existing: any, dto: UpdateMachineComponentDto) {
    const current = this.activeIds(existing.machineLinks);
    const hasFullSet = dto.machineIds !== undefined;
    const hasDelta = dto.toAdd !== undefined || dto.toKeep !== undefined || dto.toRemove !== undefined;
    if (hasFullSet && hasDelta) {
      throw this.validationError('machineIds', 'validation.invalidValue', 'Use either machineIds or toAdd/toKeep/toRemove, not both');
    }

    if (hasFullSet) {
      const desired = this.dedupe(dto.machineIds ?? []);
      if (desired.length === 0) throw this.validationError('machineIds', 'validation.required', 'At least one machine must remain associated');
      return {
        desired,
        toAdd: desired.filter((id) => !current.includes(id)),
        toRemove: current.filter((id) => !desired.includes(id)),
      };
    }

    if (!hasDelta) {
      if (dto.machineId) {
        if (!current.includes(dto.machineId)) {
          throw this.validationError('machineId', 'validation.invalidValue', 'Machine must be an active association of this component');
        }
        return { desired: current, toAdd: [], toRemove: [], primaryOverride: dto.machineId };
      }
      return { desired: current, toAdd: [], toRemove: [] };
    }

    const add = this.dedupe(dto.toAdd ?? []);
    const keep = this.dedupe(dto.toKeep ?? []);
    const remove = this.dedupe(dto.toRemove ?? []);
    const overlap = add.filter((id) => remove.includes(id));
    if (overlap.length > 0) throw this.validationError('toAdd', 'validation.invalidValue', 'A machine cannot be both added and removed');
    const keepInvalid = keep.filter((id) => !current.includes(id));
    if (keepInvalid.length > 0) throw this.validationError('toKeep', 'validation.invalidValue', 'toKeep can only contain currently active machine associations');

    const desired = this.dedupe([...current.filter((id) => !remove.includes(id)), ...add]);
    if (desired.length === 0) throw this.validationError('machineIds', 'validation.required', 'At least one machine must remain associated');
    return {
      desired,
      toAdd: add.filter((id) => !current.includes(id)),
      toRemove: remove.filter((id) => current.includes(id)),
      primaryOverride: dto.machineId,
    };
  }

  private async updateCore(client: any, id: string, dto: UpdateMachineComponentDto, userId: string, ctx: ActiveOperationalContext) {
    const existing: any = await this.componentAccess(id, ctx, client, true);
    if (dto.code && dto.code !== existing.code) {
      throw this.validationError('code', 'validation.invalidValue', 'Code cannot be changed after creation');
    }
    if (dto.status === 'ACTIVE' && existing.deletedAt) {
      throw this.validationError('status', 'validation.invalidValue', 'A soft-deleted component cannot be reactivated through edit');
    }

    const changes = this.resolveMachineChanges(existing, dto);
    const machineIds = changes.desired;
    await this.validateMachines(client, machineIds, ctx);

    const parentId = dto.parentComponentId !== undefined ? dto.parentComponentId : existing.parentComponentId;
    if (parentId) {
      await this.validateParent(client, parentId, machineIds, ctx, id);
    }
    await this.assertRemovalAllowed(client, id, changes.toRemove, machineIds, ctx);
    if (dto.machineId && !machineIds.includes(dto.machineId)) {
      throw this.validationError('machineId', 'validation.invalidValue', 'Legacy machine pointer must remain in the active machine set');
    }

    const dataMap = this.machineDataMap(dto, machineIds);
    const now = new Date();
    const primaryId = (changes as any).primaryOverride
      || (machineIds.includes(existing.machineId) ? existing.machineId : machineIds[0]);
    const primaryData = this.dataFor(primaryId, dataMap, dto, machineIds.length === 1);

    const scalar: any = {};
    for (const field of ['name', 'componentType', 'description', 'manufacturer', 'model', 'criticality', 'status'] as const) {
      if (dto[field] !== undefined) scalar[field] = (dto as any)[field];
    }
    if (dto.parentComponentId !== undefined) scalar.parentComponentId = dto.parentComponentId || null;
    scalar.machineId = primaryId;
    scalar.locationInMachine = primaryData.locationInMachine ?? null;
    scalar.serialNumber = primaryData.serialNumber ?? null;
    scalar.updatedAt = now;

    const updated: any = await client.machineComponent.update({ where: { id }, data: scalar });

    if (changes.toRemove.length > 0) {
      await client.machineComponentMachine.updateMany({
        where: { componentId: id, machineId: { in: changes.toRemove }, status: 'ACTIVE' },
        data: { status: 'INACTIVE', unlinkedAt: now, updatedAt: now },
      });
    }

    for (const machineId of changes.toAdd) {
      const machineData = this.dataFor(machineId, dataMap, dto, machineIds.length === 1);
      await client.machineComponentMachine.upsert({
        where: { componentId_machineId: { componentId: id, machineId } },
        create: {
          componentId: id,
          machineId,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: 'ACTIVE',
          linkedAt: now,
          unlinkedAt: null,
          locationInMachine: machineData.locationInMachine ?? null,
          serialNumber: machineData.serialNumber ?? null,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          status: 'ACTIVE',
          unlinkedAt: null,
          linkedAt: now,
          locationInMachine: machineData.locationInMachine ?? null,
          serialNumber: machineData.serialNumber ?? null,
          updatedAt: now,
        },
      });
    }

    for (const [machineId, machineData] of dataMap.entries()) {
      if (!machineIds.includes(machineId)) continue;
      await client.machineComponentMachine.updateMany({
        where: { componentId: id, machineId },
        data: {
          locationInMachine: machineData.locationInMachine ?? null,
          serialNumber: machineData.serialNumber ?? null,
          updatedAt: now,
        },
      });
    }

    await this.auditService.logWithClient(client, {
      userId,
      action: 'UPDATE',
      entity: 'MachineComponent',
      entityId: id,
      details: {
        code: updated.code,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        beforeMachines: this.activeIds(existing.machineLinks),
        afterMachines: machineIds,
        addedMachines: changes.toAdd,
        removedMachines: changes.toRemove,
        changedFields: Object.keys(scalar),
      },
    });

    return this.present(await this.componentAccess(id, ctx, client));
  }

  async update(id: string, dto: UpdateMachineComponentDto, userId: string, ctx: ActiveOperationalContext) {
    try {
      return await this.prisma.$transaction((tx: any) => this.updateCore(tx, id, dto, userId, ctx));
    } catch (err: any) {
      if (err && err.code === 'P2002') {
        throw this.validationError('code', 'validation.duplicateValue', 'Component code already exists in this company and branch');
      }
      throw err;
    }
  }

  /** Reuses this aggregate's contracts inside a caller-owned transaction. */
  async saveInTx(client: any, dto: CreateMachineComponentDto | UpdateMachineComponentDto, userId: string, ctx: ActiveOperationalContext, existingId?: string) {
    if (existingId) return this.updateCore(client, existingId, dto as UpdateMachineComponentDto, userId, ctx);
    return this.createCore(client, dto as CreateMachineComponentDto, userId, ctx);
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx: any) => {
      const existing: any = await this.componentAccess(id, ctx, tx, true);
      const childCount = await tx.machineComponent.count({ where: { parentComponentId: id, deletedAt: null } });
      if (childCount > 0) throw new ConflictException('Cannot delete component with child components');
      const partCount = await tx.componentSparePart.count({ where: { componentId: id } });
      if (partCount > 0) throw new ConflictException('Cannot delete component with linked spare parts');

      const now = new Date();
      await tx.machineComponent.update({ where: { id }, data: { deletedAt: now, updatedAt: now } });
      await tx.machineComponentMachine.updateMany({
        where: { componentId: id, status: 'ACTIVE' },
        data: { status: 'INACTIVE', unlinkedAt: now, updatedAt: now },
      });
      await this.auditService.logWithClient(tx, {
        userId,
        action: 'DELETE',
        entity: 'MachineComponent',
        entityId: id,
        details: { code: existing.code, removedMachines: this.activeIds(existing.machineLinks) },
      });
      return { message: 'Machine component deleted successfully' };
    });
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    const existing: any = await this.componentAccess(id, ctx);
    const component = await this.prisma.machineComponent.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'MachineComponent', id, {
      code: existing.code,
      machineIds: this.activeIds(existing.machineLinks),
    });
    return component;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    const existing: any = await this.componentAccess(id, ctx);
    const component = await this.prisma.machineComponent.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'MachineComponent', id, {
      code: existing.code,
      machineIds: this.activeIds(existing.machineLinks),
    });
    return component;
  }
}
