import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
  ) {}

  async create(dto: CreateCompanyDto, ctx: ActiveOperationalContext) {
    this.assertSystemAdministration(ctx);
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('COMPANY');
    const existing = await this.prisma.company.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Company code already exists');
    return this.prisma.company.create({ data: { ...dto, code } });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (ctx.source !== 'SUPER_ADMIN') where.id = ctx.companyId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { _count: { select: { branches: true, departments: true, users: true, warehouses: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    if (ctx.source !== 'SUPER_ADMIN' && id !== ctx.companyId) {
      throw new NotFoundException('Company not found');
    }
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { branches: true, departments: true, users: true, warehouses: true, machines: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto, ctx: ActiveOperationalContext) {
    this.assertSystemAdministration(ctx);
    await this.findOne(id, ctx);
    return this.prisma.company.update({ where: { id }, data: dto });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    this.assertSystemAdministration(ctx);
    await this.findOne(id, ctx);
    await this.prisma.company.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Company deleted successfully' };
  }

  private assertSystemAdministration(ctx: ActiveOperationalContext) {
    if (ctx.source !== 'SUPER_ADMIN') {
      throw new ForbiddenException({ messageKey: 'organization.systemAdministrationRequired' });
    }
  }
}
