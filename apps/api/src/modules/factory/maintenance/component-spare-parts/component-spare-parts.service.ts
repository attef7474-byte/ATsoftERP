import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateComponentSparePartDto, UpdateComponentSparePartDto } from './dto/create-component-spare-part.dto';

@Injectable()
export class ComponentSparePartsService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  async create(dto: CreateComponentSparePartDto, userId: string) {
    const component = await this.prisma.machineComponent.findUnique({ where: { id: dto.componentId } });
    if (!component) throw new BadRequestException('Component not found');
    const sparePart = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
    if (!sparePart) throw new BadRequestException('Spare part not found');

    const existing = await this.prisma.componentSparePart.findUnique({
      where: { componentId_sparePartId: { componentId: dto.componentId, sparePartId: dto.sparePartId } },
    });
    if (existing) throw new ConflictException('This spare part is already linked to this component');

    const link = await this.prisma.componentSparePart.create({ data: dto });
    await this.auditService.log(userId, 'CREATE', 'ComponentSparePart', link.id, { message: `Linked spare part to component` });
    return link;
  }

  async findAll(query: { page?: number; limit?: number; componentId?: string; sparePartId?: string; isPrimary?: string; status?: string }) {
    const page = query.page || 1; const limit = query.limit || 10; const skip = (page - 1) * limit;
    const where: any = {};
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

  async findOne(id: string) {
    const link = await this.prisma.componentSparePart.findUnique({
      where: { id },
      include: { component: { select: { id: true, name: true, code: true } }, sparePart: { select: { id: true, name: true, code: true, partNumber: true, unit: true } } },
    });
    if (!link) throw new NotFoundException('Component spare part link not found');
    return link;
  }

  async update(id: string, dto: UpdateComponentSparePartDto, userId: string) {
    await this.findOne(id);
    if (dto.componentId) {
      const c = await this.prisma.machineComponent.findUnique({ where: { id: dto.componentId } });
      if (!c) throw new BadRequestException('Component not found');
    }
    if (dto.sparePartId) {
      const s = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
      if (!s) throw new BadRequestException('Spare part not found');
    }
    const link = await this.prisma.componentSparePart.update({ where: { id }, data: dto });
    await this.auditService.log(userId, 'UPDATE', 'ComponentSparePart', id, { message: `Updated component spare part link` });
    return link;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const link = await this.prisma.componentSparePart.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'ComponentSparePart', id);
    return link;
  }
}
