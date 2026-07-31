import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

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

  async create(dto: CreateDepartmentDto) {
    await this.validateReferences({
      companyId: dto.companyId,
      branchId: dto.branchId,
      administrationId: dto.administrationId,
      parentId: dto.parentId,
    });

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('DEPARTMENT'));

    const existing = await this.prisma.department.findFirst({
      where: { companyId: dto.companyId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Department code already exists');

    return this.prisma.department.create({ data: { ...dto, code } });
  }

  private async validateReferences(refs: {
    companyId?: string;
    branchId?: string;
    administrationId?: string;
    parentId?: string;
  }) {
    if (refs.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: refs.companyId } });
      if (!company) throw this.validationError('companyId', 'validation.invalidReference', 'Company not found');
    }

    if (refs.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: refs.branchId } });
      if (!branch) throw this.validationError('branchId', 'validation.invalidReference', 'Branch not found');
      if (refs.companyId && branch.companyId !== refs.companyId) {
        throw this.validationError('branchId', 'validation.invalidReference', 'Branch does not belong to the selected company');
      }
    }

    if (refs.administrationId) {
      const admin = await this.prisma.administration.findUnique({ where: { id: refs.administrationId } });
      if (!admin) throw this.validationError('administrationId', 'validation.invalidReference', 'Administration not found');
      if (refs.branchId && admin.branchId !== refs.branchId) {
        throw this.validationError('administrationId', 'validation.invalidReference', 'Administration does not belong to the selected branch');
      }
    }

    if (refs.parentId) {
      const parent = await this.prisma.department.findUnique({ where: { id: refs.parentId } });
      if (!parent) throw this.validationError('parentId', 'validation.invalidReference', 'Parent department not found');
      if (refs.companyId && parent.companyId !== refs.companyId) {
        throw this.validationError('parentId', 'validation.invalidReference', 'Parent department does not belong to the selected company');
      }
    }
  }

  async findAll(query: { page?: number; limit?: number; search?: string; companyId?: string; branchId?: string; administrationId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) where.name = { contains: query.search };
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.administrationId) where.administrationId = query.administrationId;

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

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
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

  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.findOne(id);

    await this.validateReferences({
      companyId: dto.companyId ?? department.companyId,
      branchId: dto.branchId ?? department.branchId ?? undefined,
      administrationId: dto.administrationId ?? department.administrationId ?? undefined,
      parentId: dto.parentId ?? department.parentId ?? undefined,
    });

    const code = dto.code?.trim();
    if (code) {
      const companyId = dto.companyId ?? department.companyId;
      const existing = await this.prisma.department.findFirst({
        where: { companyId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Department code already exists');
      dto = { ...dto, code };
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        administration: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Department deleted successfully' };
  }

  async getTree(companyId: string) {
    const departments = await this.prisma.department.findMany({
      where: { companyId, deletedAt: null },
      include: { children: { where: { deletedAt: null }, select: { id: true, name: true, code: true } } },
    });
    return departments.filter((d) => !d.parentId);
  }
}
