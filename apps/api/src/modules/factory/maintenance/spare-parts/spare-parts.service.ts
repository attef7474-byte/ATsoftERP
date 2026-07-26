import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateSparePartDto, UpdateSparePartDto } from './dto/create-spare-part.dto';

@Injectable()
export class SparePartsService {
  constructor(private prisma: PrismaService, private auditService: AuditService, private numberingService: NumberingService) {}

  async create(dto: CreateSparePartDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('SPARE_PART');
    const existing = await this.prisma.sparePart.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Spare part code already exists');
    const part = await this.prisma.sparePart.create({ data: { ...dto, code } });
    await this.auditService.log(userId, 'CREATE', 'SparePart', part.id, { message: `Created spare part: ${part.code}` });
    return part;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; code?: string; name?: string; category?: string; partNumber?: string; barcode?: string; isCritical?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (query.search) { where.OR = [{ name: { contains: query.search } }, { code: { contains: query.search } }, { partNumber: { contains: query.search } }]; }
    if (query.code) where.code = { contains: query.code };
    if (query.name) where.name = { contains: query.name };
    if (query.category) where.category = query.category;
    if (query.partNumber) where.partNumber = { contains: query.partNumber };
    if (query.barcode) where.barcode = { contains: query.barcode };
    if (query.isCritical) where.isCritical = query.isCritical === 'true';
    if (query.status) where.status = query.status;
    const [data, total] = await Promise.all([
      this.prisma.sparePart.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.sparePart.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const part = await this.prisma.sparePart.findUnique({
      where: { id },
      include: { product: { select: { id: true, name: true, code: true } }, componentLinks: { include: { component: { select: { id: true, name: true, code: true } } } }, machineLinks: { include: { machine: { select: { id: true, name: true, code: true } } } } },
    });
    if (!part) throw new NotFoundException('Spare part not found');
    return part;
  }

  async update(id: string, dto: UpdateSparePartDto, userId: string) {
    const existing = await this.findOne(id);
    if (dto.code && dto.code !== existing.code) {
      throw new BadRequestException('Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;
    const part = await this.prisma.sparePart.update({ where: { id }, data: updateDto });
    await this.auditService.log(userId, 'UPDATE', 'SparePart', id, { message: `Updated spare part: ${part.code}` });
    return part;
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const part = await this.prisma.sparePart.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'SparePart', id);
    return part;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const part = await this.prisma.sparePart.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'SparePart', id);
    return part;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    const machineLinkCount = await this.prisma.machineSparePart.count({ where: { sparePartId: id } });
    if (machineLinkCount > 0) throw new ConflictException('Cannot delete spare part linked to machines');
    const componentLinkCount = await this.prisma.componentSparePart.count({ where: { sparePartId: id } });
    if (componentLinkCount > 0) throw new ConflictException('Cannot delete spare part linked to components');
    const reqPartCount = await this.prisma.maintenanceRequestRequiredPart.count({ where: { sparePartId: id } });
    if (reqPartCount > 0) throw new ConflictException('Cannot delete spare part with linked request parts');
    await this.prisma.sparePart.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'SparePart', id, { message: `Deleted spare part: ${id}` });
    return { message: 'Spare part deleted successfully' };
  }
}
