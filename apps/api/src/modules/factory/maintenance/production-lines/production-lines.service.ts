import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateProductionLineDto } from './dto/create-production-line.dto';
import { UpdateProductionLineDto } from './dto/update-production-line.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class ProductionLinesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
  ) {}

  /**
   * Production Lines are branch-owned organizational records: the active
   * context is always branch-scoped (the interceptor requires both headers),
   * and every create stores ctx.companyId / ctx.branchId. A row is in-context
   * only when it exactly matches the active company and branch.
   */
  private isInContext(
    item: { companyId: string; branchId: string },
    ctx: ActiveOperationalContext,
  ): boolean {
    return item.companyId === ctx.companyId && item.branchId === ctx.branchId;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const item = await this.prisma.productionLine.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        administration: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true, classification: true } },
        operationType: { select: { id: true, name: true, code: true } },
        costCenter: { select: { id: true, name: true, code: true } },
      },
    });
    if (!item || item.deletedAt || !this.isInContext(item, ctx)) {
      throw new NotFoundException('Production line not found');
    }
    return item;
  }

  async create(dto: CreateProductionLineDto, userId: string, ctx: ActiveOperationalContext) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('PRODUCTION_LINE');
    const existing = await this.prisma.productionLine.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Production line code already exists');

    // Client-supplied tenant fields are never trusted: companyId/branchId are
    // always written from the active operational context.
    const { companyId: _ignoredCompanyId, branchId: _ignoredBranchId, ...rest } = dto;
    await this.validateHierarchy(rest, ctx);

    const item = await this.prisma.productionLine.create({
      data: { ...rest, code, companyId: ctx.companyId, branchId: ctx.branchId },
    });
    await this.auditService.log(userId, 'CREATE', 'ProductionLine', item.id,
      { message: `Created production line: ${item.code}`, companyId: ctx.companyId, branchId: ctx.branchId });
    return item;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    companyId?: string; branchId?: string; administrationId?: string;
    departmentId?: string; operationTypeId?: string; costCenterId?: string;
    status?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Client-supplied query.companyId / query.branchId are deliberately ignored:
    // the authoritative scope is always the active operational context.
    const where: any = { deletedAt: null, companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.administrationId) where.administrationId = query.administrationId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.operationTypeId) where.operationTypeId = query.operationTypeId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.productionLine.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          administration: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true, classification: true } },
          operationType: { select: { id: true, name: true, code: true } },
          costCenter: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.productionLine.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateProductionLineDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwned(id, ctx);
    if (dto.code && dto.code !== existing.code) {
      throw new BadRequestException('Code cannot be changed after creation');
    }
    // Re-pointing tenant fields is impossible: companyId/branchId are stripped.
    const { code, companyId: _ignoredCompanyId, branchId: _ignoredBranchId, ...rest } = dto;
    await this.validateHierarchy(rest, ctx);
    const item = await this.prisma.productionLine.update({
      where: { id }, data: rest,
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        administration: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true, classification: true } },
        operationType: { select: { id: true, name: true, code: true } },
        costCenter: { select: { id: true, name: true, code: true } },
      },
    });
    await this.auditService.log(userId, 'UPDATE', 'ProductionLine', id,
      { message: `Updated production line: ${item.code}`, companyId: ctx.companyId, branchId: ctx.branchId });
    return item;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const machineCount = await this.prisma.machine.count({ where: { productionLineId: id, deletedAt: null } });
    if (machineCount > 0) throw new ConflictException('Cannot delete production line with linked machines');
    const requestCount = await this.prisma.maintenanceRequest.count({ where: { productionLineId: id, deletedAt: null } });
    if (requestCount > 0) throw new ConflictException('Cannot delete production line with linked maintenance requests');
    await this.prisma.productionLine.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'ProductionLine', id,
      { message: `Deleted production line: ${id}`, companyId: ctx.companyId, branchId: ctx.branchId });
    return { message: 'Production line deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const item = await this.prisma.productionLine.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'ProductionLine', id, { companyId: ctx.companyId, branchId: ctx.branchId });
    return item;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwned(id, ctx);
    const item = await this.prisma.productionLine.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'ProductionLine', id, { companyId: ctx.companyId, branchId: ctx.branchId });
    return item;
  }

  private async validateHierarchy(dto: {
    administrationId?: string | null; departmentId?: string | null;
    operationTypeId?: string | null; costCenterId?: string | null;
  }, ctx: ActiveOperationalContext) {
    // Management-chart references must belong to the same company/branch as the
    // production line itself, which is always the active operational context.
    if (dto.operationTypeId) {
      const ot = await this.prisma.operationType.findFirst({
        where: { id: dto.operationTypeId, deletedAt: null },
      });
      if (!ot) throw new BadRequestException('Operation type not found');
    }

    if (dto.costCenterId) {
      const cc = await this.prisma.costCenter.findFirst({
        where: { id: dto.costCenterId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!cc) throw new BadRequestException('Cost center must belong to the active company');
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!dept) throw new BadRequestException('Department must belong to the active company');
      if (dto.administrationId && dept.administrationId && dept.administrationId !== dto.administrationId) {
        throw new BadRequestException('Department does not belong to the selected administration');
      }
      if (dept.branchId && dept.branchId !== ctx.branchId) {
        throw new BadRequestException('Department must belong to the active branch');
      }
    }

    if (dto.administrationId) {
      const admin = await this.prisma.administration.findFirst({
        where: { id: dto.administrationId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!admin) throw new BadRequestException('Administration must belong to the active branch');
    }
  }
}
