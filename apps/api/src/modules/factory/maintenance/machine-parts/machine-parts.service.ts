import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateMachinePartDto } from './dto/create-machine-part.dto';
import { UpdateMachinePartDto } from './dto/update-machine-part.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@Injectable()
export class MachinePartsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private machineOwns(machine: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async machineAccess(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');
    return machine;
  }

  private async partAccess(id: string, ctx: ActiveOperationalContext) {
    const part = await this.prisma.machinePart.findUnique({
      where: { id },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!part) throw this.notFound('maintenance.machinePartNotFound', 'Machine part not found');
    if (part.machineId && (!part.machine || !this.machineOwns(part.machine, ctx))) {
      throw this.notFound('maintenance.machinePartNotFound', 'Machine part not found');
    }
    return part;
  }

  async create(dto: CreateMachinePartDto, userId: string, ctx: ActiveOperationalContext) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('MACHINE_PART');
    const existing = await this.prisma.machinePart.findUnique({ where: { code } });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Machine part code already exists');

    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine || !this.machineOwns(machine, ctx)) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      }
    }

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
    }

    const part = await this.prisma.machinePart.create({ data: { ...dto, code } });
    await this.auditService.log(userId, 'CREATE', 'MachinePart', part.id, { message: `Created machine part: ${part.code}` });
    return part;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; machineId?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const scopedMachineIds = await this.prisma.machine.findMany({
      where: this.machineScope(ctx),
      select: { id: true },
    });
    const where: any = { OR: [{ machineId: { in: scopedMachineIds.map((m) => m.id) } }, { machineId: null }] };
    if (query.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.search } },
            { code: { contains: query.search } },
            { partNumber: { contains: query.search } },
          ],
        },
      ];
    }
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.AND = [...(where.AND || []), { machineId: query.machineId }];
    }

    const [data, total] = await Promise.all([
      this.prisma.machinePart.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { machine: { select: { id: true, name: true, code: true } }, product: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.machinePart.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    await this.partAccess(id, ctx);
    const part = await this.prisma.machinePart.findUnique({
      where: { id },
      include: { machine: { select: { id: true, name: true, code: true } }, product: { select: { id: true, name: true, code: true } } },
    });
    if (!part) throw this.notFound('maintenance.machinePartNotFound', 'Machine part not found');
    return part;
  }

  async update(id: string, dto: UpdateMachinePartDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.partAccess(id, ctx);
    if (dto.code && dto.code !== existing.code) {
      throw this.validationError('code', 'validation.invalidValue', 'Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;

    if (updateDto.machineId) {
      await this.machineAccess(updateDto.machineId, ctx);
    }

    if (updateDto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: updateDto.productId } });
      if (!product) throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
    }

    const part = await this.prisma.machinePart.update({ where: { id }, data: updateDto });
    await this.auditService.log(userId, 'UPDATE', 'MachinePart', id, { message: `Updated machine part: ${part.code}` });
    return part;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.partAccess(id, ctx);
    const usageCount = await this.prisma.maintenanceRequestPartUsage.count({ where: { productId: existing.productId || '' } });
    if (usageCount > 0) throw new ConflictException('Cannot delete machine part with linked usage records');
    await this.prisma.machinePart.delete({ where: { id } });
    await this.auditService.log(userId, 'DELETE', 'MachinePart', id, { message: `Deleted machine part: ${id}` });
    return { message: 'Machine part deleted successfully' };
  }

  async getPartMachines(id: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(id, ctx);
    if (part.machineId) {
      await this.machineAccess(part.machineId, ctx);
      const machine = await this.prisma.machine.findUnique({
        where: { id: part.machineId },
        select: { id: true, code: true, name: true, status: true, model: true, manufacturer: true },
      });
      return machine ? [machine] : [];
    }
    return [];
  }

  async linkToMachine(partId: string, machineId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.partAccess(partId, ctx);
    const machine = await this.machineAccess(machineId, ctx);
    const updated = await this.prisma.machinePart.update({
      where: { id: partId },
      data: { machineId },
    });
    await this.auditService.log(userId, 'LINK', 'MachinePart', partId, { message: `Linked part ${updated.code} to machine ${machine.code}` });
    return updated;
  }

  async unlinkFromMachine(partId: string, machineId: string, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(partId, ctx);
    await this.machineAccess(machineId, ctx);
    if (part.machineId !== machineId) throw this.notFound('maintenance.machinePartNotLinked', 'Part is not linked to this machine');
    const updated = await this.prisma.machinePart.update({
      where: { id: partId },
      data: { machineId: null },
    });
    await this.auditService.log(userId, 'UNLINK', 'MachinePart', partId, { message: `Unlinked part ${updated.code} from machine` });
    return updated;
  }

  async getUsageHistory(id: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(id, ctx);
    if (!part.productId) return [];
    return this.prisma.maintenanceRequestPartUsage.findMany({
      where: { productId: part.productId },
      include: {
        request: { select: { id: true, requestNumber: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
