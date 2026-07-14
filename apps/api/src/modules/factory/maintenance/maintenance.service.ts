import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateMachineDto, UpdateMachineDto, CreateMachinePartDto, CreateMachineDocumentDto } from './dto/maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async createMachine(dto: CreateMachineDto) {
    const existing = await this.prisma.machine.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Machine code already exists');
    const { purchaseDate, warrantyEnd, ...rest } = dto;
    return this.prisma.machine.create({
      data: {
        ...rest,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : undefined,
      },
    });
  }

  async findAllMachines(query: { page?: number; limit?: number; search?: string; categoryId?: string; companyId?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
        { serialNumber: { contains: query.search } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.companyId) where.companyId = query.companyId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.machine.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.machine.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneMachine(id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        parts: true,
        documents: true,
        _count: { select: { maintenanceReqs: true, schedules: true, downtimeLogs: true } },
      },
    });
    if (!machine) throw new NotFoundException('Machine not found');
    return machine;
  }

  async updateMachine(id: string, dto: UpdateMachineDto) {
    await this.findOneMachine(id);
    const { purchaseDate, warrantyEnd, ...rest } = dto as any;
    const data: any = { ...rest };
    if (purchaseDate) data.purchaseDate = new Date(purchaseDate);
    if (warrantyEnd) data.warrantyEnd = new Date(warrantyEnd);
    return this.prisma.machine.update({ where: { id }, data });
  }

  async removeMachine(id: string) {
    await this.findOneMachine(id);
    await this.prisma.machine.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Machine deleted successfully' };
  }

  async createPart(dto: CreateMachinePartDto) {
    return this.prisma.machinePart.create({ data: dto });
  }

  async findParts(machineId?: string) {
    const where: any = {};
    if (machineId) where.machineId = machineId;
    return this.prisma.machinePart.findMany({
      where,
      include: { machine: { select: { id: true, name: true, code: true } }, product: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updatePart(id: string, dto: Partial<CreateMachinePartDto>) {
    const part = await this.prisma.machinePart.findUnique({ where: { id } });
    if (!part) throw new NotFoundException('Part not found');
    return this.prisma.machinePart.update({ where: { id }, data: dto });
  }

  async removePart(id: string) {
    const part = await this.prisma.machinePart.findUnique({ where: { id } });
    if (!part) throw new NotFoundException('Part not found');
    return this.prisma.machinePart.delete({ where: { id } });
  }

  async createDocument(dto: CreateMachineDocumentDto) {
    return this.prisma.machineDocument.create({ data: dto });
  }

  async findDocuments(machineId: string) {
    return this.prisma.machineDocument.findMany({
      where: { machineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeDocument(id: string) {
    const doc = await this.prisma.machineDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.machineDocument.delete({ where: { id } });
  }
}
