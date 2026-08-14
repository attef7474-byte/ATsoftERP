import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMachineCategoryDto } from './dto/create-machine-category.dto';
import { UpdateMachineCategoryDto } from './dto/update-machine-category.dto';

@Injectable()
export class MachineCategoriesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }

  async create(dto: CreateMachineCategoryDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('MACHINE_CATEGORY');
    const existing = await this.prisma.machineCategory.findUnique({ where: { code } });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Machine category code already exists');

    if (dto.parentId) {
      const parent = await this.prisma.machineCategory.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw this.validationError('parentId', 'validation.invalidReference', 'Parent category not found');
    }

    const category = await this.prisma.machineCategory.create({ data: { ...dto, code } });
    await this.auditService.log(userId, 'CREATE', 'MachineCategory', category.id, { message: `Created machine category: ${category.code}` });
    return category;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }) {
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
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.machineCategory.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { parent: { select: { id: true, name: true } }, _count: { select: { children: true, machines: true } } },
      }),
      this.prisma.machineCategory.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const category = await this.prisma.machineCategory.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, code: true } },
        _count: { select: { machines: true } },
      },
    });
    if (!category) throw new NotFoundException({ messageKey: 'maintenance.machineCategoryNotFound', message: 'Machine category not found' });
    return category;
  }

  async update(id: string, dto: UpdateMachineCategoryDto, userId: string) {
    const existing = await this.findOne(id);
    if (dto.code && dto.code !== existing.code) {
      throw this.validationError('code', 'validation.invalidValue', 'Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;

    if (updateDto.parentId) {
      if (updateDto.parentId === id) throw this.validationError('parentId', 'validation.invalidValue', 'A category cannot be its own parent');
      const parent = await this.prisma.machineCategory.findUnique({ where: { id: updateDto.parentId } });
      if (!parent) throw this.validationError('parentId', 'validation.invalidReference', 'Parent category not found');
    }

    const category = await this.prisma.machineCategory.update({ where: { id }, data: updateDto });
    await this.auditService.log(userId, 'UPDATE', 'MachineCategory', id, { message: `Updated machine category: ${category.code}` });
    return category;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    const machineCount = await this.prisma.machine.count({ where: { categoryId: id, deletedAt: null } });
    if (machineCount > 0) throw new ConflictException('Cannot delete machine category with linked machines');
    const childCount = await this.prisma.machineCategory.count({ where: { parentId: id, deletedAt: null } });
    if (childCount > 0) throw new ConflictException('Cannot delete machine category with child categories');
    await this.prisma.machineCategory.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'MachineCategory', id, { message: `Deleted machine category: ${id}` });
    return { message: 'Machine category deleted successfully' };
  }

  async getTree() {
    const categories = await this.prisma.machineCategory.findMany({
      where: { deletedAt: null },
      include: {
        children: { where: { deletedAt: null }, select: { id: true, name: true, code: true } },
        _count: { select: { machines: true } },
      },
    });
    return categories.filter((c) => !c.parentId);
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const category = await this.prisma.machineCategory.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'MachineCategory', id);
    return category;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const category = await this.prisma.machineCategory.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'MachineCategory', id);
    return category;
  }

  async categorySummary(id: string, ctx: ActiveOperationalContext) {
    const category = await this.findOne(id);
    const machines = await this.prisma.machine.count({ where: { categoryId: id, ...this.machineScope(ctx) } });
    return { ...category, totalMachines: machines };
  }

  async categoryMachines(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id);
    return this.prisma.machine.findMany({
      where: { categoryId: id, ...this.machineScope(ctx) },
      select: { id: true, code: true, name: true, status: true, model: true, manufacturer: true, location: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }
}
