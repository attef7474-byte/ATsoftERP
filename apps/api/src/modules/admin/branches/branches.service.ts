import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateBranchDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw this.validationError('companyId', 'validation.invalidReference', 'Company not found');

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('BRANCH'));

    const existing = await this.prisma.branch.findFirst({
      where: { companyId: dto.companyId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Branch code already exists');

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
    if (!branch) {
      throw new NotFoundException({ messageKey: 'organization.branchNotFound', message: 'Branch not found' });
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.findOne(id);

    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw this.validationError('companyId', 'validation.invalidReference', 'Company not found');
    }

    const code = dto.code?.trim();
    if (code) {
      const companyId = dto.companyId ?? branch.companyId;
      const existing = await this.prisma.branch.findFirst({
        where: { companyId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Branch code already exists');
      dto = { ...dto, code };
    }

    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Branch deleted successfully' };
  }
}
