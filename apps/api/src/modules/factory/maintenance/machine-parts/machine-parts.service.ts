import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachinePartDto } from './dto/create-machine-part.dto';
import { UpdateMachinePartDto } from './dto/update-machine-part.dto';

@Injectable()
export class MachinePartsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateMachinePartDto, userId: string) {
    const existing = await this.prisma.machinePart.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Machine part code already exists');

    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw new NotFoundException('Machine not found');
    }

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');
    }

    const part = await this.prisma.machinePart.create({ data: dto });
    await this.auditService.log(userId, 'CREATE', 'MachinePart', part.id, { message: `Created machine part: ${part.code}` });
    return part;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; machineId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { partNumber: { contains: query.search } },
      ];
    }
    if (query.machineId) where.machineId = query.machineId;

    const [data, total] = await Promise.all([
      this.prisma.machinePart.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, name: true, code: true } }, product: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.machinePart.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const part = await this.prisma.machinePart.findUnique({
      where: { id },
      include: { machine: { select: { id: true, name: true, code: true } }, product: { select: { id: true, name: true, code: true } } },
    });
    if (!part) throw new NotFoundException('Machine part not found');
    return part;
  }

  async update(id: string, dto: UpdateMachinePartDto, userId: string) {
    await this.findOne(id);

    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw new NotFoundException('Machine not found');
    }

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');
    }

    const part = await this.prisma.machinePart.update({ where: { id }, data: dto });
    await this.auditService.log(userId, 'UPDATE', 'MachinePart', id, { message: `Updated machine part: ${part.code}` });
    return part;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.machinePart.delete({ where: { id } });
    await this.auditService.log(userId, 'DELETE', 'MachinePart', id, { message: `Deleted machine part: ${id}` });
    return { message: 'Machine part deleted successfully' };
  }

  async activate() {
    return { message: 'Machine parts do not have status' };
  }

  async deactivate() {
    return { message: 'Machine parts do not have status' };
  }
}
