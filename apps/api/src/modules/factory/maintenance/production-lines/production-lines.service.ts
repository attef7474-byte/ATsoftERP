import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateProductionLineDto } from './dto/create-production-line.dto';
import { UpdateProductionLineDto } from './dto/update-production-line.dto';

@Injectable()
export class ProductionLinesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
  ) {}

  async create(dto: CreateProductionLineDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('PRODUCTION_LINE');
    const existing = await this.prisma.productionLine.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Production line code already exists');

    await this.validateHierarchy(dto);

    const item = await this.prisma.productionLine.create({ data: { ...dto, code } });
    await this.auditService.log(userId, 'CREATE', 'ProductionLine', item.id, { message: `Created production line: ${item.code}` });
    return item;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    companyId?: string; branchId?: string; administrationId?: string;
    departmentId?: string; operationTypeId?: string; costCenterId?: string;
    status?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
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
          department: { select: { id: true, name: true, code: true } },
          operationType: { select: { id: true, name: true, code: true } },
          costCenter: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.productionLine.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.productionLine.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        administration: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, name: true, code: true } },
        costCenter: { select: { id: true, name: true, code: true } },
      },
    });
    if (!item) throw new NotFoundException('Production line not found');
    return item;
  }

  async update(id: string, dto: UpdateProductionLineDto, userId: string) {
    await this.findOne(id);
    if (dto.code) {
      const existing = await this.prisma.productionLine.findUnique({ where: { code: dto.code } });
      if (existing && existing.id !== id) throw new ConflictException('Production line code already exists');
    }
    await this.validateHierarchy(dto);
    const item = await this.prisma.productionLine.update({
      where: { id }, data: dto,
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        administration: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, name: true, code: true } },
        costCenter: { select: { id: true, name: true, code: true } },
      },
    });
    await this.auditService.log(userId, 'UPDATE', 'ProductionLine', id, { message: `Updated production line: ${item.code}` });
    return item;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.productionLine.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'ProductionLine', id, { message: `Deleted production line: ${id}` });
    return { message: 'Production line deleted successfully' };
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.productionLine.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'ProductionLine', id);
    return item;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.productionLine.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'ProductionLine', id);
    return item;
  }

  private async validateHierarchy(dto: {
    companyId?: string; branchId?: string; administrationId?: string;
    departmentId?: string; operationTypeId?: string; costCenterId?: string;
  }) {
    if (dto.operationTypeId) {
      const ot = await this.prisma.operationType.findUnique({ where: { id: dto.operationTypeId } });
      if (!ot) throw new BadRequestException('Operation type not found');
    }

    if (dto.costCenterId) {
      const cc = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
      if (!cc) throw new BadRequestException('Cost center not found');
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) throw new BadRequestException('Department not found');
      if (dto.administrationId && dept.administrationId !== dto.administrationId) {
        throw new BadRequestException('Department does not belong to the selected administration');
      }
      if (!dto.administrationId && dto.branchId && dept.branchId !== dto.branchId) {
        throw new BadRequestException('Department does not belong to the selected branch');
      }
      if (!dto.administrationId && !dto.branchId && dto.companyId && dept.companyId !== dto.companyId) {
        throw new BadRequestException('Department does not belong to the selected company');
      }
    }

    if (dto.administrationId) {
      const admin = await this.prisma.administration.findUnique({ where: { id: dto.administrationId } });
      if (!admin) throw new BadRequestException('Administration not found');
      if (dto.branchId && admin.branchId !== dto.branchId) {
        throw new BadRequestException('Administration does not belong to the selected branch');
      }
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw new BadRequestException('Branch not found');
      if (dto.companyId && branch.companyId !== dto.companyId) {
        throw new BadRequestException('Branch does not belong to the selected company');
      }
    }

    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new BadRequestException('Company not found');
    }
  }
}
