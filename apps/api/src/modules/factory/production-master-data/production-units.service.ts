import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { CreateProductionUnitDto } from './dto/create-production-unit.dto';
import { UpdateProductionUnitDto } from './dto/update-production-unit.dto';
import { ProductionUnitQueryDto } from './dto/production-unit-query.dto';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class ProductionUnitsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ messageKey: 'production.unitNotFound', message: 'Production unit not found' });
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const unit = await this.prisma.productionUnit.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!unit) throw this.notFound();
    return unit;
  }

  async create(dto: CreateProductionUnitDto, userId: string, ctx: ActiveOperationalContext) {
    const company = await this.prisma.company.findUnique({ where: { id: ctx.companyId } });
    if (!company) throw new NotFoundException({ messageKey: 'organization.companyNotFound', message: 'Company not found' });

    const code = dto.code.trim();
    const existing = await this.prisma.productionUnit.findFirst({
      where: { code, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'production.codeExists', 'Production unit code already exists');

    const unit = await this.prisma.productionUnit.create({
      data: {
        code,
        name: dto.name,
        abbreviation: dto.abbreviation ?? null,
        description: dto.description ?? null,
        decimals: dto.decimals ?? 2,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
      },
    });
    await this.audit.log(userId, 'CREATE', 'ProductionUnit', unit.id, { code: unit.code });
    return unit;
  }

  async findAll(query: ProductionUnitQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { abbreviation: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.productionUnit.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.productionUnit.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const unit = await this.findOwned(id, ctx);
    return this.prisma.productionUnit.findUnique({
      where: { id: unit.id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProductionUnitDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwned(id, ctx);
    if (dto.code && dto.code.trim() !== existing.code) {
      const duplicate = await this.prisma.productionUnit.findFirst({
        where: { code: dto.code.trim(), companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (duplicate && duplicate.id !== id) {
        throw this.validationError('code', 'production.codeExists', 'Production unit code already exists');
      }
    }

    const unit = await this.prisma.productionUnit.update({
      where: { id },
      data: {
        code: dto.code?.trim() ?? existing.code,
        name: dto.name ?? existing.name,
        abbreviation: dto.abbreviation !== undefined ? dto.abbreviation : existing.abbreviation,
        description: dto.description !== undefined ? dto.description : existing.description,
        decimals: dto.decimals !== undefined ? dto.decimals : existing.decimals,
      },
    });
    await this.audit.log(userId, 'UPDATE', 'ProductionUnit', id, { code: unit.code });
    return unit;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const referenced = await this.prisma.productionProductDefinition.count({
      where: { defaultUnitId: id, deletedAt: null },
    });
    if (referenced > 0) {
      throw new ConflictException({ messageKey: 'production.unitInUse', message: 'Unit is referenced by production product definitions' });
    }
    await this.prisma.productionUnit.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(userId, 'DELETE', 'ProductionUnit', id);
    return { message: 'Production unit deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const unit = await this.prisma.productionUnit.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit.log(userId, 'ACTIVATE', 'ProductionUnit', id);
    return unit;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const unit = await this.prisma.productionUnit.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.log(userId, 'DEACTIVATE', 'ProductionUnit', id);
    return unit;
  }
}
