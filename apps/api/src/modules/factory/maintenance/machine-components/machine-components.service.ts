import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachineComponentDto, UpdateMachineComponentDto } from './dto/create-machine-component.dto';

const COMPONENT_TYPES = ['MECHANICAL', 'ELECTRICAL', 'CONTROL', 'PNEUMATIC', 'HYDRAULIC', 'HEATING', 'COOLING', 'SENSOR', 'SAFETY', 'CONVEYOR', 'FRAME', 'UTILITY', 'OTHER'];
const CRITICALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

@Injectable()
export class MachineComponentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateMachineComponentDto, userId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new BadRequestException('Machine not found');

    const existing = await this.prisma.machineComponent.findUnique({ where: { machineId_code: { machineId: dto.machineId, code: dto.code } } });
    if (existing) throw new ConflictException('Component code already exists for this machine');

    if (dto.parentComponentId) {
      await this.validateParent(dto.parentComponentId, dto.machineId);
    }

    const component = await this.prisma.machineComponent.create({ data: dto });
    await this.auditService.log(userId, 'CREATE', 'MachineComponent', component.id, { message: `Created machine component: ${component.code}` });
    return component;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; parentComponentId?: string;
    componentType?: string; criticality?: string; status?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.machineId) where.machineId = query.machineId;
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

  async findOne(id: string) {
    const component = await this.prisma.machineComponent.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, name: true, code: true } },
        parentComponent: { select: { id: true, name: true, code: true } },
        children: { where: { deletedAt: null }, select: { id: true, name: true, code: true, componentType: true, criticality: true, status: true } },
      },
    });
    if (!component) throw new NotFoundException('Machine component not found');
    return component;
  }

  async update(id: string, dto: UpdateMachineComponentDto, userId: string) {
    await this.findOne(id);

    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw new BadRequestException('Machine not found');
    }

    if (dto.code) {
      const machineId = dto.machineId || (await this.prisma.machineComponent.findUnique({ where: { id } }))?.machineId;
      const existing = await this.prisma.machineComponent.findUnique({ where: { machineId_code: { machineId: machineId!, code: dto.code } } });
      if (existing && existing.id !== id) throw new ConflictException('Component code already exists for this machine');
    }

    if (dto.parentComponentId) {
      if (dto.parentComponentId === id) throw new BadRequestException('A component cannot be its own parent');
      const targetMachineId = dto.machineId || (await this.prisma.machineComponent.findUnique({ where: { id } }))?.machineId;
      await this.validateParent(dto.parentComponentId, targetMachineId!);
    }

    const component = await this.prisma.machineComponent.update({
      where: { id }, data: dto,
      include: {
        machine: { select: { id: true, name: true, code: true } },
        parentComponent: { select: { id: true, name: true, code: true } },
      },
    });
    await this.auditService.log(userId, 'UPDATE', 'MachineComponent', id, { message: `Updated machine component: ${component.code}` });
    return component;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.machineComponent.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'MachineComponent', id, { message: `Deleted machine component: ${id}` });
    return { message: 'Machine component deleted successfully' };
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const component = await this.prisma.machineComponent.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'MachineComponent', id);
    return component;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const component = await this.prisma.machineComponent.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'MachineComponent', id);
    return component;
  }

  private async validateParent(parentComponentId: string, machineId: string) {
    const parent = await this.prisma.machineComponent.findUnique({ where: { id: parentComponentId } });
    if (!parent) throw new BadRequestException('Parent component not found');
    if (parent.machineId !== machineId) throw new BadRequestException('Parent component must belong to the same machine');
  }
}
