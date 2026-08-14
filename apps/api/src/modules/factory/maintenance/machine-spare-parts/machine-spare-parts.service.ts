import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { CreateMachineSparePartDto, UpdateMachineSparePartDto } from './dto/create-machine-spare-part.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MachineSparePartsService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  async create(dto: CreateMachineSparePartDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertReferences(tx, dto.machineId, dto.sparePartId, ctx);
      const existing = await tx.machineSparePart.findUnique({ where: { machineId_sparePartId: { machineId: dto.machineId, sparePartId: dto.sparePartId } } });
      if (existing) throw new ConflictException('This spare part is already linked to this machine');
      const link = await tx.machineSparePart.create({ data: dto });
      await this.auditService.logWithClient(tx, { userId, action: 'CREATE', entity: 'MachineSparePart', entityId: link.id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return link;
    });
  }

  async findAll(query: { page?: number; limit?: number; machineId?: string; sparePartId?: string; isPrimary?: string; status?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1; const limit = query.limit || 10; const skip = (page - 1) * limit;
    const where: any = { machine: this.machineScope(ctx) };
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

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const link = await this.prisma.machineSparePart.findFirst({
      where: { id, machine: this.machineScope(ctx) },
      include: { machine: { select: { id: true, name: true, code: true } }, sparePart: { select: { id: true, name: true, code: true, partNumber: true, unit: true } } },
    });
    if (!link) throw new NotFoundException('Machine spare part link not found');
    return link;
  }

  async update(id: string, dto: UpdateMachineSparePartDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.machineSparePart.findFirst({ where: { id, machine: this.machineScope(ctx) } });
      if (!current) throw new NotFoundException('Machine spare part link not found');
      await this.assertReferences(tx, dto.machineId ?? current.machineId, dto.sparePartId ?? current.sparePartId, ctx);
      const link = await tx.machineSparePart.update({ where: { id }, data: dto });
      await this.auditService.logWithClient(tx, { userId, action: 'UPDATE', entity: 'MachineSparePart', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return link;
    });
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.machineSparePart.findFirst({ where: { id, machine: this.machineScope(ctx) } });
      if (!current) throw new NotFoundException('Machine spare part link not found');
      const link = await tx.machineSparePart.update({ where: { id }, data: { status: 'INACTIVE' } });
      await this.auditService.logWithClient(tx, { userId, action: 'DEACTIVATE', entity: 'MachineSparePart', entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId } });
      return link;
    });
  }

  private machineScope(ctx: ActiveOperationalContext) { return { companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] }; }

  private async assertReferences(tx: any, machineId: string, sparePartId: string, ctx: ActiveOperationalContext) {
    const [machine, sparePart] = await Promise.all([
      tx.machine.findFirst({ where: { id: machineId, ...this.machineScope(ctx) }, select: { id: true } }),
      tx.sparePart.findFirst({ where: { id: sparePartId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!machine) throw new BadRequestException('Machine not found');
    if (!sparePart) throw new BadRequestException('Spare part not found');
  }
}
