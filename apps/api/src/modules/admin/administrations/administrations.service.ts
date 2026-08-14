import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateAdministrationDto } from './dto/create-administration.dto';
import { UpdateAdministrationDto } from './dto/update-administration.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class AdministrationsService {
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

  async create(dto: CreateAdministrationDto, ctx: ActiveOperationalContext) {
    const branch = await this.prisma.branch.findFirst({ where: { id: ctx.branchId, companyId: ctx.companyId, deletedAt: null } });
    if (!branch) throw this.validationError('branchId', 'validation.invalidReference', 'Branch not found');

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('ADMINISTRATION'));

    const existing = await this.prisma.administration.findFirst({
      where: { branchId: ctx.branchId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Administration code already exists');

    const { branchId: _branchId, ...rest } = dto;
    return this.prisma.administration.create({ data: { ...rest, branchId: ctx.branchId, code } });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, branchId: ctx.branchId, branch: { companyId: ctx.companyId } };
    if (query.search) where.name = { contains: query.search };
    if (query.status) where.status = query.status;

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

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const administration = await this.prisma.administration.findFirst({
      where: { id, branchId: ctx.branchId, branch: { companyId: ctx.companyId }, deletedAt: null },
      include: {
        branch: {
          include: { company: { select: { id: true, name: true, code: true } } },
        },
        _count: { select: { departments: true } },
      },
    });
    if (!administration) {
      throw new NotFoundException({ messageKey: 'organization.administrationNotFound', message: 'Administration not found' });
    }
    return administration;
  }

  async update(id: string, dto: UpdateAdministrationDto, ctx: ActiveOperationalContext) {
    const administration = await this.findOne(id, ctx);

    const code = dto.code?.trim();
    if (code) {
      const existing = await this.prisma.administration.findFirst({
        where: { branchId: ctx.branchId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Administration code already exists');
      dto = { ...dto, code };
    }

    const { branchId: _branchId, ...data } = dto;
    return this.prisma.administration.update({
      where: { id },
      data,
      include: {
        branch: {
          include: { company: { select: { id: true, name: true, code: true } } },
        },
      },
    });
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);

    const deptCount = await this.prisma.department.count({ where: { administrationId: id, deletedAt: null } });
    if (deptCount > 0) {
      throw new ConflictException({
        messageKey: 'organization.cannotDeleteAdministrationWithDepartments',
        message: 'Cannot delete administration with active departments. Deactivate departments first.',
      });
    }

    await this.prisma.administration.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Administration deleted successfully' };
  }
}
