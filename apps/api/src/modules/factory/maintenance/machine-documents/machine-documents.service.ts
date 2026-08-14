import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachineDocumentDto } from './dto/create-machine-document.dto';
import { UpdateMachineDocumentDto } from './dto/update-machine-document.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MachineDocumentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  async create(dto: CreateMachineDocumentDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const machine = await tx.machine.findFirst({ where: { id: dto.machineId, ...this.machineScope(ctx) }, select: { id: true } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      const doc = await tx.machineDocument.create({ data: dto });
      await this.auditService.logWithClient(tx, { userId, action: 'CREATE', entity: 'MachineDocument', entityId: doc.id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return doc;
    });
  }

  async findAll(query: { page?: number; limit?: number; search?: string; machineId?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { machine: this.machineScope(ctx) };
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

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const doc = await this.prisma.machineDocument.findFirst({
      where: { id, machine: this.machineScope(ctx) },
      include: { machine: { select: { id: true, name: true, code: true } } },
    });
    if (!doc) throw new NotFoundException({ messageKey: 'maintenance.machineDocumentNotFound', message: 'Machine document not found' });
    return doc;
  }

  async update(id: string, dto: UpdateMachineDocumentDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.machineDocument.findFirst({ where: { id, machine: this.machineScope(ctx) } });
      if (!current) throw new NotFoundException({ messageKey: 'maintenance.machineDocumentNotFound', message: 'Machine document not found' });
      const machine = await tx.machine.findFirst({ where: { id: dto.machineId ?? current.machineId, ...this.machineScope(ctx) }, select: { id: true } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      const doc = await tx.machineDocument.update({ where: { id }, data: dto });
      await this.auditService.logWithClient(tx, { userId, action: 'UPDATE', entity: 'MachineDocument', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return doc;
    });
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.machineDocument.findFirst({ where: { id, machine: this.machineScope(ctx) } });
      if (!current) throw new NotFoundException({ messageKey: 'maintenance.machineDocumentNotFound', message: 'Machine document not found' });
      await tx.machineDocument.delete({ where: { id } });
      await this.auditService.logWithClient(tx, { userId, action: 'DELETE', entity: 'MachineDocument', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return { message: 'Machine document deleted successfully' };
    });
  }

  async deactivate() {
    return { message: 'Machine documents do not support status' };
  }

  async viewDocument(id: string, ctx: ActiveOperationalContext) {
    const doc = await this.findOne(id, ctx);
    return doc;
  }

  async getHistory(query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.machineDocument.findMany({
        where: { machine: this.machineScope(ctx) },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.machineDocument.count({ where: { machine: this.machineScope(ctx) } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getDocumentsByMachine(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({ where: { id: machineId, ...this.machineScope(ctx) } });
    if (!machine) throw new NotFoundException({ messageKey: 'maintenance.machineNotFound', message: 'Machine not found' });
    return this.prisma.machineDocument.findMany({
      where: { machineId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }
}
