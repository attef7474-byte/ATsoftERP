import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachineComponentDto, UpdateMachineComponentDto } from './dto/create-machine-component.dto';
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
