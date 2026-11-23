import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CreatePerformanceKpiDto } from '../dto/create-performance-kpi.dto';
import { UpdatePerformanceKpiDto } from '../dto/update-performance-kpi.dto';
import {
  PERFORMANCE_KPI_DOMAINS, PERFORMANCE_KPI_UNITS, PERFORMANCE_KPI_DIRECTIONS,
  PERFORMANCE_KPI_AGGREGATIONS, PERFORMANCE_KPI_CALC_MODES, PERFORMANCE_KPI_STATUSES,
} from './performance-kpi.constants';

@Injectable()
export class PerformanceKpisService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private validation(field: string, code: string, message: string) {
    return new BadRequestException({ messageKey: 'common.validationFailed', message: 'Validation failed', errors: [{ field, code, message }] });
  }

  private normalizeCode(code: string) { return code.trim().toUpperCase().replace(/\s+/g, '_'); }

  private validateEnums(dto: Partial<CreatePerformanceKpiDto>) {
    if (dto.domain && !PERFORMANCE_KPI_DOMAINS.includes(dto.domain as any)) throw this.validation('domain', 'validation.invalidValue', 'Invalid domain');
    if (dto.measurementUnit && !PERFORMANCE_KPI_UNITS.includes(dto.measurementUnit as any)) throw this.validation('measurementUnit', 'validation.invalidValue', 'Invalid measurementUnit');
    if (dto.direction && !PERFORMANCE_KPI_DIRECTIONS.includes(dto.direction as any)) throw this.validation('direction', 'validation.invalidValue', 'Invalid direction');
    if (dto.aggregationType && !PERFORMANCE_KPI_AGGREGATIONS.includes(dto.aggregationType as any)) throw this.validation('aggregationType', 'validation.invalidValue', 'Invalid aggregationType');
    if (dto.calculationMode && !PERFORMANCE_KPI_CALC_MODES.includes(dto.calculationMode as any)) throw this.validation('calculationMode', 'validation.invalidValue', 'Invalid calculationMode');
    if (dto.status && !PERFORMANCE_KPI_STATUSES.includes(dto.status as any)) throw this.validation('status', 'validation.invalidValue', 'Invalid status');
  }

  async create(dto: CreatePerformanceKpiDto, ctx: ActiveOperationalContext, userId?: string) {
    this.validateEnums(dto);
    const code = this.normalizeCode(dto.code || '');
    const name = (dto.name || '').trim();
    if (!code) throw this.validation('code', 'validation.required', 'Code is required');
    if (!name) throw this.validation('name', 'validation.required', 'Name is required');
    const sourceContractKey = (dto.sourceContractKey || '').trim();
    if (!sourceContractKey) throw this.validation('sourceContractKey', 'validation.required', 'sourceContractKey is required');
    const existing = await this.prisma.performanceKpiDefinition.findFirst({ where: { companyId: ctx.companyId, code, deletedAt: null } });
    if (existing) throw this.validation('code', 'validation.duplicateValue', 'KPI code already exists');

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveFrom && Number.isNaN(effectiveFrom.getTime())) throw this.validation('effectiveFrom', 'validation.invalidDate', 'Invalid effectiveFrom');
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) throw this.validation('effectiveTo', 'validation.invalidDate', 'Invalid effectiveTo');
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw this.validation('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');

    const status = dto.status ?? 'DRAFT';
    const isActive = dto.isActive ?? (status === 'ACTIVE');
    const row = await this.prisma.performanceKpiDefinition.create({
      data: {
        companyId: ctx.companyId, code, name,
        nameAr: dto.nameAr?.trim() || null, nameEn: dto.nameEn?.trim() || null,
        description: dto.description?.trim() || null, descriptionAr: dto.descriptionAr?.trim() || null, descriptionEn: dto.descriptionEn?.trim() || null,
        domain: dto.domain, measurementUnit: dto.measurementUnit, direction: dto.direction,
        aggregationType: dto.aggregationType, calculationMode: dto.calculationMode,
        sourceContractKey, calculationVersion: dto.calculationVersion ?? 1,
        status: isActive ? 'ACTIVE' : status, isActive, effectiveFrom, effectiveTo,
        notes: dto.notes?.trim() || null, createdById: userId ?? null, updatedById: userId ?? null,
      },
    });
    await this.audit.log({ userId: userId ?? 'system', action: 'CREATE', entity: 'PerformanceKpiDefinition', entityId: row.id, details: JSON.stringify({ companyId: ctx.companyId, code: row.code, domain: row.domain, status: row.status }) });
    return row;
  }

  async findAll(query: any, ctx: ActiveOperationalContext) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: any = { companyId: ctx.companyId, deletedAt: null };
    if (query.search) {
      const s = String(query.search);
      where.OR = [{ code: { contains: s } }, { name: { contains: s } }, { nameAr: { contains: s } }, { nameEn: { contains: s } }];
    }
    if (query.domain) where.domain = String(query.domain);
    if (query.status) where.status = String(query.status);
    if (query.isActive !== undefined) where.isActive = String(query.isActive) === 'true';
    if (query.direction) where.direction = String(query.direction);
    const [data, total] = await Promise.all([
      this.prisma.performanceKpiDefinition.findMany({
        where, skip, take: limit, orderBy: [{ isActive: 'desc' }, { domain: 'asc' }, { code: 'asc' }],
        include: { _count: { select: { profileEligibilities: { where: { deletedAt: null } } } } },
      }),
      this.prisma.performanceKpiDefinition.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const row = await this.prisma.performanceKpiDefinition.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: { profileEligibilities: { where: { deletedAt: null }, include: { performanceProfile: { select: { id: true, code: true, name: true, nameAr: true, nameEn: true, category: true } } }, orderBy: [{ isEnabled: 'desc' }, { createdAt: 'desc' }] }, _count: { select: { profileEligibilities: { where: { deletedAt: null } } } } },
    });
    if (!row) throw new NotFoundException({ messageKey: 'performance.kpiNotFound', message: 'KPI definition not found' });
    return row;
  }

  async update(id: string, dto: UpdatePerformanceKpiDto, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    this.validateEnums(dto);
    const data: any = { updatedById: userId ?? null };

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code || '');
      if (!code) throw this.validation('code', 'validation.required', 'Code is required');
      if (code !== existing.code) {
        // Code is immutable once referenced/used; safest to disallow any code change.
        throw this.validation('code', 'validation.immutable', 'KPI code is immutable');
      }
    }
    if (dto.name !== undefined) { const name = dto.name.trim(); if (!name) throw this.validation('name', 'validation.required', 'Name is required'); data.name = name; }
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr?.trim() || null;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn?.trim() || null;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.descriptionAr !== undefined) data.descriptionAr = dto.descriptionAr?.trim() || null;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn?.trim() || null;
    if (dto.domain !== undefined) data.domain = dto.domain;
    if (dto.measurementUnit !== undefined) data.measurementUnit = dto.measurementUnit;
    if (dto.direction !== undefined) data.direction = dto.direction;
    if (dto.aggregationType !== undefined) data.aggregationType = dto.aggregationType;
    if (dto.calculationMode !== undefined) data.calculationMode = dto.calculationMode;
    if (dto.sourceContractKey !== undefined) { const k = dto.sourceContractKey.trim(); if (!k) throw this.validation('sourceContractKey', 'validation.required', 'sourceContractKey is required'); data.sourceContractKey = k; }
    if (dto.calculationVersion !== undefined) data.calculationVersion = dto.calculationVersion;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.effectiveFrom !== undefined) { const d = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null; if (d && Number.isNaN(d.getTime())) throw this.validation('effectiveFrom', 'validation.invalidDate', 'Invalid effectiveFrom'); data.effectiveFrom = d; }
    if (dto.effectiveTo !== undefined) { const d = dto.effectiveTo ? new Date(dto.effectiveTo) : null; if (d && Number.isNaN(d.getTime())) throw this.validation('effectiveTo', 'validation.invalidDate', 'Invalid effectiveTo'); data.effectiveTo = d; }
    const ef = data.effectiveFrom !== undefined ? data.effectiveFrom : existing.effectiveFrom;
    const et = data.effectiveTo !== undefined ? data.effectiveTo : existing.effectiveTo;
    if (ef && et && et < ef) throw this.validation('effectiveTo', 'validation.invalidRange', 'effectiveTo must be >= effectiveFrom');

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isActive !== undefined) { data.isActive = dto.isActive; data.status = dto.isActive ? 'ACTIVE' : (data.status ?? existing.status === 'ACTIVE' ? 'DEPRECATED' : existing.status); }
    if (data.status === 'ACTIVE') data.isActive = true;
    if (data.status === 'DEPRECATED') data.isActive = false;

    const updated = await this.prisma.performanceKpiDefinition.update({ where: { id }, data });
    await this.audit.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceKpiDefinition', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, before: { code: existing.code, status: existing.status, isActive: existing.isActive }, after: { code: updated.code, status: updated.status, isActive: updated.isActive } }) });
    return updated;
  }

  async deactivate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (!existing.isActive && existing.status === 'DEPRECATED') throw this.validation('status', 'validation.invalidState', 'KPI is already deprecated/inactive');
    const updated = await this.prisma.performanceKpiDefinition.update({ where: { id }, data: { isActive: false, status: 'DEPRECATED', updatedById: userId ?? null } });
    await this.audit.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceKpiDefinition', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, action: 'deactivate', code: existing.code }) });
    return updated;
  }

  async activate(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.findOne(id, ctx);
    if (existing.isActive && existing.status === 'ACTIVE') throw this.validation('status', 'validation.invalidState', 'KPI is already active');
    const updated = await this.prisma.performanceKpiDefinition.update({ where: { id }, data: { isActive: true, status: 'ACTIVE', updatedById: userId ?? null } });
    await this.audit.log({ userId: userId ?? 'system', action: 'UPDATE', entity: 'PerformanceKpiDefinition', entityId: id, details: JSON.stringify({ companyId: ctx.companyId, action: 'activate', code: existing.code }) });
    return updated;
  }
}
