import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateDepartmentDto, ctx: ActiveOperationalContext) {
    await this.validateReferences({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      administrationId: dto.administrationId,
      parentId: dto.parentId,
    }, ctx);

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('DEPARTMENT'));

    const { companyId: _companyId, branchId: _branchId, ...rest } = dto;
    try {
      return await this.prisma.department.create({ data: { ...rest, companyId: ctx.companyId, branchId: ctx.branchId, code } });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException({
          messageKey: 'validation.duplicateValue',
          message: 'Department code already exists',
          errors: [{ field: 'code', code: 'validation.duplicateValue', message: 'Department code already exists' }],
        });
      }
      throw error;
    }
  }

  private async validateReferences(refs: {
    companyId?: string;
    branchId?: string;
    administrationId?: string;
    parentId?: string;
  }, ctx: ActiveOperationalContext) {
    if (refs.companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: ctx.companyId, deletedAt: null } });
      if (!company) throw this.validationError('companyId', 'validation.invalidReference', 'Company not found');
    }

    if (refs.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: refs.branchId, companyId: ctx.companyId, deletedAt: null } });
      if (!branch) throw this.validationError('branchId', 'validation.invalidReference', 'Branch not found');
      if (refs.companyId && branch.companyId !== refs.companyId) {
        throw this.validationError('branchId', 'validation.invalidReference', 'Branch does not belong to the selected company');
      }
    }

    if (refs.administrationId) {
      const admin = await this.prisma.administration.findFirst({ where: { id: refs.administrationId, branchId: ctx.branchId, deletedAt: null } });
      if (!admin) throw this.validationError('administrationId', 'validation.invalidReference', 'Administration not found');
      if (refs.branchId && admin.branchId !== refs.branchId) {
        throw this.validationError('administrationId', 'validation.invalidReference', 'Administration does not belong to the selected branch');
      }
    }

    if (refs.parentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: refs.parentId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } });
      if (!parent) throw this.validationError('parentId', 'validation.invalidReference', 'Parent department not found');
      if (refs.companyId && parent.companyId !== refs.companyId) {
        throw this.validationError('parentId', 'validation.invalidReference', 'Parent department does not belong to the selected company');
      }
    }
  }

  async findAll(query: { page?: number; limit?: number; search?: string; administrationId?: string; classification?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.search) where.name = { contains: query.search };
    if (query.administrationId) where.administrationId = query.administrationId;
    if (query.classification) where.classification = query.classification;

    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          administration: { select: { id: true, name: true } },
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true, users: true } },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        administration: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, code: true } },
        _count: { select: { children: true, users: true, machines: true } },
      },
    });
    if (!department) {
      throw new NotFoundException({ messageKey: 'organization.departmentNotFound', message: 'Department not found' });
    }
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, ctx: ActiveOperationalContext) {
    const department = await this.findOne(id, ctx);

    await this.validateReferences({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      administrationId: dto.administrationId ?? department.administrationId ?? undefined,
      parentId: dto.parentId ?? department.parentId ?? undefined,
    }, ctx);

    const code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.department.findFirst({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Department code already exists');
      dto = { ...dto, code };
    }

    const { companyId: _companyId, branchId: _branchId, ...data } = dto;
    return this.prisma.department.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        administration: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Department deleted successfully' };
  }

  async getTree(ctx: ActiveOperationalContext) {
    const departments = await this.prisma.department.findMany({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: { children: { where: { deletedAt: null }, select: { id: true, name: true, code: true } } },
    });
    return departments.filter((d) => !d.parentId);
  }

  async classify(id: string, classification: string, ctx: ActiveOperationalContext) {
    const allowed = ['OPERATIONAL', 'MANAGEMENT', 'AREA', 'PROCESS', 'SECTION', 'UNIT', 'WORKSHOP'];
    if (!allowed.includes(classification)) {
      throw this.validationError('classification', 'validation.invalidValue', `Classification must be one of: ${allowed.join(', ')}`);
    }

    await this.findOne(id, ctx);

    return this.prisma.department.update({
      where: { id },
      data: { classification },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }
}
