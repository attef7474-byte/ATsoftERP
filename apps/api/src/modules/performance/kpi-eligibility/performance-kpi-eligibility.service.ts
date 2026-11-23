import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CreatePerformanceProfileKpiEligibilityDto } from '../dto/create-performance-profile-kpi-eligibility.dto';
import { UpdatePerformanceProfileKpiEligibilityDto } from '../dto/update-performance-profile-kpi-eligibility.dto';

@Injectable()
export class PerformanceKpiEligibilityService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private validation(field: string, code: string, message: string) {
    return new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: [{ field, code, message }] });
  }

  private parseDate(value: string | undefined | null, field: string) {
    if (value === undefined || value === null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw this.validation(field, 'validation.invalidDate', `Invalid ${field}`);
    return d;
  }

  async create(dto: CreatePerformanceProfileKpiEligibilityDto, ctx: ActiveOperationalContext, userId?: string) {
    const profile = await this.prisma.performanceProfile.findFirst({ where: { id: dto.performanceProfileId, companyId: ctx.companyId, deletedAt: null } });
    if (!profile) throw this.validation('performanceProfileId', 'validation.invalidReference', 'Performance profile not found');
    const kpi = await this.prisma.performanceKpiDefinition.findFirst({ where: { id: dto.kpiDefinitionId, companyId: ctx.companyId, deletedAt: null } });
    if (!kpi) throw this.validation('kpiDefinitionId', 'validation.invalidReference', 'KPI definition not found');
    const effectiveFrom = this.parseDate(dto.effectiveFrom, 'effectiveFrom');
    const effectiveTo = this.parseDate(dto.effectiveTo, 'effectiveTo');
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw this.validation('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');
    const existing = await this.prisma.performanceProfileKpiEligibility.findFirst({ where: { companyId: ctx.companyId, performanceProfileId: dto.performanceProfileId, kpiDefinitionId: dto.kpiDefinitionId, deletedAt: null } });
    if (existing) throw this.validation('kpiDefinitionId', 'validation.duplicateValue', 'KPI eligibility already exists for this profile');

    const row = await this.prisma.performanceProfileKpiEligibility.create({
      data: {
        companyId: ctx.companyId, performanceProfileId: dto.performanceProfileId, kpiDefinitionId: dto.kpiDefinitionId,
        isRequired: dto.isRequired ?? false, isEnabled: dto.isEnabled ?? true, effectiveFrom, effectiveTo,
        notes: dto.notes?.trim() || null, createdById: userId ?? null, updatedById: userId ?? null,
      },
      include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } }, kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, measurementUnit: true, direction: true, status: true } } },
    });
    await this.audit.log({ userId: userId ?? 'system', action: 'CREATE', entity: 'PerformanceProfileKpiEligibility', entityId: row.id, details: JSON.stringify({ companyId: ctx.companyId, profileId: row.performanceProfileId, kpiId: row.kpiDefinitionId, isEnabled: row.isEnabled }) });
    return row;
  }

  async findAll(query: any, ctx: ActiveOperationalContext) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    if (query.performanceProfileId) where.performanceProfileId = String(query.performanceProfileId);
    if (query.kpiDefinitionId) where.kpiDefinitionId = String(query.kpiDefinitionId);
    if (query.isEnabled !== undefined) where.isEnabled = String(query.isEnabled) === 'true';
    const [data, total] = await Promise.all([
      this.prisma.performanceProfileKpiEligibility.findMany({
        where, skip, take: limit, orderBy: [{ isEnabled: 'desc' }, { createdAt: 'desc' }],
        include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, category: true } }, kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, measurementUnit: true, direction: true, status: true, isActive: true } } },
      }),
      this.prisma.performanceProfileKpiEligibility.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const row = await this.prisma.performanceProfileKpiEligibility.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } }, kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, measurementUnit: true, direction: true, status: true, isActive: true } } },
    });
    if (!row) throw new NotFoundException({ messageKey: 'performance.kpiEligibilityNotFound', message: 'KPI eligibility not found' });
    return row;
  }

  async update(id: string, dto: UpdatePerformanceProfileKpiEligibilityDto, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    const data: any = { updatedById: userId ?? null };
    if (dto.performanceProfileId !== undefined || dto.kpiDefinitionId !== undefined) {
      throw this.validation('kpiDefinitionId', 'validation.immutable', 'Profile/KPI reference is immutable; create a new eligibility');
    }
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.effectiveFrom !== undefined) data.effectiveFrom = this.parseDate(dto.effectiveFrom, 'effectiveFrom');
    if (dto.effectiveTo !== undefined) data.effectiveTo = this.parseDate(dto.effectiveTo, 'effectiveTo');
    const ef = data.effectiveFrom !== undefined ? data.effectiveFrom : existing.effectiveFrom;
    const et = data.effectiveTo !== undefined ? data.effectiveTo : existing.effectiveTo;
    if (ef && et && et < ef) throw this.validation('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');
    const updated = await this.prisma.performanceProfileKpiEligibility.update({ where: { id }, data, include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true } }, kpiDefinition: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, domain: true, measurementUnit: true, direction: true, status: true } } } });
    await this.audit.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfileKpiEligibility', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, before: { isEnabled: existing.isEnabled, isRequired: existing.isRequired }, after: { isEnabled: updated.isEnabled, isRequired: updated.isRequired } }) });
    return updated;
  }

  async deactivate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (!existing.isEnabled) throw this.validation('isEnabled', 'validation.invalidState', 'Eligibility is already disabled');
    const updated = await this.prisma.performanceProfileKpiEligibility.update({ where: { id }, data: { isEnabled: false, updatedById: userId ?? null } });
    await this.audit.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfileKpiEligibility', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, action: 'deactivate' }) });
    return updated;
  }

  async activate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (existing.isEnabled) throw this.validation('isEnabled', 'validation.invalidState', 'Eligibility is already enabled');
    const updated = await this.prisma.performanceProfileKpiEligibility.update({ where: { id }, data: { isEnabled: true, updatedById: userId ?? null } });
    await this.audit.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceProfileKpiEligibility', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, action: 'activate' }) });
    return updated;
  }
}
