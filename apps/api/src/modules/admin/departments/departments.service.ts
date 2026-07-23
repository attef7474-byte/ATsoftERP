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

  async create(dto: CreateDepartmentDto) {
    if (dto.administrationId) {
      const admin = await this.prisma.administration.findUnique({ where: { id: dto.administrationId } });
      if (!admin) throw new BadRequestException('Administration not found');
      if (admin.branchId !== dto.branchId) throw new BadRequestException('Administration does not belong to the selected branch');
    }

    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('DEPARTMENT');
    return this.prisma.department.create({ data: { ...dto, code } });
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
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    if (dto.administrationId) {
      const admin = await this.prisma.administration.findUnique({ where: { id: dto.administrationId } });
      if (!admin) throw new BadRequestException('Administration not found');
      const targetBranchId = dto.branchId || (await this.prisma.department.findUnique({ where: { id } }))?.branchId;
      if (admin.branchId !== targetBranchId) throw new BadRequestException('Administration does not belong to the selected branch');
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
