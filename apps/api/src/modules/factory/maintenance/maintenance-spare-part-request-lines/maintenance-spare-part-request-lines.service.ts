import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { MaintenanceNotificationService } from '../maintenance-notification/maintenance-notification.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateSparePartRequestLineDto, UpdateSparePartRequestLineDto } from './dto/create-spare-part-request-line.dto';

@Injectable()
export class MaintenanceSparePartRequestLinesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notificationService: MaintenanceNotificationService,
  ) {}

  private machineScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      OR: [{ branchId: ctx.branchId }, { branchId: null }],
    };
  }

  private isMachineInScope(
    machine: { companyId?: string | null; branchId?: string | null },
    ctx: ActiveOperationalContext,
  ): boolean {
    return machine.companyId === ctx.companyId
      && (machine.branchId === null || machine.branchId === ctx.branchId);
  }

  private async findRequestOrFail(id: string, ctx: ActiveOperationalContext) {
    const req = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { machine: { select: { companyId: true, branchId: true } } },
    });
    if (!req || !this.isMachineInScope(req.machine, ctx)) {
      throw new NotFoundException('Maintenance request not found');
    }
    return req;
  }

  private async findPartOrFail(id: string, requestId: string) {
    const part = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id },
      include: { maintenanceRequest: true },
    });
    if (!part) throw new NotFoundException('Request part line not found');
    if (part.maintenanceRequestId !== requestId) {
      throw new BadRequestException('Part line does not belong to this request');
    }
    return part;
  }

  private async assertMachineInContext(machineId: string, ctx: ActiveOperationalContext) {
    const machine = await this.prisma.machine.findFirst({
      where: { id: machineId, ...this.machineScope(ctx) },
    });
    if (!machine) throw new BadRequestException('Machine not found or not in the active company/branch');
    return machine;
  }

  private isTerminalStatus(status: string) {
    return ['CANCELLED', 'USED', 'REJECTED'].includes(status);
  }

  async create(requestId: string, dto: CreateSparePartRequestLineDto, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findRequestOrFail(requestId, ctx);
    if (['COMPLETED', 'CANCELLED', 'CLOSED'].includes(req.status)) {
      throw new BadRequestException('Cannot add parts to completed, cancelled, or closed requests');
    }

    const sparePart = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
    if (!sparePart) throw new NotFoundException('Spare part not found');
    if (sparePart.status !== 'ACTIVE') throw new BadRequestException('Inactive spare part cannot be requested');

    const existing = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: {
        maintenanceRequestId_sparePartId: { maintenanceRequestId: requestId, sparePartId: dto.sparePartId },
      },
    });
    if (existing && !this.isTerminalStatus(existing.status)) {
      throw new BadRequestException('This spare part is already added to the request. Cancel existing line first.');
    }

    if (dto.machineId) {
      await this.assertMachineInContext(dto.machineId, ctx);
    }
    if (dto.machineComponentId) {
      const comp = await this.prisma.machineComponent.findUnique({
        where: { id: dto.machineComponentId },
        include: { machine: { select: { companyId: true, branchId: true } } },
      });
      if (!comp || !this.isMachineInScope(comp.machine, ctx)) {
        throw new NotFoundException('Machine component not found or not in the active company/branch');
      }
    }
    if (dto.failureCauseId) {
      const log = await this.prisma.downtimeLog.findUnique({
        where: { id: dto.failureCauseId },
        include: { machine: { select: { companyId: true, branchId: true } } },
      });
      if (!log || !this.isMachineInScope(log.machine, ctx)) {
        throw new NotFoundException('Downtime log not found or not in the active company/branch');
      }
    }

    const part = await this.prisma.maintenanceRequestRequiredPart.create({
      data: {
        maintenanceRequestId: requestId,
        sparePartId: dto.sparePartId,
        machineComponentId: dto.machineComponentId,
        machineId: dto.machineId || req.machineId,
        quantity: dto.quantity,
        unit: dto.unit,
        usageNote: dto.usageNote,
        isPrimary: dto.isPrimary,
        reason: dto.reason,
        status: 'DRAFT',
      },
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestRequiredPart', part.id,
      { requestId, sparePartId: dto.sparePartId, status: 'DRAFT', companyId: ctx.companyId, branchId: ctx.branchId });
    return part;
  }

  async findAll(requestId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    return this.prisma.maintenanceRequestRequiredPart.findMany({
      where: { maintenanceRequestId: requestId },
      include: {
        sparePart: true,
        machineComponent: { select: { id: true, code: true, name: true } },
        machine: { select: { id: true, code: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } },
        reservedBy: { select: { id: true, name: true } },
        usedBy: { select: { id: true, name: true } },
        cancelledBy: { select: { id: true, name: true } },
        failureCause: { select: { id: true, reason: true, failureCause: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(requestId: string, lineId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    const part = await this.findPartOrFail(lineId, requestId);
    return this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: lineId },
      include: {
        sparePart: true,
        machineComponent: { select: { id: true, code: true, name: true } },
        machine: { select: { id: true, code: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } },
        reservedBy: { select: { id: true, name: true } },
        usedBy: { select: { id: true, name: true } },
        cancelledBy: { select: { id: true, name: true } },
        failureCause: { select: { id: true, reason: true, failureCause: true } },
      },
    });
  }

  async update(requestId: string, lineId: string, dto: UpdateSparePartRequestLineDto, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findRequestOrFail(requestId, ctx);
    if (['COMPLETED', 'CANCELLED', 'CLOSED'].includes(req.status)) {
      throw new BadRequestException('Cannot update parts on completed or cancelled requests');
    }

    const part = await this.findPartOrFail(lineId, requestId);
    if (this.isTerminalStatus(part.status) || part.status === 'REQUESTED' || part.status === 'APPROVED' || part.status === 'RESERVED' || part.status === 'USED') {
      throw new BadRequestException(`Cannot update part in status '${part.status}'`);
    }

    if (dto.machineId !== undefined && dto.machineId !== req.machineId) {
      await this.assertMachineInContext(dto.machineId, ctx);
    }
    if (dto.machineComponentId !== undefined) {
      const comp = await this.prisma.machineComponent.findUnique({
        where: { id: dto.machineComponentId },
        include: { machine: { select: { companyId: true, branchId: true } } },
      });
      if (!comp || !this.isMachineInScope(comp.machine, ctx)) {
        throw new NotFoundException('Machine component not found or not in the active company/branch');
      }
    }

    const data: any = {};
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.reason !== undefined) data.reason = dto.reason;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.usageNote !== undefined) data.usageNote = dto.usageNote;
    if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;
    if (dto.machineComponentId !== undefined) data.machineComponentId = dto.machineComponentId;
    if (dto.machineId !== undefined) data.machineId = dto.machineId;

    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id: lineId },
      data,
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestRequiredPart', lineId, { dto, companyId: ctx.companyId, branchId: ctx.branchId });
    return updated;
  }

  async submit(requestId: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    const part = await this.findPartOrFail(lineId, requestId);
    if (part.status !== 'DRAFT') throw new BadRequestException(`Cannot request part in status '${part.status}'`);

    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id: lineId },
      data: {
        status: 'REQUESTED',
        requestedByUserId: userId,
        requestedAt: new Date(),
        requestedQuantity: part.quantity,
      },
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'SUBMIT', 'MaintenanceRequestRequiredPart', lineId,
      { oldStatus: part.status, newStatus: 'REQUESTED' });

    try {
      const req = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
      await this.notificationService.notifyPartRequested(updated, req);
    } catch { }
    return updated;
  }

  async approve(requestId: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    const part = await this.findPartOrFail(lineId, requestId);
    if (part.status !== 'REQUESTED') throw new BadRequestException(`Cannot approve part in status '${part.status}'`);

    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id: lineId },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        approvedAt: new Date(),
        approvedQuantity: part.requestedQuantity || part.quantity,
      },
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'APPROVE', 'MaintenanceRequestRequiredPart', lineId,
      { oldStatus: part.status, newStatus: 'APPROVED' });

    try {
      const req = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
      await this.notificationService.notifyPartApproved(updated, req, userId);
    } catch { }
    return updated;
  }

  async reject(requestId: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    const part = await this.findPartOrFail(lineId, requestId);
    if (part.status !== 'REQUESTED') throw new BadRequestException(`Cannot reject part in status '${part.status}'`);

    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id: lineId },
      data: {
        status: 'REJECTED',
        rejectedByUserId: userId,
        rejectedAt: new Date(),
      },
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'REJECT', 'MaintenanceRequestRequiredPart', lineId,
      { oldStatus: part.status, newStatus: 'REJECTED' });

    try {
      const req = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
      await this.notificationService.notifyPartRejected(updated, req, userId);
    } catch { }
    return updated;
  }

  async reserve(requestId: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    const part = await this.findPartOrFail(lineId, requestId);
    if (part.status !== 'APPROVED') throw new BadRequestException(`Cannot reserve part in status '${part.status}'`);

    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id: lineId },
      data: {
        status: 'RESERVED',
        reservedByUserId: userId,
        reservedAt: new Date(),
        reservedQuantity: part.approvedQuantity || part.requestedQuantity || part.quantity,
      },
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'RESERVE', 'MaintenanceRequestRequiredPart', lineId,
      { oldStatus: part.status, newStatus: 'RESERVED' });

    try {
      const req = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
      await this.notificationService.notifyPartReserved(updated, req);
    } catch { }
    return updated;
  }

  async markUsed(requestId: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    const part = await this.findPartOrFail(lineId, requestId);
    if (part.status !== 'RESERVED' && part.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot mark as used part in status '${part.status}'`);
    }

    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id: lineId },
      data: {
        status: 'USED',
        usedByUserId: userId,
        usedAt: new Date(),
        usedQuantity: part.reservedQuantity || part.approvedQuantity || part.requestedQuantity || part.quantity,
      },
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'USE', 'MaintenanceRequestRequiredPart', lineId,
      { oldStatus: part.status, newStatus: 'USED' });

    try {
      const req = await this.prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
      await this.notificationService.notifyPartUsed(updated, req);
    } catch { }
    return updated;
  }

  async cancel(requestId: string, lineId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findRequestOrFail(requestId, ctx);
    const part = await this.findPartOrFail(lineId, requestId);
    if (this.isTerminalStatus(part.status)) {
      throw new BadRequestException(`Cannot cancel part in terminal status '${part.status}'`);
    }

    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id: lineId },
      data: {
        status: 'CANCELLED',
        cancelledByUserId: userId,
        cancelledAt: new Date(),
      },
      include: { sparePart: true },
    });

    await this.audit.log(userId, 'CANCEL', 'MaintenanceRequestRequiredPart', lineId,
      { oldStatus: part.status, newStatus: 'CANCELLED' });
    return updated;
  }
}
