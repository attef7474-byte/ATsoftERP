import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateMachinePartDto } from './dto/create-machine-part.dto';
import { UpdateMachinePartDto } from './dto/update-machine-part.dto';

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

  async create(dto: CreateMachinePartDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('MACHINE_PART');
    const existing = await this.prisma.machinePart.findUnique({ where: { code } });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Machine part code already exists');

    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
    }

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
    }

    const part = await this.prisma.machinePart.create({ data: { ...dto, code } });
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
    if (!part) throw new NotFoundException({ messageKey: 'maintenance.machinePartNotFound', message: 'Machine part not found' });
    return part;
  }

  async update(id: string, dto: UpdateMachinePartDto, userId: string) {
    const existing = await this.findOne(id);
    if (dto.code && dto.code !== existing.code) {
      throw this.validationError('code', 'validation.invalidValue', 'Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;

    if (updateDto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: updateDto.machineId } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
    }

    if (updateDto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: updateDto.productId } });
      if (!product) throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
    }

    const part = await this.prisma.machinePart.update({ where: { id }, data: updateDto });
    await this.auditService.log(userId, 'UPDATE', 'MachinePart', id, { message: `Updated machine part: ${part.code}` });
    return part;
  }

  async remove(id: string, userId: string) {
    const existing = await this.findOne(id);
    const usageCount = await this.prisma.maintenanceRequestPartUsage.count({ where: { productId: existing.productId || '' } });
    if (usageCount > 0) throw new ConflictException('Cannot delete machine part with linked usage records');
    await this.prisma.machinePart.delete({ where: { id } });
    await this.auditService.log(userId, 'DELETE', 'MachinePart', id, { message: `Deleted machine part: ${id}` });
    return { message: 'Machine part deleted successfully' };
  }

  async activatePart(id: string) {
    await this.findOne(id);
    return { message: 'Machine part activated successfully', id };
  }

  async deactivatePart(id: string) {
    await this.findOne(id);
    return { message: 'Machine part deactivated successfully', id };
  }

  async getPartMachines(id: string) {
    const part = await this.findOne(id);
    if (part.machineId) {
      const machine = await this.prisma.machine.findUnique({
        where: { id: part.machineId },
        select: { id: true, code: true, name: true, status: true, model: true, manufacturer: true },
      });
      return machine ? [machine] : [];
    }
    return [];
  }

  async linkToMachine(partId: string, machineId: string, userId: string) {
    const part = await this.findOne(partId);
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException({ messageKey: 'maintenance.machineNotFound', message: 'Machine not found' });
    const updated = await this.prisma.machinePart.update({
      where: { id: partId },
      data: { machineId },
    });
    await this.auditService.log(userId, 'LINK', 'MachinePart', partId, { message: `Linked part ${part.code} to machine ${machine.code}` });
    return updated;
  }

  async unlinkFromMachine(partId: string, machineId: string, userId: string) {
    const part = await this.findOne(partId);
    if (part.machineId !== machineId) throw new NotFoundException('Part is not linked to this machine');
    const updated = await this.prisma.machinePart.update({
      where: { id: partId },
      data: { machineId: null },
    });
    await this.auditService.log(userId, 'UNLINK', 'MachinePart', partId, { message: `Unlinked part ${part.code} from machine` });
    return updated;
  }

  async getUsageHistory(id: string) {
    const part = await this.findOne(id);
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
