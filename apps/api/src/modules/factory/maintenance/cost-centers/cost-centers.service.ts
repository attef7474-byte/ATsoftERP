import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Injectable()
export class CostCentersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
  ) {}

  async create(dto: CreateCostCenterDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('COST_CENTER');
    const existing = await this.prisma.costCenter.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Cost center code already exists');

    await this.validateHierarchy(dto);

    const item = await this.prisma.costCenter.create({ data: { ...dto, code } });
    await this.auditService.log(userId, 'CREATE', 'CostCenter', item.id, { message: `Created cost center: ${item.code}` });
    return item;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    type?: string; companyId?: string; branchId?: string;
    administrationId?: string; departmentId?: string; status?: string;
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
    if (query.type) where.type = query.type;
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.administrationId) where.administrationId = query.administrationId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.costCenter.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, code: true } },
          branch: { select: { id: true, name: true, code: true } },
          administration: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.costCenter.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.prisma.costCenter.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        administration: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    if (!item) throw new NotFoundException('Cost center not found');
    return item;
  }

  async update(id: string, dto: UpdateCostCenterDto, userId: string) {
    await this.findOne(id);
    await this.validateHierarchy(dto);
    const item = await this.prisma.costCenter.update({
      where: { id }, data: dto,
      include: {
        company: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        administration: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    await this.auditService.log(userId, 'UPDATE', 'CostCenter', id, { message: `Updated cost center: ${item.code}` });
    return item;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.costCenter.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'CostCenter', id, { message: `Deleted cost center: ${id}` });
    return { message: 'Cost center deleted successfully' };
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.costCenter.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'CostCenter', id);
    return item;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const item = await this.prisma.costCenter.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'CostCenter', id);
    return item;
  }

  private async validateHierarchy(dto: { companyId?: string; branchId?: string; administrationId?: string; departmentId?: string }) {
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
