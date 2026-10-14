import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';

/**
 * Global canonical Unit / Unit-of-Measure master (ERP-wide reference data).
 * Not maintenance-specific and not company/branch scoped.
 */
@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUnitDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.unit.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Unit code already exists');
    return this.prisma.unit.create({
      data: { code, nameAr: dto.nameAr, nameEn: dto.nameEn, symbol: dto.symbol, isActive: dto.isActive ?? true },
    });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; activeOnly?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { nameAr: { contains: query.search } },
        { nameEn: { contains: query.search } },
        { symbol: { contains: query.search } },
      ];
    }
    if (query.activeOnly === 'true') where.isActive = true;
    const [data, total] = await Promise.all([
      this.prisma.unit.findMany({ where, skip, take: limit, orderBy: [{ isActive: 'desc' }, { code: 'asc' }] }),
      this.prisma.unit.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { _count: { select: { products: true, spareParts: true, machineParts: true } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto) {
    const existing = await this.findOne(id);
    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.prisma.unit.findUnique({ where: { code } });
      if (clash) throw new ConflictException('Unit code already exists');
      dto = { ...dto, code };
    } else {
      delete (dto as any).code;
    }
    return this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.symbol !== undefined ? { symbol: dto.symbol } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
      },
    });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.unit.update({ where: { id }, data: { isActive: true } });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.unit.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * A unit referenced anywhere must not be hard-deleted; deactivate instead.
   * The Unit master has no soft-delete column (global reference data), so this
   * deletes only unreferenced rows.
   */
  async remove(id: string) {
    const unit = await this.findOne(id);
    const counts = (unit as any)._count as { products: number; spareParts: number; machineParts: number };
    const referenced = counts.products + counts.spareParts + counts.machineParts;
    if (referenced > 0) {
      throw new ConflictException('Cannot delete a unit that is referenced. Deactivate it instead.');
    }
    await this.prisma.unit.delete({ where: { id } });
    return { message: 'Unit deleted successfully' };
  }
}
