import { Injectable, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';

const AUDIT_ENTITY = 'Unit';
const AUDIT_SCOPE = 'GLOBAL_UNIT_CATALOG';

/**
 * Global canonical Unit / Unit-of-Measure master (ERP-wide reference data).
 * Not maintenance-specific and not company/branch scoped.
 */
@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService, @Optional() private readonly audit?: AuditService) {}

  private auditWriter(): AuditService {
    return this.audit ?? new AuditService(this.prisma);
  }

  private async auditWrite(
    userId: string | undefined,
    action: string,
    entityId: string | undefined,
    previous: Record<string, unknown> | null,
    next: Record<string, unknown>,
    reason?: string,
  ) {
    if (!userId) return;
    await this.auditWriter().log(userId, action, AUDIT_ENTITY, entityId, {
      schemaVersion: 1,
      companyId: null,
      branchId: null,
      scope: AUDIT_SCOPE,
      actor: { userId },
      previous,
      next,
      ...(reason ? { reason } : {}),
    });
  }

  private snapshot(unit: any) {
    return {
      code: unit.code,
      nameAr: unit.nameAr,
      nameEn: unit.nameEn,
      symbol: unit.symbol ?? null,
      isActive: unit.isActive,
    };
  }

  async create(dto: CreateUnitDto, userId?: string) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.unit.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Unit code already exists');
    const created = await this.prisma.unit.create({
      data: { code, nameAr: dto.nameAr, nameEn: dto.nameEn, symbol: dto.symbol, isActive: dto.isActive ?? true },
    });
    await this.auditWrite(userId, 'CREATE', created.id, null, this.snapshot(created));
    return created;
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

  async update(id: string, dto: UpdateUnitDto, userId?: string) {
    const existing = await this.findOne(id);
    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.prisma.unit.findUnique({ where: { code } });
      if (clash) throw new ConflictException('Unit code already exists');
      dto = { ...dto, code };
    } else {
      delete (dto as any).code;
    }
    const updated = await this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.symbol !== undefined ? { symbol: dto.symbol } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
      },
    });
    await this.auditWrite(userId, 'UPDATE', id, this.snapshot(existing), this.snapshot(updated), 'UNIT_UPDATE');
    return updated;
  }

  async activate(id: string, userId?: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.unit.update({ where: { id }, data: { isActive: true } });
    await this.auditWrite(userId, 'ACTIVATE', id, this.snapshot(before), this.snapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }

  async deactivate(id: string, userId?: string) {
    const before = await this.findOne(id);
    const updated = await this.prisma.unit.update({ where: { id }, data: { isActive: false } });
    await this.auditWrite(userId, 'DEACTIVATE', id, this.snapshot(before), this.snapshot(updated), 'STATUS_TRANSITION');
    return updated;
  }

  /**
   * A unit referenced anywhere must not be hard-deleted; deactivate instead.
   * The Unit master has no soft-delete column (global reference data), so this
   * deletes only unreferenced rows.
   */
  async remove(id: string, userId?: string) {
    const unit = await this.findOne(id);
    const counts = (unit as any)._count as { products: number; spareParts: number; machineParts: number };
    const referenced = counts.products + counts.spareParts + counts.machineParts;
    if (referenced > 0) {
      throw new ConflictException('Cannot delete a unit that is referenced. Deactivate it instead.');
    }
    await this.prisma.unit.delete({ where: { id } });
    await this.auditWrite(userId, 'DELETE', id, this.snapshot(unit), { ...this.snapshot(unit), deleted: true }, 'HARD_DELETE_UNREFERENCED');
    return { message: 'Unit deleted successfully' };
  }
}
