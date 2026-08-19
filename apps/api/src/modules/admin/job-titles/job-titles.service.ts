import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateJobTitleDto } from './dto/create-job-title.dto';
import { UpdateJobTitleDto } from './dto/update-job-title.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class JobTitlesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateJobTitleDto, ctx: ActiveOperationalContext, userId?: string) {
    const existing = await this.prisma.jobTitle.findFirst({
      where: { companyId: ctx.companyId, code: dto.code.trim(), deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Job title code already exists');

    const jobTitle = await this.prisma.jobTitle.create({
      data: {
        companyId: ctx.companyId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        nameAr: dto.nameAr?.trim() ?? null,
        nameEn: dto.nameEn?.trim() ?? null,
        category: dto.category ?? 'OPERATIONAL',
        description: dto.description?.trim() ?? null,
        isActive: dto.isActive ?? true,
      },
      include: { company: { select: { id: true, name: true, code: true } } },
    });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'CREATE',
      entity: 'JobTitle',
      entityId: jobTitle.id,
      details: JSON.stringify({ code: jobTitle.code, name: jobTitle.name, companyId: ctx.companyId }),
    });

    return jobTitle;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; category?: string; isActive?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { nameAr: { contains: query.search } },
        { nameEn: { contains: query.search } },
      ];
    }
    if (query.category) where.category = query.category;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.jobTitle.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.jobTitle.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const jobTitle = await this.prisma.jobTitle.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, code: true } },
        assignments: {
          where: { deletedAt: null },
          select: { id: true, personnelId: true, assignmentType: true, effectiveFrom: true, effectiveTo: true },
          orderBy: { effectiveFrom: 'desc' },
        },
        _count: { select: { assignments: true } },
      },
    });
    if (!jobTitle) {
      throw new NotFoundException({ messageKey: 'organization.jobTitleNotFound', message: 'Job title not found' });
    }
    return jobTitle;
  }

  async update(id: string, dto: UpdateJobTitleDto, ctx: ActiveOperationalContext, userId?: string) {
    await this.findOne(id, ctx);

    if (dto.code) {
      const existing = await this.prisma.jobTitle.findFirst({
        where: { companyId: ctx.companyId, code: dto.code.trim(), deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Job title code already exists');
    }

    const data: any = {};
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr?.trim() ?? null;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn?.trim() ?? null;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description?.trim() ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const jobTitle = await this.prisma.jobTitle.update({
      where: { id },
      data,
      include: { company: { select: { id: true, name: true, code: true } } },
    });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'UPDATE',
      entity: 'JobTitle',
      entityId: id,
      details: JSON.stringify({ ...dto, companyId: ctx.companyId }),
    });

    return jobTitle;
  }

  async remove(id: string, ctx: ActiveOperationalContext, userId?: string) {
    const jobTitle = await this.findOne(id, ctx);

    const assignmentCount = await this.prisma.operationalPersonAssignment.count({
      where: { jobTitleId: id, deletedAt: null },
    });
    if (assignmentCount > 0) {
      throw this.validationError('jobTitleId', 'validation.hasDependencies', 'Cannot delete job title with active assignments');
    }

    await this.prisma.jobTitle.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditService.log({
      userId: userId ?? 'system',
      action: 'DELETE',
      entity: 'JobTitle',
      entityId: id,
      details: JSON.stringify({ code: jobTitle.code, name: jobTitle.name, companyId: ctx.companyId }),
    });

    return { message: 'Job title deleted successfully' };
  }
}
