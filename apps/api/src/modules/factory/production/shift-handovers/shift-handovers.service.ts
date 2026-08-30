import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateShiftHandoverDto, UpdateShiftHandoverDto, HANDOVER_STATUSES, HANDOVER_ITEM_ENTITY_TYPES } from './dto/create-shift-handover.dto';
import { CreateShiftHandoverItemDto } from './dto/create-shift-handover.dto';

@Injectable()
export class ShiftHandoversService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  private async validateShift(shiftId: string, ctx: ActiveOperationalContext) {
    const shift = await this.prisma.productionShift.findFirst({
      where: { id: shiftId, companyId: ctx.companyId, deletedAt: null },
    });
    if (!shift) throw new BadRequestException(`Production shift ${shiftId} not found or not in active company`);
    return shift;
  }

  private async validatePerson(personId: string, ctx: ActiveOperationalContext) {
    const person = await this.prisma.operationalPerson.findUnique({ where: { id: personId } });
    if (!person) throw new BadRequestException(`Operational person ${personId} not found`);

    const hasValidAssignment = await this.prisma.operationalPersonAssignment.findFirst({
      where: {
        personnelId: personId,
        companyId: ctx.companyId,
        effectiveTo: null,
        deletedAt: null,
      },
    });
    if (!hasValidAssignment) {
      throw new BadRequestException(`Person ${personId} does not have a valid current assignment compatible with the active company`);
    }
    return person;
  }

  private async calculateSnapshots(ctx: ActiveOperationalContext) {
    const machineScope = { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] };

    const activeProductionOrders = await this.prisma.productionOrder.count({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'CLOSED', 'ARCHIVED'] },
        deletedAt: null,
      },
    });

    const openMaintenanceRequests = await this.prisma.maintenanceRequest.count({
      where: {
        machine: machineScope,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'CLOSED'] },
        deletedAt: null,
      },
    });

    const stoppedMachines = await this.prisma.downtimeLog.count({
      where: {
        machine: machineScope,
        endTime: null,
        cancelledAt: null,
      },
    });

    const pendingMaintenance = await this.prisma.maintenanceSchedule.count({
      where: {
        machine: machineScope,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: null,
      },
    });

    return {
      activeProductionOrders,
      openMaintenanceRequests,
      stoppedMachines,
      pendingMaintenance,
    };
  }

  async create(dto: CreateShiftHandoverDto, userId: string, ctx: ActiveOperationalContext) {
    if (dto.outgoingShiftId === dto.incomingShiftId) {
      throw new BadRequestException('Outgoing and incoming shifts must be different');
    }

    await this.validateShift(dto.outgoingShiftId, ctx);
    await this.validateShift(dto.incomingShiftId, ctx);

    if (dto.branchId) {
      if (dto.branchId !== ctx.branchId) {
        throw new BadRequestException('Shift handover branch must match the active branch');
      }
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!branch) throw new BadRequestException('Branch not found or not in active company');
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId: ctx.companyId, deletedAt: null },
      });
      if (!dept) throw new BadRequestException('Department not found or not in active company');
    }

    if (dto.outgoingPersonId) await this.validatePerson(dto.outgoingPersonId, ctx);
    if (dto.incomingPersonId) await this.validatePerson(dto.incomingPersonId, ctx);

    const snapshots = await this.calculateSnapshots(ctx);

    const result = await this.prisma.shiftHandover.create({
      data: {
        companyId: ctx.companyId,
        branchId: dto.branchId ?? ctx.branchId ?? null,
        departmentId: dto.departmentId ?? null,
        handoverDate: new Date(dto.handoverDate),
        outgoingShiftId: dto.outgoingShiftId,
        incomingShiftId: dto.incomingShiftId,
        outgoingPersonId: dto.outgoingPersonId ?? null,
        incomingPersonId: dto.incomingPersonId ?? null,
        activeProductionOrders: snapshots.activeProductionOrders,
        openMaintenanceRequests: snapshots.openMaintenanceRequests,
        stoppedMachines: snapshots.stoppedMachines,
        pendingMaintenance: snapshots.pendingMaintenance,
        notes: dto.notes ?? null,
        status: 'DRAFT',
        createdByUserId: userId,
      },
      include: {
        outgoingShift: { select: { id: true, code: true, name: true } },
        incomingShift: { select: { id: true, code: true, name: true } },
        outgoingPerson: { select: { id: true, code: true, name: true } },
        incomingPerson: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        items: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'ShiftHandover',
      entityId: result.id,
      details: JSON.stringify({ companyId: ctx.companyId, outgoingShiftId: dto.outgoingShiftId, incomingShiftId: dto.incomingShiftId }),
    });

    return result;
  }

  async findAll(query: { page?: number; limit?: number; status?: string; departmentId?: string; handoverDateFrom?: string; handoverDateTo?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: any = { companyId: ctx.companyId, deletedAt: null, branchId: { in: [ctx.branchId, null] } };

    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.handoverDateFrom || query.handoverDateTo) {
      where.handoverDate = {};
      if (query.handoverDateFrom) where.handoverDate.gte = new Date(query.handoverDateFrom);
      if (query.handoverDateTo) where.handoverDate.lte = new Date(query.handoverDateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.shiftHandover.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { handoverDate: 'desc' },
        include: {
          outgoingShift: { select: { id: true, code: true, name: true } },
          incomingShift: { select: { id: true, code: true, name: true } },
          outgoingPerson: { select: { id: true, code: true, name: true } },
          incomingPerson: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.shiftHandover.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const handover = await this.prisma.shiftHandover.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: null, branchId: { in: [ctx.branchId, null] as any } },
      include: {
        outgoingShift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
        incomingShift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
        outgoingPerson: { select: { id: true, code: true, name: true } },
        incomingPerson: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!handover) throw new NotFoundException('Shift handover not found');
    return handover;
  }

  async update(id: string, dto: UpdateShiftHandoverDto, userId: string, ctx: ActiveOperationalContext) {
    const handover = await this.findOne(id, ctx);
    if (handover.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT handovers can be edited');
    }

    const result = await this.prisma.shiftHandover.update({
      where: { id },
      data: { notes: dto.notes ?? handover.notes },
      include: {
        outgoingShift: { select: { id: true, code: true, name: true } },
        incomingShift: { select: { id: true, code: true, name: true } },
        outgoingPerson: { select: { id: true, code: true, name: true } },
        incomingPerson: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        items: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'ShiftHandover',
      entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId }),
    });

    return result;
  }

  async submit(id: string, userId: string, ctx: ActiveOperationalContext) {
    const handover = await this.findOne(id, ctx);
    if (handover.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT handovers can be submitted');
    }

    const now = new Date();
    const result = await this.prisma.shiftHandover.update({
      where: { id, status: 'DRAFT' },
      data: { status: 'SUBMITTED', submittedAt: now },
      include: {
        outgoingShift: { select: { id: true, code: true, name: true } },
        incomingShift: { select: { id: true, code: true, name: true } },
        outgoingPerson: { select: { id: true, code: true, name: true } },
        incomingPerson: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        items: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'SUBMIT',
      entity: 'ShiftHandover',
      entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId, submittedAt: now.toISOString() }),
    });

    await this.notifyRecipient(handover.incomingPersonId, userId, 'SHIFT_HANDOVER_SUBMITTED', `Shift handover ${id} has been submitted for your incoming shift`, ctx);

    return result;
  }

  async acknowledge(id: string, userId: string, ctx: ActiveOperationalContext) {
    const handover = await this.findOne(id, ctx);
    if (handover.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED handovers can be acknowledged');
    }

    const now = new Date();
    const result = await this.prisma.shiftHandover.update({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: now },
      include: {
        outgoingShift: { select: { id: true, code: true, name: true } },
        incomingShift: { select: { id: true, code: true, name: true } },
        outgoingPerson: { select: { id: true, code: true, name: true } },
        incomingPerson: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        items: true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'ACKNOWLEDGE',
      entity: 'ShiftHandover',
      entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId, acknowledgedAt: now.toISOString() }),
    });

    await this.notifyRecipient(handover.outgoingPersonId, userId, 'SHIFT_HANDOVER_ACKNOWLEDGED', `Shift handover ${id} has been acknowledged`, ctx);

    return result;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const handover = await this.findOne(id, ctx);
    if (handover.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT handovers can be deleted');
    }

    await this.prisma.shiftHandover.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'ShiftHandover',
      entityId: id,
      details: JSON.stringify({ companyId: ctx.companyId }),
    });

    return { success: true };
  }

  async addItem(handoverId: string, dto: CreateShiftHandoverItemDto, userId: string, ctx: ActiveOperationalContext) {
    const handover = await this.findOne(handoverId, ctx);
    if (handover.status !== 'DRAFT') {
      throw new BadRequestException('Items can only be added to DRAFT handovers');
    }

    await this.validateItemEntity(dto.entityType, dto.entityId, ctx);

    const result = await this.prisma.shiftHandoverItem.create({
      data: {
        companyId: ctx.companyId,
        shiftHandoverId: handoverId,
        category: dto.category,
        entityType: dto.entityType,
        entityId: dto.entityId,
        entityCode: dto.entityCode ?? null,
        entitySummary: dto.entitySummary ?? null,
        priority: dto.priority ?? null,
        status: dto.status ?? null,
        notes: dto.notes ?? null,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'ShiftHandoverItem',
      entityId: result.id,
      details: JSON.stringify({ companyId: ctx.companyId, handoverId, category: dto.category, entityType: dto.entityType }),
    });

    return result;
  }

  async removeItem(itemId: string, userId: string, ctx: ActiveOperationalContext) {
    const item = await this.prisma.shiftHandoverItem.findFirst({
      where: { id: itemId, companyId: ctx.companyId, deletedAt: null },
      include: { handover: { select: { id: true, status: true } } },
    });
    if (!item) throw new NotFoundException('Shift handover item not found');
    if (item.handover.status !== 'DRAFT') {
      throw new BadRequestException('Items can only be removed from DRAFT handovers');
    }

    await this.prisma.shiftHandoverItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'ShiftHandoverItem',
      entityId: itemId,
      details: JSON.stringify({ companyId: ctx.companyId, handoverId: item.shiftHandoverId }),
    });

    return { success: true };
  }

  async listItems(handoverId: string, ctx: ActiveOperationalContext) {
    await this.findOne(handoverId, ctx);
    return this.prisma.shiftHandoverItem.findMany({
      where: { shiftHandoverId: handoverId, companyId: ctx.companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async validateItemEntity(entityType: string, entityId: string, ctx: ActiveOperationalContext) {
    if (!HANDOVER_ITEM_ENTITY_TYPES.includes(entityType as any)) {
      throw new BadRequestException(`Invalid entityType: ${entityType}`);
    }

    let found = false;
    switch (entityType) {
      case 'MAINTENANCE_REQUEST': {
        const entity = await this.prisma.maintenanceRequest.findFirst({
          where: { id: entityId, machine: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] }, deletedAt: null },
          select: { id: true, requestNumber: true },
        });
        found = !!entity;
        break;
      }
      case 'MACHINE': {
        const entity = await this.prisma.machine.findFirst({
          where: { id: entityId, companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }], deletedAt: null },
          select: { id: true, code: true },
        });
        found = !!entity;
        break;
      }
      case 'PRODUCTION_ORDER': {
        const entity = await this.prisma.productionOrder.findFirst({
          where: { id: entityId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          select: { id: true, orderNumber: true },
        });
        found = !!entity;
        break;
      }
      case 'PRODUCTION_NONCONFORMANCE': {
        const entity = await this.prisma.productionNonconformance.findFirst({
          where: { id: entityId, companyId: ctx.companyId, branchId: ctx.branchId },
          select: { id: true, ncrNumber: true },
        });
        found = !!entity;
        break;
      }
      case 'SPARE_PART': {
        const entity = await this.prisma.sparePart.findFirst({
          where: { id: entityId },
          select: { id: true, code: true },
        });
        found = !!entity;
        break;
      }
    }

    if (!found) {
      throw new BadRequestException(`${entityType} entity ${entityId} not found or not compatible with handover tenant scope`);
    }
  }

  private async notifyRecipient(personId: string | null, actorUserId: string, type: string, message: string, ctx: ActiveOperationalContext) {
    if (!personId) return;

    try {
      const recipientUserId = await this.resolveSupervisorUserId(personId, ctx);
      if (!recipientUserId) return;

      await this.notificationsService.dispatch({
        userId: recipientUserId,
        title: type,
        message,
        type: 'INFO',
      });
    } catch {
      // Notification failure does not fail the handover transaction
    }
  }

  private async resolveSupervisorUserId(personId: string, ctx: ActiveOperationalContext): Promise<string | null> {
    const personAssignment = await this.prisma.operationalPersonAssignment.findFirst({
      where: {
        personnelId: personId,
        companyId: ctx.companyId,
        effectiveTo: null,
        deletedAt: null,
      },
    });
    if (!personAssignment) return null;

    const supervisorLink = await this.prisma.supervisorAssignment.findFirst({
      where: {
        assignmentId: personAssignment.id,
        companyId: ctx.companyId,
        isActive: true,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (!supervisorLink?.supervisorAssignmentId) return null;

    const supervisorAssignment = await this.prisma.operationalPersonAssignment.findUnique({
      where: { id: supervisorLink.supervisorAssignmentId },
    });
    if (!supervisorAssignment?.personnelId) return null;

    const supervisorPerson = await this.prisma.operationalPerson.findUnique({
      where: { id: supervisorAssignment.personnelId },
      select: { userId: true },
    });
    return supervisorPerson?.userId ?? null;
  }
}
