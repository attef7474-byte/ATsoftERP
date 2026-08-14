import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class BranchesService {
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

  async create(dto: CreateBranchDto, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw this.validationError('companyId', 'validation.invalidReference', 'Company not found');

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('BRANCH'));

    const existing = await this.prisma.branch.findFirst({
      where: { companyId: ctx.companyId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Branch code already exists');

    const { companyId: _companyId, ...rest } = dto;
    return this.prisma.branch.create({ data: { ...rest, companyId: ctx.companyId, code } });
  }

  async findAll(query: { page?: number; limit?: number; search?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (query.search) where.name = { contains: query.search };

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null },
      include: { company: { select: { id: true, name: true, code: true } } },
    });
    if (!branch) {
      throw new NotFoundException({ messageKey: 'organization.branchNotFound', message: 'Branch not found' });
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, ctx: ActiveOperationalContext) {
    const branch = await this.findOne(id, ctx);

    const code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.branch.findFirst({
        where: { companyId: ctx.companyId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Branch code already exists');
      dto = { ...dto, code };
    }
    const { companyId: _companyId, ...data } = dto;
    return this.prisma.branch.update({ where: { id: branch.id }, data });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Branch deleted successfully' };
  }
}
