import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateComponentSparePartDto, UpdateComponentSparePartDto } from './dto/create-component-spare-part.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class ComponentSparePartsService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  async create(dto: CreateComponentSparePartDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertReferences(tx, dto.componentId, dto.sparePartId, ctx);
      const existing = await tx.componentSparePart.findUnique({ where: { componentId_sparePartId: { componentId: dto.componentId, sparePartId: dto.sparePartId } } });
      if (existing) throw new ConflictException('This spare part is already linked to this component');
      const link = await tx.componentSparePart.create({ data: dto });
      await this.auditService.logWithClient(tx, { userId, action: 'CREATE', entity: 'ComponentSparePart', entityId: link.id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return link;
    });
  }

  async findAll(query: { page?: number; limit?: number; componentId?: string; sparePartId?: string; isPrimary?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1; const limit = query.limit || 10; const skip = (page - 1) * limit;
    const where: any = { component: { machine: this.machineScope(ctx) } };
    if (query.componentId) where.componentId = query.componentId;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.isPrimary) where.isPrimary = query.isPrimary === 'true';
    if (query.status) where.status = query.status;
    const [data, total] = await Promise.all([
      this.prisma.componentSparePart.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { component: { select: { id: true, name: true, code: true } }, sparePart: { select: { id: true, name: true, code: true, partNumber: true } } },
      }),
      this.prisma.componentSparePart.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const link = await this.prisma.componentSparePart.findFirst({
      where: { id, component: { machine: this.machineScope(ctx) } },
      include: { component: { select: { id: true, name: true, code: true } }, sparePart: { select: { id: true, name: true, code: true, partNumber: true, unit: true } } },
    });
    if (!link) throw new NotFoundException('Component spare part link not found');
    return link;
  }

  async update(id: string, dto: UpdateComponentSparePartDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.componentSparePart.findFirst({ where: { id, component: { machine: this.machineScope(ctx) } } });
      if (!current) throw new NotFoundException('Component spare part link not found');
      await this.assertReferences(tx, dto.componentId ?? current.componentId, dto.sparePartId ?? current.sparePartId, ctx);
      const link = await tx.componentSparePart.update({ where: { id }, data: dto });
      await this.auditService.logWithClient(tx, { userId, action: 'UPDATE', entity: 'ComponentSparePart', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return link;
    });
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.componentSparePart.findFirst({ where: { id, component: { machine: this.machineScope(ctx) } } });
      if (!current) throw new NotFoundException('Component spare part link not found');
      const link = await tx.componentSparePart.update({ where: { id }, data: { status: 'INACTIVE' } });
      await this.auditService.logWithClient(tx, { userId, action: 'DEACTIVATE', entity: 'ComponentSparePart', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return link;
    });
  }

  private machineScope(ctx: ActiveOperationalContext) { return { companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] }; }

  private async assertReferences(tx: any, componentId: string, sparePartId: string, ctx: ActiveOperationalContext) {
    const [component, sparePart] = await Promise.all([
      tx.machineComponent.findFirst({ where: { id: componentId, deletedAt: null, machine: this.machineScope(ctx) }, select: { id: true } }),
      tx.sparePart.findFirst({ where: { id: sparePartId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!component) throw new BadRequestException('Component not found');
    if (!sparePart) throw new BadRequestException('Spare part not found');
  }
}
