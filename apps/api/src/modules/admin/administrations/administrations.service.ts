import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateAdministrationDto } from './dto/create-administration.dto';
import { UpdateAdministrationDto } from './dto/update-administration.dto';

@Injectable()
export class AdministrationsService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
  ) {}

  async create(dto: CreateAdministrationDto) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('ADMINISTRATION');
    return this.prisma.administration.create({ data: { ...dto, code } });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; companyId?: string; branchId?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) where.name = { contains: query.search };
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;
    if (query.companyId) {
      where.branch = { companyId: query.companyId };
    }

    const [data, total] = await Promise.all([
      this.prisma.administration.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            include: { company: { select: { id: true, name: true, code: true } } },
          },
          _count: { select: { departments: true } },
        },
      }),
      this.prisma.administration.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const administration = await this.prisma.administration.findUnique({
      where: { id },
      include: {
        branch: {
          include: { company: { select: { id: true, name: true, code: true } } },
        },
        _count: { select: { departments: true } },
      },
    });
    if (!administration) throw new NotFoundException('Administration not found');
    return administration;
  }

  async update(id: string, dto: UpdateAdministrationDto) {
    await this.findOne(id);
    return this.prisma.administration.update({
      where: { id },
      data: dto,
      include: {
        branch: {
          include: { company: { select: { id: true, name: true, code: true } } },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const deptCount = await this.prisma.department.count({ where: { administrationId: id, deletedAt: null } });
    if (deptCount > 0) {
      throw new NotFoundException('Cannot delete administration with active departments. Deactivate departments first.');
    }

    await this.prisma.administration.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Administration deleted successfully' };
  }
}
