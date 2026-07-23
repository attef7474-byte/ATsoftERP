import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachineSparePartDto, UpdateMachineSparePartDto } from './dto/create-machine-spare-part.dto';

@Injectable()
export class MachineSparePartsService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  async create(dto: CreateMachineSparePartDto, userId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new BadRequestException('Machine not found');
    const sparePart = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
    if (!sparePart) throw new BadRequestException('Spare part not found');

    const existing = await this.prisma.machineSparePart.findUnique({
      where: { machineId_sparePartId: { machineId: dto.machineId, sparePartId: dto.sparePartId } },
    });
    if (existing) throw new ConflictException('This spare part is already linked to this machine');

    const link = await this.prisma.machineSparePart.create({ data: dto });
    await this.auditService.log(userId, 'CREATE', 'MachineSparePart', link.id, { message: `Linked spare part to machine` });
    return link;
  }

  async findAll(query: { page?: number; limit?: number; machineId?: string; sparePartId?: string; isPrimary?: string; status?: string }) {
    const page = query.page || 1; const limit = query.limit || 10; const skip = (page - 1) * limit;
    const where: any = {};
    if (query.machineId) where.machineId = query.machineId;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.isPrimary) where.isPrimary = query.isPrimary === 'true';
    if (query.status) where.status = query.status;
    const [data, total] = await Promise.all([
      this.prisma.machineSparePart.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, name: true, code: true } }, sparePart: { select: { id: true, name: true, code: true, partNumber: true } } },
      }),
      this.prisma.machineSparePart.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const link = await this.prisma.machineSparePart.findUnique({
      where: { id },
      include: { machine: { select: { id: true, name: true, code: true } }, sparePart: { select: { id: true, name: true, code: true, partNumber: true, unit: true } } },
    });
    if (!link) throw new NotFoundException('Machine spare part link not found');
    return link;
  }

  async update(id: string, dto: UpdateMachineSparePartDto, userId: string) {
    await this.findOne(id);
    if (dto.machineId) {
      const m = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!m) throw new BadRequestException('Machine not found');
    }
    if (dto.sparePartId) {
      const s = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
      if (!s) throw new BadRequestException('Spare part not found');
    }
    const link = await this.prisma.machineSparePart.update({ where: { id }, data: dto });
    await this.auditService.log(userId, 'UPDATE', 'MachineSparePart', id, { message: `Updated machine spare part link` });
    return link;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const link = await this.prisma.machineSparePart.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'MachineSparePart', id);
    return link;
  }
}
