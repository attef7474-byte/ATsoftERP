import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CreatePerformanceProfileDto, PERFORMANCE_PROFILE_CATEGORIES } from '../dto/create-performance-profile.dto';
import { UpdatePerformanceProfileDto } from '../dto/update-performance-profile.dto';

@Injectable()
export class PerformanceProfilesService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreatePerformanceProfileDto, ctx: ActiveOperationalContext, userId?: string) {
    const code = dto.code.trim();
    const name = dto.name.trim();
    if (!code) throw this.validationError('code', 'validation.required', 'Code is required');
    if (!name) throw this.validationError('name', 'validation.required', 'Name is required');
    const category = dto.category ?? 'GENERAL';
    if (!PERFORMANCE_PROFILE_CATEGORIES.includes(category as any)) {
      throw this.validationError('category', 'validation.invalidValue', 'Invalid category');
    }

    const existing = await this.prisma.performanceProfile.findFirst({
      where: { companyId: ctx.companyId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Performance profile code already exists');

    const profile = await this.prisma.performanceProfile.create({
      data: {
        companyId: ctx.companyId,
        code,
        name,
        nameAr: dto.nameAr?.trim() || null,
        nameEn: dto.nameEn?.trim() || null,
        description: dto.description?.trim() || null,
        category,
        isActive: dto.isActive ?? true,
        status: (dto.isActive ?? true) ? 'ACTIVE' : 'INACTIVE',
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
    });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'CREATE',
      entity: 'PerformanceProfile',
      entityId: profile.id,
      details: JSON.stringify({ companyId: ctx.companyId, code: profile.code, name: profile.name, category: profile.category }),
    });

    return profile;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; category?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { nameAr: { contains: query.search } },
        { nameEn: { contains: query.search } },
      ];
    }
    if (query.category) where.category = query.category;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.performanceProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
        include: {
          _count: { select: { mappings: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.performanceProfile.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const profile = await this.prisma.performanceProfile.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: {
        mappings: {
          where: { deletedAt: null },
          orderBy: [{ priority: 'asc' }, { effectiveFrom: 'desc' }],
          include: { jobTitle: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } },
        },
        _count: { select: { mappings: { where: { deletedAt: null } } } },
      },
    });
    if (!profile) throw new NotFoundException({ messageKey: 'performance.profileNotFound', message: 'Performance profile not found' });
    return profile;
  }

  async update(id: string, dto: UpdatePerformanceProfileDto, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    const data: any = { updatedById: userId ?? null };

    if (dto.code !== undefined) {
      const code = dto.code.trim();
      if (!code) throw this.validationError('code', 'validation.required', 'Code is required');
      const dupe = await this.prisma.performanceProfile.findFirst({ where: { companyId: ctx.companyId, code, deletedAt: null, NOT: { id } } });
      if (dupe) throw this.validationError('code', 'validation.duplicateValue', 'Performance profile code already exists');
      data.code = code;
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw this.validationError('name', 'validation.required', 'Name is required');
      data.name = name;
    }
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr?.trim() || null;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn?.trim() || null;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.category !== undefined) {
      if (!PERFORMANCE_PROFILE_CATEGORIES.includes(dto.category as any)) throw this.validationError('category', 'validation.invalidValue', 'Invalid category');
      data.category = dto.category;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
      data.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    const updated = await this.prisma.performanceProfile.update({ where: { id }, data });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'UPDATE',
      entity: 'PerformanceProfile',
      entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId, previous: { code: existing.code, name: existing.name, category: existing.category, isActive: existing.isActive }, next: data }),
    });

    return updated;
  }

  async deactivate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (!existing.isActive) throw this.validationError('isActive', 'validation.invalidState', 'Profile is already inactive');
    const updated = await this.prisma.performanceProfile.update({ where: { id }, data: { isActive: false, status: 'INACTIVE', updatedById: userId ?? null } });
    await this.auditService.log({
      userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfile', entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId, action: 'deactivate', code: existing.code }),
    });
    return updated;
  }

  async activate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (existing.isActive) throw this.validationError('isActive', 'validation.invalidState', 'Profile is already active');
    const updated = await this.prisma.performanceProfile.update({ where: { id }, data: { isActive: true, status: 'ACTIVE', updatedById: userId ?? null } });
    await this.auditService.log({
      userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfile', entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId, action: 'activate', code: existing.code }),
    });
    return updated;
  }
}
