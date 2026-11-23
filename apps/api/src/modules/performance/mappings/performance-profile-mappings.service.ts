import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CreatePerformanceProfileMappingDto, PERFORMANCE_MAPPING_TARGET_TYPES } from '../dto/create-performance-profile-mapping.dto';
import { UpdatePerformanceProfileMappingDto } from '../dto/update-performance-profile-mapping.dto';

@Injectable()
export class PerformanceProfileMappingsService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private normalizeTarget(dto: { targetType?: string; jobTitleId?: string | null; targetCode?: string | null }) {
    const targetType = dto.targetType;
    if (!targetType || !PERFORMANCE_MAPPING_TARGET_TYPES.includes(targetType as any)) {
      throw this.validationError('targetType', 'validation.invalidValue', 'Invalid targetType');
    }
    let jobTitleId: string | null = null;
    let targetCode: string | null = null;
    if (targetType === 'JOB_TITLE') {
      if (!dto.jobTitleId) throw this.validationError('jobTitleId', 'validation.required', 'jobTitleId is required for JOB_TITLE mapping');
      jobTitleId = dto.jobTitleId;
    } else {
      const code = (dto.targetCode ?? '').trim().toUpperCase();
      if (!code) throw this.validationError('targetCode', 'validation.required', 'targetCode is required for this targetType');
      targetCode = code;
    }
    return { targetType, jobTitleId, targetCode };
  }

  private async assertNoOverlap(params: {
    companyId: string;
    targetType: string;
    jobTitleId: string | null;
    targetCode: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    excludeId?: string;
  }) {
    const where: any = {
      companyId: params.companyId,
      targetType: params.targetType,
      deletedAt: null,
      status: 'ACTIVE',
      isActive: true,
    };
    if (params.excludeId) where.NOT = { id: params.excludeId };
    if (params.targetType === 'JOB_TITLE') where.jobTitleId = params.jobTitleId;
    else where.targetCode = params.targetCode;

    // overlap: existing.effectiveFrom < newEnd AND (existing.effectiveTo is null OR existing.effectiveTo > newStart)
    const newEnd = params.effectiveTo ?? new Date('9999-12-31T00:00:00.000Z');
    where.effectiveFrom = { lt: newEnd };
    where.OR = [{ effectiveTo: null }, { effectiveTo: { gt: params.effectiveFrom } }];

    const existing = await this.prisma.performanceProfileMapping.findFirst({ where, select: { id: true } });
    if (existing) {
      throw this.validationError('effectiveFrom', 'validation.overlap', 'Overlapping active mapping exists for the same target');
    }
  }

  async create(dto: CreatePerformanceProfileMappingDto, ctx: ActiveOperationalContext, userId?: string) {
    const { targetType, jobTitleId, targetCode } = this.normalizeTarget(dto);
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (Number.isNaN(effectiveFrom.getTime())) throw this.validationError('effectiveFrom', 'validation.invalidDate', 'Invalid effectiveFrom');
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) throw this.validationError('effectiveTo', 'validation.invalidDate', 'Invalid effectiveTo');
    if (effectiveTo && effectiveTo < effectiveFrom) throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');

    const profile = await this.prisma.performanceProfile.findFirst({ where: { id: dto.performanceProfileId, companyId: ctx.companyId, deletedAt: null } });
    if (!profile) throw this.validationError('performanceProfileId', 'validation.invalidReference', 'Performance profile not found');

    if (targetType === 'JOB_TITLE' && jobTitleId) {
      const jt = await this.prisma.jobTitle.findFirst({ where: { id: jobTitleId, companyId: ctx.companyId, deletedAt: null } });
      if (!jt) throw this.validationError('jobTitleId', 'validation.invalidReference', 'Job title not found in active company');
    }

    const isActive = dto.isActive ?? true;
    const status = isActive ? 'ACTIVE' : 'INACTIVE';
    if (isActive) {
      await this.assertNoOverlap({ companyId: ctx.companyId, targetType, jobTitleId, targetCode, effectiveFrom, effectiveTo });
    }

    const mapping = await this.prisma.performanceProfileMapping.create({
      data: {
        companyId: ctx.companyId,
        performanceProfileId: dto.performanceProfileId,
        targetType,
        jobTitleId,
        targetCode,
        priority: dto.priority ?? 100,
        effectiveFrom,
        effectiveTo,
        isActive,
        status,
        notes: dto.notes?.trim() || null,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
      include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } }, jobTitle: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } },
    });

    await this.auditService.log({
      userId: userId ?? 'system', action: 'CREATE', entity: 'PerformanceProfileMapping', entityId: mapping.id,
      details: JSON.stringify({ companyId: ctx.companyId, profileId: mapping.performanceProfileId, targetType, jobTitleId, targetCode, effectiveFrom, effectiveTo }),
    });
    return mapping;
  }

  async findAll(query: { page?: number; limit?: number; performanceProfileId?: string; targetType?: string; jobTitleId?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    if (query.performanceProfileId) where.performanceProfileId = query.performanceProfileId;
    if (query.targetType) where.targetType = query.targetType;
    if (query.jobTitleId) where.jobTitleId = query.jobTitleId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    const [data, total] = await Promise.all([
      this.prisma.performanceProfileMapping.findMany({
        where, skip, take: limit, orderBy: [{ priority: 'asc' }, { effectiveFrom: 'desc' }],
        include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, category: true } }, jobTitle: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } },
      }),
      this.prisma.performanceProfileMapping.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const mapping = await this.prisma.performanceProfileMapping.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, category: true } }, jobTitle: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } },
    });
    if (!mapping) throw new NotFoundException({ messageKey: 'performance.mappingNotFound', message: 'Performance profile mapping not found' });
    return mapping;
  }

  async update(id: string, dto: UpdatePerformanceProfileMappingDto, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    const targetType = dto.targetType ?? existing.targetType;
    const normalized = this.normalizeTarget({
      targetType,
      jobTitleId: dto.jobTitleId !== undefined ? dto.jobTitleId : existing.jobTitleId,
      targetCode: dto.targetCode !== undefined ? dto.targetCode : existing.targetCode,
    });
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : existing.effectiveTo;
    if (Number.isNaN(effectiveFrom.getTime())) throw this.validationError('effectiveFrom', 'validation.invalidDate', 'Invalid effectiveFrom');
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) throw this.validationError('effectiveTo', 'validation.invalidDate', 'Invalid effectiveTo');
    if (effectiveTo && effectiveTo < effectiveFrom) throw this.validationError('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');

    const performanceProfileId = dto.performanceProfileId ?? existing.performanceProfileId;
    const profile = await this.prisma.performanceProfile.findFirst({ where: { id: performanceProfileId, companyId: ctx.companyId, deletedAt: null } });
    if (!profile) throw this.validationError('performanceProfileId', 'validation.invalidReference', 'Performance profile not found');
    if (normalized.targetType === 'JOB_TITLE' && normalized.jobTitleId) {
      const jt = await this.prisma.jobTitle.findFirst({ where: { id: normalized.jobTitleId, companyId: ctx.companyId, deletedAt: null } });
      if (!jt) throw this.validationError('jobTitleId', 'validation.invalidReference', 'Job title not found in active company');
    }

    const isActive = dto.isActive !== undefined ? dto.isActive : existing.isActive;
    const status = isActive ? 'ACTIVE' : 'INACTIVE';
    if (isActive) {
      await this.assertNoOverlap({ companyId: ctx.companyId, targetType: normalized.targetType, jobTitleId: normalized.jobTitleId, targetCode: normalized.targetCode, effectiveFrom, effectiveTo, excludeId: id });
    }

    const updated = await this.prisma.performanceProfileMapping.update({
      where: { id },
      data: {
        performanceProfileId,
        targetType: normalized.targetType,
        jobTitleId: normalized.jobTitleId,
        targetCode: normalized.targetCode,
        priority: dto.priority !== undefined ? dto.priority : existing.priority,
        effectiveFrom,
        effectiveTo,
        isActive,
        status,
        notes: dto.notes !== undefined ? (dto.notes?.trim() || null) : existing.notes,
        updatedById: userId ?? null,
      },
      include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } }, jobTitle: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } } },
    });

    await this.auditService.log({
      userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfileMapping', entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId, previous: { profileId: existing.performanceProfileId, targetType: existing.targetType, jobTitleId: existing.jobTitleId, targetCode: existing.targetCode, effectiveFrom: existing.effectiveFrom, effectiveTo: existing.effectiveTo, isActive: existing.isActive }, next: { profileId: performanceProfileId, ...normalized, effectiveFrom, effectiveTo, isActive } }),
    });
    return updated;
  }

  async deactivate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (!existing.isActive) throw this.validationError('isActive', 'validation.invalidState', 'Mapping is already inactive');
    const updated = await this.prisma.performanceProfileMapping.update({ where: { id }, data: { isActive: false, status: 'INACTIVE', updatedById: userId ?? null } });
    await this.auditService.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfileMapping', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, action: 'deactivate' }) });
    return updated;
  }

  async activate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (existing.isActive) throw this.validationError('isActive', 'validation.invalidState', 'Mapping is already active');
    const effectiveFrom = existing.effectiveFrom;
    const effectiveTo = existing.effectiveTo;
    await this.assertNoOverlap({ companyId: ctx.companyId, targetType: existing.targetType, jobTitleId: existing.jobTitleId, targetCode: existing.targetCode, effectiveFrom, effectiveTo, excludeId: id });
    const updated = await this.prisma.performanceProfileMapping.update({ where: { id }, data: { isActive: true, status: 'ACTIVE', updatedById: userId ?? null } });
    await this.auditService.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfileMapping', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, action: 'activate' }) });
    return updated;
  }
}
