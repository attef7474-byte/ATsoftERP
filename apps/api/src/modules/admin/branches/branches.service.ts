import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
  ) {}

  async create(dto: CreateBranchDto) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('BRANCH');
    return this.prisma.branch.create({ data: { ...dto, code } });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; companyId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) where.name = { contains: query.search };
    if (query.companyId) where.companyId = query.companyId;

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true, code: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Branch deleted successfully' };
  }
}
