import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachineComponentDto, UpdateMachineComponentDto, BatchCreateMachineComponentDto } from './dto/create-machine-component.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const COMPONENT_TYPES = ['MECHANICAL', 'ELECTRICAL', 'CONTROL', 'PNEUMATIC', 'HYDRAULIC', 'HEATING', 'COOLING', 'SENSOR', 'SAFETY', 'CONVEYOR', 'FRAME', 'UTILITY', 'OTHER'];
const CRITICALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

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
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async machineAccess(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  private async componentAccess(id: string, ctx: ActiveOperationalContext) {
    const component = await this.prisma.machineComponent.findUnique({
      where: { id },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!component || !component.machine || !this.machineOwns(component.machine, ctx)) {
      throw this.notFound('maintenance.componentNotFound', 'Machine component not found');
    }
    return component;
  }

  async create(dto: CreateMachineComponentDto, userId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) {
      throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
    }

    const existing = await this.prisma.machineComponent.findUnique({ where: { machineId_code: { machineId: dto.machineId, code: dto.code } } });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Component code already exists for this machine');

    if (dto.parentComponentId) {
      await this.validateParent(dto.parentComponentId, dto.machineId, ctx);
    }

    const component = await this.prisma.machineComponent.create({ data: dto });
    await this.auditService.log(userId, 'CREATE', 'MachineComponent', component.id, { message: `Created machine component: ${component.code}` });
    return component;
  }

  /**
   * Multi-machine batch create (§7). One independent MachineComponent row per unique
   * selected machine, created in a single atomic transaction. Nothing is persisted if
   * any validation fails (all-or-nothing, §21).
   */
  async createBatch(dto: BatchCreateMachineComponentDto, userId: string, ctx: ActiveOperationalContext) {
    const machineIds = Array.from(
      new Set((dto.machineIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)),
    );
    if (machineIds.length === 0) {
      throw this.validationError('machineIds', 'validation.required', 'At least one machine must be selected');
    }
    const isMulti = machineIds.length > 1;
    if (isMulti && dto.serialNumber && dto.serialNumber.trim().length > 0) {
      throw this.validationError('serialNumber', 'maintenance.batchSerialPerMachineRequired', 'Serial number must be entered separately for each machine when required');
    }
    if (isMulti && dto.parentComponentId) {
      throw this.validationError('parentComponentId', 'maintenance.batchParentPerMachineRequired', 'Parent component must be assigned independently for each machine');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const machines = await tx.machine.findMany({
          where: { id: { in: machineIds } },
          select: { id: true, code: true, name: true, companyId: true, branchId: true, status: true, deletedAt: true },
        });
        const byId = new Map(machines.map((m) => [m.id, m]));
        const ordered: typeof machines = [];
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

        let parentComponentId: string | null = null;
        if (dto.parentComponentId) {
          const parent = await tx.machineComponent.findUnique({
            where: { id: dto.parentComponentId },
            include: { machine: { select: { companyId: true, branchId: true } } },
          });
          if (!parent || !parent.machine || !this.machineOwns(parent.machine, ctx)) {
            throw this.validationError('parentComponentId', 'validation.invalidReference', 'Parent component not found');
          }
          if (parent.machineId !== ordered[0].id) {
            throw this.validationError('parentComponentId', 'validation.invalidValue', 'Parent component must belong to the same machine');
          }
          parentComponentId = parent.id;
        }

        const conflict = await tx.machineComponent.findFirst({
          where: { machineId: { in: machineIds }, code: dto.code },
          select: { machineId: true },
        });
        if (conflict) {
          throw this.validationError('code', 'validation.duplicateValue', 'Component code already exists for this machine');
        }

        const batchCorrelationId = `mcbatch:${userId}:${Date.now()}`;
        const createdComponents: {
          id: string; code: string; name: string; machineId: string; machineCode: string; machineName: string;
        }[] = [];

        for (const machine of ordered) {
          const component = await tx.machineComponent.create({
            data: {
              machineId: machine.id,
              parentComponentId,
              code: dto.code,
              name: dto.name,
              componentType: dto.componentType,
              description: dto.description ?? null,
              locationInMachine: dto.locationInMachine ?? null,
              manufacturer: dto.manufacturer ?? null,
              model: dto.model ?? null,
              serialNumber: isMulti ? null : (dto.serialNumber ?? null),
              criticality: dto.criticality ?? 'MEDIUM',
              status: dto.status ?? 'ACTIVE',
            },
          });
          await this.auditService.logWithClient(tx, {
            userId,
            action: 'CREATE',
            entity: 'MachineComponent',
            entityId: component.id,
            details: JSON.stringify({
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              machineId: machine.id,
              code: component.code,
              batch: true,
              batchCorrelationId,
              batchSize: ordered.length,
            }),
          });
          createdComponents.push({
            id: component.id,
            code: component.code,
            name: component.name,
            machineId: machine.id,
            machineCode: machine.code,
            machineName: machine.name,
          });
        }

        return { createdCount: createdComponents.length, createdComponents };
      });
    } catch (err: any) {
      if (err && err.code === 'P2002') {
        throw this.validationError('code', 'validation.duplicateValue', 'Component code already exists for this machine');
      }
      throw err;
    }
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; parentComponentId?: string;
    componentType?: string; criticality?: string; status?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, machine: this.machineScope(ctx) };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.parentComponentId) where.parentComponentId = query.parentComponentId;
    if (query.componentType) where.componentType = query.componentType;
    if (query.criticality) where.criticality = query.criticality;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.machineComponent.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, name: true, code: true } },
          parentComponent: { select: { id: true, name: true, code: true } },
          _count: { select: { children: true } },
        },
      }),
      this.prisma.machineComponent.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    await this.componentAccess(id, ctx);
    const component = await this.prisma.machineComponent.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, name: true, code: true } },
        parentComponent: { select: { id: true, name: true, code: true } },
        children: { where: { deletedAt: null }, select: { id: true, name: true, code: true, componentType: true, criticality: true, status: true } },
      },
    });
    if (!component) throw this.notFound('maintenance.componentNotFound', 'Machine component not found');
    return component;
  }

  async update(id: string, dto: UpdateMachineComponentDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.componentAccess(id, ctx);
    if (dto.code && dto.code !== existing.code) {
      throw this.validationError('code', 'validation.invalidValue', 'Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;

    if (updateDto.machineId) {
      await this.machineAccess(updateDto.machineId, ctx);
    }

    if (updateDto.parentComponentId) {
      if (updateDto.parentComponentId === id) throw this.validationError('parentComponentId', 'validation.invalidValue', 'A component cannot be its own parent');
      const targetMachineId = updateDto.machineId || existing.machineId;
      await this.validateParent(updateDto.parentComponentId, targetMachineId, ctx);
      await this.detectCycle(id, updateDto.parentComponentId);
    }

    const component = await this.prisma.machineComponent.update({
      where: { id }, data: updateDto,
      include: {
        machine: { select: { id: true, name: true, code: true } },
        parentComponent: { select: { id: true, name: true, code: true } },
      },
    });
    await this.auditService.log(userId, 'UPDATE', 'MachineComponent', id, { message: `Updated machine component: ${component.code}` });
    return component;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.componentAccess(id, ctx);
    const childCount = await this.prisma.machineComponent.count({ where: { parentComponentId: id, deletedAt: null } });
    if (childCount > 0) throw new ConflictException('Cannot delete component with child components');
    const partCount = await this.prisma.componentSparePart.count({ where: { componentId: id } });
    if (partCount > 0) throw new ConflictException('Cannot delete component with linked spare parts');
    await this.prisma.machineComponent.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'MachineComponent', id, { message: `Deleted machine component: ${id}` });
    return { message: 'Machine component deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.componentAccess(id, ctx);
    const component = await this.prisma.machineComponent.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'MachineComponent', id);
    return component;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.componentAccess(id, ctx);
    const component = await this.prisma.machineComponent.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'MachineComponent', id);
    return component;
  }

  private async validateParent(parentComponentId: string, machineId: string, ctx: ActiveOperationalContext) {
    const parent = await this.componentAccess(parentComponentId, ctx);
    if (parent.machineId !== machineId) throw this.validationError('parentComponentId', 'validation.invalidValue', 'Parent component must belong to the same machine');
  }

  private async detectCycle(componentId: string, proposedParentId: string) {
    let currentId: string | null = proposedParentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === componentId) throw this.validationError('parentComponentId', 'validation.invalidValue', 'Setting this parent would create a circular reference');
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const comp: { parentComponentId: string | null } | null = await this.prisma.machineComponent.findUnique({ where: { id: currentId }, select: { parentComponentId: true } });
      currentId = comp?.parentComponentId ?? null;
    }
  }
}
