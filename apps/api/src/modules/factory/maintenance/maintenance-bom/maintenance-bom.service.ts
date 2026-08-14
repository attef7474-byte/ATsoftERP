import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import {
  QueryMaintenanceBomDto, CreateMaintenanceBomDto, UpdateMaintenanceBomDto,
  CreateMaintenanceBomVersionDto, QueryBomVersionDto,
  CreateMaintenanceBomItemDto, UpdateMaintenanceBomItemDto,
} from './dto/maintenance-bom.dto';

@Injectable()
export class MaintenanceBomService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    private audit: AuditService,
  ) {}

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

  private isBomInScope(
    bom: { machine?: { companyId?: string | null; branchId?: string | null } | null; component?: { machine?: { companyId?: string | null; branchId?: string | null } | null } | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    if (bom.machine && this.isMachineInScope(bom.machine, ctx)) return true;
    if (bom.component?.machine && this.isMachineInScope(bom.component.machine, ctx)) return true;
    return false;
  }

  private async assertMachineInContext(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
    });
    if (!machine) throw new BadRequestException('Machine not found or not in the active company/branch');
    return machine;
  }

  private async assertComponentInContext(componentId: string, ctx: ActiveOperationalContext) {
    const component = await this.prisma.machineComponent.findFirst({
      where: { id: componentId, machine: this.machineScope(ctx) },
    });
    if (!component) throw new BadRequestException('Component not found or not in the active company/branch');
    return component;
  }

  private async assertBomInContextOrFail(id: string, ctx: ActiveOperationalContext) {
    const bom = await this.prisma.maintenanceBom.findUnique({
      where: { id },
      select: {
        id: true,
        deletedAt: true,
        machine: { select: { id: true, companyId: true, branchId: true } },
        component: { select: { id: true, machine: { select: { id: true, companyId: true, branchId: true } } } },
      },
    });
    if (!bom || bom.deletedAt || !this.isBomInScope(bom, ctx)) {
      throw new NotFoundException('maintenance.bomNotFound');
    }
    return bom;
  }

  private async assertVersionInContext(versionId: string, ctx: ActiveOperationalContext) {
    const version = await this.prisma.maintenanceBomVersion.findUnique({
      where: { id: versionId },
      select: { id: true, bomId: true },
    });
    if (!version) throw new NotFoundException('maintenance.bomVersionNotFound');
    await this.assertBomInContextOrFail(version.bomId, ctx);
    return version;
  }

  private async assertItemInContext(itemId: string, ctx: ActiveOperationalContext) {
    const existing = await this.prisma.maintenanceBomItem.findUnique({
      where: { id: itemId },
      select: { id: true, bomVersionId: true },
    });
    if (!existing) throw new NotFoundException('maintenance.bomItemNotFound');
    await this.assertVersionInContext(existing.bomVersionId, ctx);
    return existing;
  }

  async create(dto: CreateMaintenanceBomDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.machineId && dto.componentId) {
      throw new BadRequestException('maintenance.bomCannotScopeToBothMachineAndComponent');
    }
    if (dto.machineId) {
      await this.assertMachineInContext(dto.machineId, ctx);
    }
    if (dto.componentId) {
      await this.assertComponentInContext(dto.componentId, ctx);
    }
    const code = await this.numberingService.generateNumberAtomic('MAINTENANCE_BOM');
    const bom = await this.prisma.maintenanceBom.create({ data: { ...dto, code } });
    await this.audit.log(userId, 'CREATE', 'MaintenanceBom', bom.id, { dto });
    return this.findById(bom.id, ctx);
  }

  async findAll(query: QueryMaintenanceBomDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {
      deletedAt: null,
      OR: [
        { machine: this.machineScope(ctx) },
        { component: { machine: this.machineScope(ctx) } },
      ],
    };
    if (query.status) where.status = query.status;
    if (query.machineId) where.machineId = query.machineId;
    if (query.componentId) where.componentId = query.componentId;
    if (query.search) {
      where.AND = {
        OR: [
          { name: { contains: query.search } },
          { code: { contains: query.search } },
        ],
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.maintenanceBom.findMany({
        where, skip, take: limit,
        include: { versions: { where: { isActive: true }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.maintenanceBom.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(id, ctx);
    const bom = await this.prisma.maintenanceBom.findUnique({
      where: { id },
      include: {
        versions: {
          include: { items: { include: { sparePart: true }, orderBy: { sortOrder: 'asc' } } },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
    return bom;
  }

  async update(id: string, dto: UpdateMaintenanceBomDto, userId: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(id, ctx);
    if (dto.machineId && dto.componentId) {
      throw new BadRequestException('maintenance.bomCannotScopeToBothMachineAndComponent');
    }
    if (dto.machineId) {
      await this.assertMachineInContext(dto.machineId, ctx);
    }
    if (dto.componentId) {
      await this.assertComponentInContext(dto.componentId, ctx);
    }
    const updated = await this.prisma.maintenanceBom.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceBom', id, { dto });
    return this.findById(updated.id, ctx);
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(id, ctx);
    const updated = await this.prisma.maintenanceBom.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'MaintenanceBom', id, {});
    return this.findById(updated.id, ctx);
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(id, ctx);
    const updated = await this.prisma.maintenanceBom.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'MaintenanceBom', id, {});
    return this.findById(updated.id, ctx);
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(id, ctx);
    await this.prisma.maintenanceBom.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceBom', id, {});
    return { success: true };
  }

  async getByMachine(machineId: string, ctx: ActiveOperationalContext) {
    return this.prisma.maintenanceBom.findMany({
      where: { machineId, deletedAt: null, machine: this.machineScope(ctx) },
      include: { versions: { where: { isActive: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByComponent(componentId: string, ctx: ActiveOperationalContext) {
    return this.prisma.maintenanceBom.findMany({
      where: { componentId, deletedAt: null, component: { machine: this.machineScope(ctx) } },
      include: { versions: { where: { isActive: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveVersion(id: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(id, ctx);
    const bom = await this.prisma.maintenanceBom.findUnique({
      where: { id },
      select: { versions: { where: { isActive: true }, take: 1 } },
    });
    const activeVersion = bom?.versions[0];
    if (!activeVersion) return null;
    return this.prisma.maintenanceBomVersion.findUnique({
      where: { id: activeVersion.id },
      include: { items: { include: { sparePart: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async getVersions(bomId: string, query: QueryBomVersionDto, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(bomId, ctx);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = { bomId };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    const [data, total] = await Promise.all([
      this.prisma.maintenanceBomVersion.findMany({
        where, skip, take: limit,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { versionNumber: 'desc' },
      }),
      this.prisma.maintenanceBomVersion.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createVersion(bomId: string, dto: CreateMaintenanceBomVersionDto, userId: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(bomId, ctx);
    const lastVersion = await this.prisma.maintenanceBomVersion.findFirst({
      where: { bomId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (lastVersion?.versionNumber || 0) + 1;
    const versionLabel = `v${versionNumber}`;
    const isActive = dto.isActive ?? false;
    if (isActive) {
      await this.prisma.maintenanceBomVersion.updateMany({
        where: { bomId, isActive: true },
        data: { isActive: false },
      });
    }
    const version = await this.prisma.maintenanceBomVersion.create({
      data: {
        bomId,
        versionNumber,
        versionLabel,
        description: dto.description,
        isActive,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        createdById: userId,
      },
    });
    await this.audit.log(userId, 'CREATE_VERSION', 'MaintenanceBomVersion', version.id, { bomId, versionNumber });
    return version;
  }

  async activateVersion(bomId: string, versionId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.assertBomInContextOrFail(bomId, ctx);
    const version = await this.prisma.maintenanceBomVersion.findFirst({ where: { id: versionId, bomId } });
    if (!version) throw new NotFoundException('maintenance.bomVersionNotFound');
    await this.prisma.$transaction(async (tx) => {
      await tx.maintenanceBomVersion.updateMany({
        where: { bomId, isActive: true },
        data: { isActive: false },
      });
      await tx.maintenanceBomVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });
    });
    await this.audit.log(userId, 'ACTIVATE_VERSION', 'MaintenanceBomVersion', versionId, { bomId });
    return this.prisma.maintenanceBomVersion.findUnique({ where: { id: versionId } });
  }

  async getItems(versionId: string, ctx: ActiveOperationalContext) {
    await this.assertVersionInContext(versionId, ctx);
    return this.prisma.maintenanceBomItem.findMany({
      where: { bomVersionId: versionId },
      include: { sparePart: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addItem(versionId: string, dto: CreateMaintenanceBomItemDto, userId: string, ctx: ActiveOperationalContext) {
    await this.assertVersionInContext(versionId, ctx);
    const item = await this.prisma.maintenanceBomItem.create({
      data: { bomVersionId: versionId, ...dto },
    });
    await this.audit.log(userId, 'ADD_ITEM', 'MaintenanceBomItem', item.id, { versionId });
    return this.prisma.maintenanceBomItem.findUnique({
      where: { id: item.id },
      include: { sparePart: true },
    });
  }

  async updateItem(itemId: string, dto: UpdateMaintenanceBomItemDto, userId: string, ctx: ActiveOperationalContext) {
    await this.assertItemInContext(itemId, ctx);
    const updated = await this.prisma.maintenanceBomItem.update({ where: { id: itemId }, data: dto });
    await this.audit.log(userId, 'UPDATE_ITEM', 'MaintenanceBomItem', itemId, { dto });
    return this.prisma.maintenanceBomItem.findUnique({
      where: { id: updated.id },
      include: { sparePart: true },
    });
  }

  async removeItem(itemId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.assertItemInContext(itemId, ctx);
    await this.prisma.maintenanceBomItem.delete({ where: { id: itemId } });
    await this.audit.log(userId, 'REMOVE_ITEM', 'MaintenanceBomItem', itemId, {});
    return { success: true };
  }
}
