import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachineDocumentDto } from './dto/create-machine-document.dto';
import { UpdateMachineDocumentDto } from './dto/update-machine-document.dto';

@Injectable()
export class MachineDocumentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateMachineDocumentDto, userId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('Machine not found');

    const doc = await this.prisma.machineDocument.create({ data: dto });
    await this.auditService.log(userId, 'CREATE', 'MachineDocument', doc.id, { message: `Created document: ${doc.title}` });
    return doc;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; machineId?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { type: { contains: query.search } },
      ];
    }
    if (query.machineId) where.machineId = query.machineId;

    const [data, total] = await Promise.all([
      this.prisma.machineDocument.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.machineDocument.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const doc = await this.prisma.machineDocument.findUnique({
      where: { id },
      include: { machine: { select: { id: true, name: true, code: true } } },
    });
    if (!doc) throw new NotFoundException('Machine document not found');
    return doc;
  }

  async update(id: string, dto: UpdateMachineDocumentDto, userId: string) {
    await this.findOne(id);

    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw new NotFoundException('Machine not found');
    }

    const doc = await this.prisma.machineDocument.update({ where: { id }, data: dto });
    await this.auditService.log(userId, 'UPDATE', 'MachineDocument', id, { message: `Updated document: ${doc.title}` });
    return doc;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.machineDocument.delete({ where: { id } });
    await this.auditService.log(userId, 'DELETE', 'MachineDocument', id, { message: `Deleted document: ${id}` });
    return { message: 'Machine document deleted successfully' };
  }

  async deactivate() {
    return { message: 'Machine documents do not support status' };
  }

  async viewDocument(id: string) {
    const doc = await this.findOne(id);
    return doc;
  }

  async getHistory(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.machineDocument.findMany({
        where: {},
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.machineDocument.count(),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getDocumentsByMachine(machineId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Machine not found');
    return this.prisma.machineDocument.findMany({
      where: { machineId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
