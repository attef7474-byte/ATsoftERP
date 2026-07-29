import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
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

  async create(dto: CreateMaintenanceBomDto, userId: string) {
    if (dto.machineId && dto.componentId) {
      throw new BadRequestException('maintenance.bomCannotScopeToBothMachineAndComponent');
    }
    const code = await this.numberingService.generateNumberAtomic('MAINTENANCE_BOM');
    const bom = await this.prisma.maintenanceBom.create({ data: { ...dto, code } });
    await this.audit.log(userId, 'CREATE', 'MaintenanceBom', bom.id, { dto });
    return this.findById(bom.id);
  }

  async findAll(query: QueryMaintenanceBomDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.machineId) where.machineId = query.machineId;
    if (query.componentId) where.componentId = query.componentId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
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

  async findById(id: string) {
    const bom = await this.prisma.maintenanceBom.findUnique({
      where: { id },
      include: {
        versions: {
          include: { items: { include: { sparePart: true }, orderBy: { sortOrder: 'asc' } } },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
    if (!bom || bom.deletedAt) throw new NotFoundException('maintenance.bomNotFound');
    return bom;
  }

  async update(id: string, dto: UpdateMaintenanceBomDto, userId: string) {
    await this.findById(id);
    if (dto.machineId && dto.componentId) {
      throw new BadRequestException('maintenance.bomCannotScopeToBothMachineAndComponent');
    }
    const updated = await this.prisma.maintenanceBom.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceBom', id, { dto });
    return this.findById(updated.id);
  }

  async activate(id: string, userId: string) {
    await this.findById(id);
    const updated = await this.prisma.maintenanceBom.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'MaintenanceBom', id, {});
    return this.findById(updated.id);
  }

  async deactivate(id: string, userId: string) {
    await this.findById(id);
    const updated = await this.prisma.maintenanceBom.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'MaintenanceBom', id, {});
    return this.findById(updated.id);
  }

  async remove(id: string, userId: string) {
    await this.findById(id);
    await this.prisma.maintenanceBom.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(userId, 'DELETE', 'MaintenanceBom', id, {});
    return { success: true };
  }

  async getByMachine(machineId: string) {
    return this.prisma.maintenanceBom.findMany({
      where: { machineId, deletedAt: null },
      include: { versions: { where: { isActive: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByComponent(componentId: string) {
    return this.prisma.maintenanceBom.findMany({
      where: { componentId, deletedAt: null },
      include: { versions: { where: { isActive: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveVersion(id: string) {
    const bom = await this.findById(id);
    const activeVersion = bom.versions.find(v => v.isActive);
    if (!activeVersion) return null;
    return this.prisma.maintenanceBomVersion.findUnique({
      where: { id: activeVersion.id },
      include: { items: { include: { sparePart: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  // ── Versions ──
  async getVersions(bomId: string, query: QueryBomVersionDto) {
    await this.findById(bomId);
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

  async createVersion(bomId: string, dto: CreateMaintenanceBomVersionDto, userId: string) {
    await this.findById(bomId);
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

  async activateVersion(bomId: string, versionId: string, userId: string) {
    await this.findById(bomId);
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

  // ── Items ──
  async getItems(versionId: string) {
    return this.prisma.maintenanceBomItem.findMany({
      where: { bomVersionId: versionId },
      include: { sparePart: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addItem(versionId: string, dto: CreateMaintenanceBomItemDto, userId: string) {
    const version = await this.prisma.maintenanceBomVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('maintenance.bomVersionNotFound');
    const item = await this.prisma.maintenanceBomItem.create({
      data: { bomVersionId: versionId, ...dto },
    });
    await this.audit.log(userId, 'ADD_ITEM', 'MaintenanceBomItem', item.id, { versionId });
    return this.prisma.maintenanceBomItem.findUnique({
      where: { id: item.id },
      include: { sparePart: true },
    });
  }

  async updateItem(itemId: string, dto: UpdateMaintenanceBomItemDto, userId: string) {
    const existing = await this.prisma.maintenanceBomItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException('maintenance.bomItemNotFound');
    const updated = await this.prisma.maintenanceBomItem.update({ where: { id: itemId }, data: dto });
    await this.audit.log(userId, 'UPDATE_ITEM', 'MaintenanceBomItem', itemId, { dto });
    return this.prisma.maintenanceBomItem.findUnique({
      where: { id: updated.id },
      include: { sparePart: true },
    });
  }

  async removeItem(itemId: string, userId: string) {
    const existing = await this.prisma.maintenanceBomItem.findUnique({ where: { id: itemId } });
    if (!existing) throw new NotFoundException('maintenance.bomItemNotFound');
    await this.prisma.maintenanceBomItem.delete({ where: { id: itemId } });
    await this.audit.log(userId, 'REMOVE_ITEM', 'MaintenanceBomItem', itemId, {});
    return { success: true };
  }
}
