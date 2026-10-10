import { Prisma } from '@prisma/client';
import { Optional } from '@nestjs/common';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';
import { assertMachineComponentBelongsToMachine } from '../../../../common/operational-context/tenant-guards';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { MaintenanceNotificationService } from '../maintenance-notification/maintenance-notification.service';
import { MaintenanceSlaService } from '../maintenance-sla/maintenance-sla.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { CurrentUserType } from '../../../../modules/auth/types/current-user.type';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import {
  ACTIVE_WORK_ORDER_STATUSES,
  MAINTENANCE_REQUEST_CLOSE_SOURCE_STATUS,
  OPEN_TASK_STATUSES,
  UNRESOLVED_REQUIRED_PART_STATUSES,
  blockerMessage,
  CloseReadiness,
  CloseReadinessBlocker,
} from './maintenance-request-close-policy';

@Injectable()
export class MaintenanceRequestsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private notificationService: MaintenanceNotificationService,
    private slaService: MaintenanceSlaService,
    @Optional() private downtimeService?: DowntimeLogsService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string, params?: Record<string, string>): BadRequestException {
    return new BadRequestException({ messageKey: key, message, ...(params ? { params } : {}) });
  }

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
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

  private async validateOperationalContext(dto: { machineId: string; productionLineId?: string; machineComponentId?: string; operationTypeId?: string; costCenterId?: string }, ctx: ActiveOperationalContext, requestId?: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) throw this.notFound('maintenance.machineNotFound', 'Machine not found');

    if (dto.productionLineId) {
      const pl = await this.prisma.productionLine.findUnique({ where: { id: dto.productionLineId } });
      if (!pl || pl.companyId !== ctx.companyId || pl.branchId !== ctx.branchId) {
        throw this.notFound('maintenance.productionLineNotFound', 'Production line not found');
      }
      if (pl.status !== 'ACTIVE' || pl.deletedAt) {
        throw this.badRequest('maintenance.inactiveProductionLine', 'Inactive production line cannot be referenced by a request');
      }
      if (dto.productionLineId !== machine.productionLineId) {
        throw this.badRequest('maintenance.productionLineMachineMismatch', 'Production line does not match machine');
      }
    } else if (machine.productionLineId) {
      dto.productionLineId = machine.productionLineId;
    }

    if (dto.machineComponentId) {
      await assertMachineComponentBelongsToMachine(this.prisma, dto.machineComponentId, dto.machineId, ctx);
      const comp = await this.prisma.machineComponent.findUnique({ where: { id: dto.machineComponentId } });
      if (!comp) throw this.notFound('maintenance.componentNotFound', 'Machine component not found');
      if (comp.machineId !== dto.machineId) {
        throw this.badRequest('maintenance.componentMachineMismatch', 'Component does not belong to selected machine');
      }
      if (comp.status !== 'ACTIVE' || comp.deletedAt) {
        throw this.badRequest('maintenance.inactiveMachineComponent', 'Inactive machine component cannot be referenced by a request');
      }
    }
    if (dto.operationTypeId) {
      const ot = await this.prisma.operationType.findUnique({ where: { id: dto.operationTypeId } });
      if (!ot) throw this.notFound('maintenance.operationTypeNotFound', 'Operation type not found');
      if (ot.status !== 'ACTIVE' || ot.deletedAt) {
        throw this.badRequest('maintenance.inactiveOperationType', 'Inactive operation type cannot be referenced by a request');
      }
      if (machine.operationTypeId && dto.operationTypeId !== machine.operationTypeId) {
        throw this.badRequest('maintenance.operationTypeMachineMismatch', 'Operation type does not match machine');
      }
    } else if (machine.operationTypeId) {
      dto.operationTypeId = machine.operationTypeId;
    }
    if (dto.costCenterId) {
      const cc = await this.prisma.costCenter.findUnique({ where: { id: dto.costCenterId } });
      if (!cc || cc.companyId !== ctx.companyId) {
        throw this.notFound('maintenance.costCenterNotFound', 'Cost center not found');
      }
      if (cc.branchId && cc.branchId !== ctx.branchId) {
        throw this.notFound('maintenance.costCenterNotFound', 'Cost center not found');
      }
      if (cc.status !== 'ACTIVE' || cc.deletedAt) {
        throw this.badRequest('maintenance.inactiveCostCenter', 'Inactive cost center cannot be referenced by a request');
      }
    } else if (machine.defaultCostCenterId) {
      dto.costCenterId = machine.defaultCostCenterId;
    }
    return machine;
  }

  async create(dto: CreateMaintenanceRequestDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    return this.createRequest(dto, user, false, ctx);
  }

  async createEmergency(dto: CreateMaintenanceRequestDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    return this.createRequest({ ...dto, machineStopped: dto.machineStopped ?? true }, user, true, ctx);
  }

  private async createRequest(dto: CreateMaintenanceRequestDto, user: CurrentUserType, isEmergency: boolean, ctx: ActiveOperationalContext) {
    const machine = await this.validateOperationalContext(dto, ctx);
    const userId = user.id;

    if (!isEmergency && dto.type === 'EMERGENCY') {
      throw this.badRequest(
        'maintenance.emergencyTypeRequiresEmergencyEndpoint',
        'Emergency requests must be created through the dedicated emergency endpoint',
      );
    }

    const { machineId, requiredParts, machineStopped, title: _legacyTitle, ...rest } = dto;
    if (machineStopped && !dto.description?.trim()) throw this.badRequest('maintenance.executionDescriptionRequired', 'Describe the machine stoppage');

    // R2-D: a required part is always born in DRAFT (dual-state F2/C defect closed)
    // and the same spare part may never appear more than once per request payload.
    if (requiredParts && requiredParts.length > 0) {
      const seen = new Set<string>();
      for (const p of requiredParts) {
        if (seen.has(p.sparePartId)) {
          throw this.badRequest('maintenance.sparePartAlreadyAddedToRequest', 'This spare part is already added to the request');
        }
        seen.add(p.sparePartId);
      }
    }

    let request: any;
    try {
      request = await this.prisma.$transaction(async (tx) => {
        const requestNumber = await this.numberingService.generateNumberAtomicWithClient('MAINTENANCE_REQUEST', tx);

        const created = await tx.maintenanceRequest.create({
          data: {
            ...rest,
            requestNumber,
            title: dto.description?.trim().slice(0, 160) || requestNumber,
            machineId,
            requestedById: userId,
            type: isEmergency ? 'EMERGENCY' : dto.type,
            isEmergency: isEmergency ? true : null,
            priority: isEmergency ? 'HIGH' : (dto.priority || 'MEDIUM'),
            requiredParts: requiredParts && requiredParts.length > 0 ? {
              create: requiredParts.map(p => ({
                sparePartId: p.sparePartId,
                machineComponentId: p.machineComponentId,
                machineId: p.machineId,
                quantity: p.quantity,
                unit: p.unit,
                usageNote: p.usageNote,
                isPrimary: p.isPrimary,
                status: 'DRAFT',
              })),
            } : undefined,
          },
        });
        if (machineStopped) {
          if (!this.downtimeService) throw new Error('Downtime service is not configured');
          await this.downtimeService.startOrReuseInTx(tx, { machineId, requestId: created.id, reason: dto.description!.trim(), notes: dto.notes }, userId, ctx);
        }
        await this.audit.logWithClient(tx, { userId, action: isEmergency ? 'EMERGENCY' : 'CREATE', entity: 'MaintenanceRequest', entityId: created.id, details: { requestNumber, machineId, machineStopped: !!machineStopped } });
        return created;
      });
    } catch (e: any) {
      // R2-D: a unique-constraint duplicate must surface as a canonical 400,
      // never as a user-visible 500.
      if (e?.code === 'P2002') {
        throw this.badRequest('maintenance.sparePartAlreadyAddedToRequest', 'This spare part is already added to the request');
      }
      throw e;
    }

    // Notifications are non-blocking side effects. A notification failure must never
    // prevent SLA bookkeeping for the request.
    try {
      if (request.assignedToId) {
        await this.notificationService.notifyRequestCreated(request);
      }
    } catch (e) {
      console.error(
        `[MaintenanceRequestsService.createRequest] notification failed for request ${request.id}`,
        e instanceof Error ? e.message : e,
      );
    }

    // SLA state creation is required bookkeeping. A failure must be observable
    // (logged as an error), never silently swallowed.
    try {
      await this.slaService.createSlaState(request.id, ctx);
    } catch (e) {
      console.error(
        `[MaintenanceRequestsService.createRequest] createSlaState failed for request ${request.id}`,
        e instanceof Error ? e.message : e,
      );
    }
    return request;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    machineId?: string; status?: string; type?: string; priority?: string;
    requestedById?: string; assignedToId?: string; executionEligible?: boolean;
    productionLineId?: string; machineComponentId?: string; operationTypeId?: string; costCenterId?: string; sparePartId?: string;
    isEmergency?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    where.machine = this.machineScope(ctx);
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { requestNumber: { contains: query.search } },
      ];
    }
    if (query.machineId) where.machineId = query.machineId;
    if (query.executionEligible) where.status = { in: ['OPEN', 'IN_PROGRESS'] };
    else if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;
    if (query.isEmergency !== undefined) where.isEmergency = query.isEmergency === 'true';
    if (query.requestedById) where.requestedById = query.requestedById;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.operationTypeId) where.operationTypeId = query.operationTypeId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.sparePartId) {
      where.requiredParts = { some: { sparePartId: query.sparePartId } };
    }

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true, status: true } },
          productionLine: { select: { id: true, code: true, name: true } },
          machineComponent: { select: { id: true, code: true, name: true } },
          operationType: { select: { id: true, code: true, name: true } },
          costCenter: { select: { id: true, code: true, name: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { tasks: true, requiredParts: true } },
        },
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    const requestIds = data.map(r => r.id);
    const [completedTasksByReq, openTasksByReq, downtimeByReq] = requestIds.length > 0
      ? await Promise.all([
          this.prisma.maintenanceTask.groupBy({
            by: ['requestId'], where: { requestId: { in: requestIds }, status: 'DONE' }, _count: true,
          }),
          this.prisma.maintenanceTask.groupBy({
            by: ['requestId'], where: { requestId: { in: requestIds }, status: { in: ['PENDING', 'IN_PROGRESS'] } }, _count: true,
          }),
          this.prisma.downtimeLog.groupBy({
            by: ['requestId'], where: { requestId: { in: requestIds }, cancelledAt: null }, _sum: { durationMinutes: true },
          }),
        ])
      : [[], [], []];

    const completedMap = Object.fromEntries(completedTasksByReq.map(r => [r.requestId, r._count]));
    const openMap = Object.fromEntries(openTasksByReq.map(r => [r.requestId, r._count]));
    const downtimeMap = Object.fromEntries(downtimeByReq.map(r => [r.requestId, r._sum.durationMinutes || 0]));

    const dataWithSummary = data.map((req) => ({
      ...req,
      summary: {
        tasksCount: req._count.tasks,
        requiredPartsCount: req._count.requiredParts,
        completedTasksCount: completedMap[req.id] || 0,
        openTasksCount: openMap[req.id] || 0,
        totalDowntimeHours: (downtimeMap[req.id] || 0) / 60,
      },
    }));

    return { data: dataWithSummary, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id, deletedAt: null, machine: this.machineScope(ctx) },
      include: {
        machine: true,
        productionLine: true,
        machineComponent: true,
        operationType: true,
        costCenter: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        tasks: true,
        downtimeLogs: true,
        schedules: true,
        requiredParts: {
          include: {
            sparePart: true,
            machineComponent: { select: { id: true, code: true, name: true } },
            machine: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!request || request.deletedAt || !this.machineOwns(request.machine, ctx)) {
      throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    }
    return request;
  }

  async update(id: string, dto: UpdateMaintenanceRequestDto, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status === 'CLOSED') {
      throw this.badRequest(
        'maintenance.requestClosedImmutable',
        'The request is CLOSED and accepts no operational change. An authorized reopen is required first.',
      );
    }
    if (req.status === 'CANCELLED') {
      throw this.badRequest(
        'maintenance.requestCancelledImmutable',
        'The request is CANCELLED and accepts no operational or cost change.',
      );
    }
    if (req.status === 'COMPLETED') {
      throw this.badRequest('maintenance.cannotUpdateTerminalRequest', 'Cannot update completed, cancelled, or closed requests');
    }

    const forbidden = ['status', 'type', 'startDate', 'endDate', 'downtimeHours', 'cost', 'assignedToId', 'requiredParts', 'requestedById', 'isEmergency'];
    const forbiddenPresent = forbidden.filter((f) => (dto as any)[f] !== undefined);
    if (forbiddenPresent.length > 0) {
      throw this.badRequest(
        'maintenance.forbiddenRequestFieldUpdate',
        'Lifecycle, assignment, and part fields cannot be modified through the generic update endpoint',
        { fields: forbiddenPresent.join(', ') },
      );
    }

    if (dto.machineId) {
      await this.validateOperationalContext(dto as any, ctx);
    } else {
      if (dto.productionLineId || dto.machineComponentId || dto.operationTypeId || dto.costCenterId) {
        const currentMachineId = dto.machineId || req.machineId;
        await this.validateOperationalContext({ machineId: currentMachineId, ...dto } as any, ctx);
      }
    }

    const data: any = { ...dto };
    if (dto.productionLineId === null || dto.productionLineId === '') data.productionLineId = null;
    if (dto.machineComponentId === null || dto.machineComponentId === '') data.machineComponentId = null;
    if (dto.operationTypeId === null || dto.operationTypeId === '') data.operationTypeId = null;
    if (dto.costCenterId === null || dto.costCenterId === '') data.costCenterId = null;

    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql([
        'SELECT r.[id] FROM [dbo].[maintenance_requests] r WITH (UPDLOCK,HOLDLOCK) JOIN [dbo].[machines] m ON m.[id]=r.[machineId] WHERE r.[id]=',
        ' AND m.[companyId]=', ' AND (m.[branchId]=', ' OR m.[branchId] IS NULL)',
      ], id, ctx.companyId, ctx.branchId));
      const current = await tx.maintenanceRequest.findFirst({ where: { id, deletedAt: null, machine: this.machineScope(ctx) } });
      if (!current) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
      if (current.status !== req.status || current.updatedAt && req.updatedAt && +current.updatedAt !== +req.updatedAt) {
        throw new ConflictException({ messageKey: 'maintenance.executionConcurrentChange' });
      }
      const changingScope = ['machineId', 'machineComponentId', 'productionLineId', 'costCenterId', 'operationTypeId']
        .some(key => data[key] !== undefined && (data[key] || null) !== ((current as any)[key] || null));
      if (changingScope) {
        const [executions, stops, parts] = await Promise.all([
          tx.maintenanceTask.count({ where: { requestId: id } }),
          tx.downtimeLog.count({ where: { requestId: id, cancelledAt: null } }),
          tx.maintenanceRequestRequiredPart.count({ where: { maintenanceRequestId: id } }),
        ]);
        if (executions || stops || parts) throw this.badRequest('maintenance.executionSourceImmutable', 'Source context is immutable after operational evidence exists');
      }
      const updated = await tx.maintenanceRequest.update({ where: { id }, data });
      await this.audit.logWithClient(tx, { userId, action: 'UPDATE', entity: 'MaintenanceRequest', entityId: id,
        details: { oldStatus: req.status, companyId: ctx.companyId, branchId: ctx.branchId } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  }

  // -- Required Parts sub-resource --

  async getRequiredParts(requestId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(requestId, ctx);
    return this.prisma.maintenanceRequestRequiredPart.findMany({
      where: { maintenanceRequestId: requestId },
      include: {
        sparePart: true,
        machineComponent: { select: { id: true, code: true, name: true } },
        machine: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async addRequiredPart(requestId: string, dto: { sparePartId: string; machineComponentId?: string; machineId?: string; quantity: number; unit?: string; usageNote?: string; isPrimary?: boolean }, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(requestId, ctx);
    if (req.status === 'COMPLETED' || req.status === 'CANCELLED' || req.status === 'CLOSED') {
      throw this.badRequest('maintenance.cannotUpdatePartsTerminalRequest', 'Cannot update parts on completed, cancelled, or closed requests');
    }

    const sparePart = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
    if (!sparePart) throw this.notFound('maintenance.sparePartNotFound', 'Spare part not found');
    if (sparePart.status !== 'ACTIVE') throw this.badRequest('maintenance.inactiveSparePart', 'Inactive spare part cannot be requested');

    const existing = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { maintenanceRequestId_sparePartId: { maintenanceRequestId: requestId, sparePartId: dto.sparePartId } },
    });
    // R2-D: only a live (non-terminal) duplicate blocks re-adding; a CANCELLED/REJECTED
    // line may be replaced by a new DRAFT line, matching the canonical add-part path.
    if (existing && !['CANCELLED', 'USED', 'REJECTED'].includes(existing.status)) {
      throw this.badRequest('maintenance.sparePartAlreadyAddedToRequest', 'This spare part is already added to the request');
    }

    if (dto.machineComponentId) {
      const comp = await this.prisma.machineComponent.findUnique({ where: { id: dto.machineComponentId } });
      if (!comp) throw this.notFound('maintenance.componentNotFound', 'Machine component not found');
      if (comp.machineId !== req.machineId) throw this.badRequest('maintenance.componentMachineMismatch', 'Component does not belong to selected machine');
    }
    if (dto.machineId && dto.machineId !== req.machineId) {
      throw this.badRequest('maintenance.machineRequestMismatch', 'Machine does not match request machine');
    }

    let part: any;
    try {
      part = await this.prisma.maintenanceRequestRequiredPart.create({
        data: {
          maintenanceRequestId: requestId,
          sparePartId: dto.sparePartId,
          machineComponentId: dto.machineComponentId,
          machineId: dto.machineId || req.machineId,
          quantity: dto.quantity,
          unit: dto.unit,
          usageNote: dto.usageNote,
          isPrimary: dto.isPrimary,
          status: 'DRAFT',
        },
      });
    } catch (e: any) {
      // R2-D: a unique-constraint duplicate must surface as a canonical 400,
      // never as a user-visible 500.
      if (e?.code === 'P2002') {
        throw this.badRequest('maintenance.sparePartAlreadyAddedToRequest', 'This spare part is already added to the request');
      }
      throw e;
    }
    await this.audit.log(userId, 'CREATE', 'MaintenanceRequestRequiredPart', part.id,
      { requestId, sparePartId: dto.sparePartId });
    return part;
  }

  async updateRequiredPart(id: string, dto: { quantity?: number; unit?: string; usageNote?: string; isPrimary?: boolean }, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.prisma.maintenanceRequestRequiredPart.findUnique({ where: { id }, include: { maintenanceRequest: { include: { machine: true } } } });
    if (!part || !this.machineOwns(part.maintenanceRequest.machine, ctx)) throw this.notFound('maintenance.requiredPartNotFound', 'Required part not found');
    if (part.maintenanceRequest.status === 'COMPLETED' || part.maintenanceRequest.status === 'CANCELLED' || part.maintenanceRequest.status === 'CLOSED') {
      throw this.badRequest('maintenance.cannotUpdatePartsTerminalRequest', 'Cannot update parts on completed, cancelled, or closed requests');
    }
    // R2-D: a required part is only editable in DRAFT. Editing REQUESTED/APPROVED/
    // RESERVED lines through this generic route would bypass the part-level FSM and
    // could violate approvedQuantity <= requestedQuantity.
    if (part.status !== 'DRAFT') {
      throw this.badRequest('maintenance.partNotEditableInStatus', 'Parts can only be edited while in DRAFT status', { status: part.status });
    }
    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id },
      data: dto,
    });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequestRequiredPart', id, dto);
    return updated;
  }

  async cancelRequiredPart(id: string, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.prisma.maintenanceRequestRequiredPart.findUnique({ where: { id }, include: { maintenanceRequest: { include: { machine: true } } } });
    if (!part || !this.machineOwns(part.maintenanceRequest.machine, ctx)) throw this.notFound('maintenance.requiredPartNotFound', 'Required part not found');
    if (part.maintenanceRequest.status === 'COMPLETED' || part.maintenanceRequest.status === 'CANCELLED' || part.maintenanceRequest.status === 'CLOSED') {
      throw this.badRequest('maintenance.cannotUpdatePartsTerminalRequest', 'Cannot update parts on completed, cancelled, or closed requests');
    }
    // R2-D: USED/REJECTED/CANCELLED are terminal part states and can never be cancelled.
    // Previously only CANCELLED was guarded, so a USED part could be cancelled.
    if (['USED', 'REJECTED', 'CANCELLED'].includes(part.status)) {
      throw this.badRequest('maintenance.partTerminalCannotCancel', 'Cannot cancel a part in terminal status', { status: part.status });
    }
    const updated = await this.prisma.maintenanceRequestRequiredPart.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledByUserId: userId, cancelledAt: new Date() },
    });
    await this.audit.log(userId, 'CANCEL', 'MaintenanceRequestRequiredPart', id, { oldStatus: part.status });
    return updated;
  }

  // -- Existing methods unchanged below --

  async startWithClient(tx: any, id: string, userId: string, ctx: ActiveOperationalContext, at = new Date()) {
    const req = await tx.maintenanceRequest.findFirst({ where: { id, deletedAt: null, machine: this.machineScope(ctx) } });
    if (!req) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    if (req.status === 'IN_PROGRESS') return req;
    if (req.status !== 'OPEN') throw this.badRequest('maintenance.onlyOpenCanStart', 'Only OPEN requests can be started');
    await tx.machine.update({ where: { id: req.machineId }, data: { status: 'UNDER_MAINTENANCE' } });
    const updated = await tx.maintenanceRequest.update({ where: { id }, data: { status: 'IN_PROGRESS', startDate: at } });
    await this.audit.logWithClient(tx, { userId, action: 'START', entity: 'MaintenanceRequest', entityId: id,
      details: { oldStatus: req.status, newStatus: 'IN_PROGRESS', machineId: req.machineId } });
    return updated;
  }

  /** Existing notifications/SLA remain post-commit effects; a rolled-back execution never emits them. */
  async notifyCommittedExecutionTransition(id: string, action: 'START' | 'COMPLETE', at: Date, ctx: ActiveOperationalContext) {
    try {
      const request = await this.findOne(id, ctx);
      const changedAt = action === 'START' ? request.startDate : request.endDate;
      if (!at || !changedAt || +changedAt !== +at) return;
      if (action === 'START') {
        await this.notificationService.notifyRequestStarted(request);
        await this.slaService.recalculateSla(id, ctx);
      } else {
        await this.notificationService.notifyRequestCompleted(request);
      }
    } catch (error) { console.error('Maintenance execution post-commit notification/SLA failed', error); }
  }

  async start(id: string, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status !== 'OPEN') throw this.badRequest('maintenance.onlyOpenCanStart', 'Only OPEN requests can be started');
    const updated = await this.prisma.$transaction(tx => this.startWithClient(tx, id, userId, ctx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    try {
      await this.notificationService.notifyRequestStarted(await this.findOne(id, ctx));
      await this.slaService.recalculateSla(id, ctx);
    } catch (error) { console.error('Maintenance request start notification/SLA failed', error); }
    return updated;
  }

  /**
   * R2-H: the single canonical execution-readiness evaluator.
   *
   * complete(), close() and the read-only close-readiness endpoint all consume
   * this one function, so a close-readiness banner, the completion transition
   * and the close transition can never disagree about what is outstanding.
   * A repair order is deliberately NOT a blocker: a spare-part repair order is
   * the independent lifecycle of an old removed part (see the R2-H policy
   * decision), and the machine is already restored by the replacement, so
   * blocking close on it would strand finished maintenance for the weeks an
   * offsite refurbishment can take.
   */
  private async collectCloseBlockers(id: string, client: any = this.prisma): Promise<CloseReadinessBlocker[]> {
    const blockers: CloseReadinessBlocker[] = [];

    const openTasks = await client.maintenanceTask.findMany({
      where: { requestId: id, status: { in: [...OPEN_TASK_STATUSES] } },
      select: { id: true },
    });
    if (openTasks.length > 0) {
      blockers.push({ code: 'OPEN_TASKS', count: openTasks.length, messageKey: 'maintenance.openTasksBlockCompletion', params: { count: String(openTasks.length) } });
    }

    const unresolvedParts = await client.maintenanceRequestRequiredPart.findMany({
      where: { maintenanceRequestId: id, status: { in: [...UNRESOLVED_REQUIRED_PART_STATUSES] } },
      select: { id: true },
    });
    if (unresolvedParts.length > 0) {
      blockers.push({ code: 'UNRESOLVED_REQUIRED_PARTS', count: unresolvedParts.length, messageKey: 'maintenance.unresolvedPartsBlockCompletion', params: { count: String(unresolvedParts.length) } });
    }

    const openWorkOrders = await client.maintenanceWorkOrder.findMany({
      where: { requestId: id, status: { in: [...ACTIVE_WORK_ORDER_STATUSES] } },
      select: { id: true },
    });
    if (openWorkOrders.length > 0) {
      blockers.push({ code: 'ACTIVE_WORK_ORDERS', count: openWorkOrders.length, messageKey: 'maintenance.openWorkOrdersBlockCompletion', params: { count: String(openWorkOrders.length) } });
    }

    const incompleteChecklists = await client.maintenanceChecklistExecution.findMany({
      where: { requestId: id, status: 'IN_PROGRESS' },
      include: {
        items: {
          where: { status: 'PENDING', checklistItem: { isMandatory: true } },
          include: { checklistItem: { select: { id: true, title: true, isMandatory: true } } },
        },
      },
    });
    const blockingMandatory = incompleteChecklists.flatMap((ce: any) => ce.items);
    if (blockingMandatory.length > 0) {
      blockers.push({ code: 'MANDATORY_CHECKLIST_PENDING', count: blockingMandatory.length, messageKey: 'maintenance.mandatoryChecklistPending', params: { count: String(blockingMandatory.length) } });
    }

    return blockers;
  }

  private throwFirstBlocker(blockers: CloseReadinessBlocker[]): void {
    const first = blockers[0];
    if (!first) return;
    throw this.badRequest(first.messageKey, blockerMessage(first.code, first.count), first.params);
  }

  /**
   * R2-H: read-only close readiness for the request detail UI. It reports
   * structured blocker codes and counts so the UI can render a checklist and
   * the operator can see exactly what must be resolved before closing.
   */
  async getCloseReadiness(id: string, ctx: ActiveOperationalContext): Promise<CloseReadiness> {
    const req = await this.findOne(id, ctx);
    const completionBlockers = await this.collectCloseBlockers(id);

    const closeBlockers: CloseReadinessBlocker[] = [];
    if (req.status !== MAINTENANCE_REQUEST_CLOSE_SOURCE_STATUS) {
      closeBlockers.push({ code: 'REQUEST_NOT_COMPLETED', count: 1, messageKey: 'maintenance.onlyCompletedCanClose', params: {} });
    }
    closeBlockers.push(...completionBlockers);

    return {
      requestId: id,
      status: req.status,
      canComplete: req.status === 'IN_PROGRESS' && completionBlockers.length === 0,
      canClose: closeBlockers.length === 0,
      completionBlockers,
      closeBlockers,
    };
  }

  async completeWithClient(tx: any, id: string, userId: string, ctx: ActiveOperationalContext, completedAt = new Date()) {
    const req = await tx.maintenanceRequest.findFirst({ where: { id, deletedAt: null, machine: this.machineScope(ctx) } });
    if (!req) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    if (req.status !== 'IN_PROGRESS') throw this.badRequest('maintenance.onlyInProgressCanComplete', 'Only IN_PROGRESS requests can be completed');
    this.throwFirstBlocker(await this.collectCloseBlockers(id, tx));
    const downtimeAgg = await tx.downtimeLog.aggregate({ where: { requestId: id, cancelledAt: null }, _sum: { durationMinutes: true } });
    const downtimeHours = downtimeAgg._sum.durationMinutes ? downtimeAgg._sum.durationMinutes / 60 : null;
    const activeRequests = await tx.maintenanceRequest.count({ where: { machineId: req.machineId, status: 'IN_PROGRESS', id: { not: id }, deletedAt: null } });
    const activeDowntime = await tx.downtimeLog.count({ where: { machineId: req.machineId, endTime: null, cancelledAt: null } });
    if (activeRequests === 0 && activeDowntime === 0) await tx.machine.update({ where: { id: req.machineId }, data: { status: 'ACTIVE' } });
    const updated = await tx.maintenanceRequest.update({ where: { id }, data: { status: 'COMPLETED', endDate: completedAt, downtimeHours } });
    await this.audit.logWithClient(tx, { userId, action: 'COMPLETE', entity: 'MaintenanceRequest', entityId: id,
      details: { oldStatus: req.status, newStatus: 'COMPLETED', machineId: req.machineId, downtimeHours, companyId: ctx.companyId, branchId: ctx.branchId } });
    return updated;
  }

  async complete(id: string, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status !== 'IN_PROGRESS') throw this.badRequest('maintenance.onlyInProgressCanComplete', 'Only IN_PROGRESS requests can be completed');
    this.throwFirstBlocker(await this.collectCloseBlockers(id));
    const updated = await this.prisma.$transaction(tx => this.completeWithClient(tx, id, userId, ctx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    try { await this.notificationService.notifyRequestCompleted(await this.findOne(id, ctx)); }
    catch (error) { console.error('Maintenance request completion notification failed', error); }
    return updated;
  }

  async close(id: string, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status !== MAINTENANCE_REQUEST_CLOSE_SOURCE_STATUS) {
      throw this.badRequest(
        'maintenance.closeRequiresCompleted',
        `A request can only be closed after it is COMPLETED. The current status is ${req.status}.`,
        { status: req.status },
      );
    }
    // Fail closed on the same evaluator completion uses, so a record that
    // became inconsistent after completion can never be closed.
    const blockers = await this.collectCloseBlockers(id);
    if (blockers.length > 0) {
      throw this.badRequest(
        'maintenance.closeBlockedByReadiness',
        `Cannot close request: ${blockers.length} readiness blocker(s) remain unresolved.`,
        { count: String(blockers.length) },
      );
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    await this.audit.log(userId, 'CLOSE', 'MaintenanceRequest', id,
      { oldStatus: req.status, newStatus: 'CLOSED' });

    try {
      const closedRequest = await this.findOne(id, ctx);
      await this.notificationService.notifyRequestClosed(closedRequest);
    } catch { }
    return updated;
  }

  async cancel(id: string, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status !== 'OPEN' && req.status !== 'IN_PROGRESS') {
      throw this.badRequest('maintenance.onlyOpenInProgressCanCancel', 'Only OPEN or IN_PROGRESS requests can be cancelled');
    }

    // R2-C: never orphan execution work orders. When a linked work order is already
    // planned or in progress the request cannot be cancelled; the operator must
    // cancel the work orders first. DRAFT work orders do not block cancellation and
    // are never cascade-cancelled.
    const activeWorkOrders = await this.prisma.maintenanceWorkOrder.findMany({
      where: { requestId: id, status: { in: ['PLANNED', 'IN_PROGRESS'] }, deletedAt: null },
      select: { id: true },
    });
    if (activeWorkOrders.length > 0) {
      throw this.badRequest(
        'maintenance.activeWorkOrdersBlockCancel',
        `Cannot cancel request: ${activeWorkOrders.length} work order(s) are still planned or in progress. Cancel the work orders first.`,
        { count: String(activeWorkOrders.length) },
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (req.status === 'IN_PROGRESS') {
        const activeRequests = await tx.maintenanceRequest.count({
          where: { machineId: req.machineId, status: 'IN_PROGRESS', id: { not: id }, deletedAt: null },
        });
        if (activeRequests === 0) {
          await tx.machine.update({
            where: { id: req.machineId },
            data: { status: 'ACTIVE' },
          });
        }
      }
      return tx.maintenanceRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    await this.audit.log(userId, 'CANCEL', 'MaintenanceRequest', id,
      { oldStatus: req.status, newStatus: 'CANCELLED', machineId: req.machineId });
    return updated;
  }

  async assign(id: string, assignedToId: string, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status === 'COMPLETED' || req.status === 'CANCELLED' || req.status === 'CLOSED') {
      throw this.badRequest('maintenance.cannotAssignTerminalRequest', 'Cannot assign completed, cancelled, or closed requests');
    }

    const user = await this.prisma.user.findUnique({ where: { id: assignedToId } });
    if (!user) throw this.notFound('organization.userNotFound', 'User not found');
    if (user.companyId && user.companyId !== ctx.companyId) {
      throw this.badRequest('maintenance.assignedUserCompanyMismatch', 'Assigned user belongs to another company');
    }
    if (user.branchId && user.branchId !== ctx.branchId) {
      throw this.badRequest('maintenance.assignedUserBranchMismatch', 'Assigned user belongs to another branch');
    }
    if (user.status !== 'ACTIVE' || user.deletedAt) {
      throw this.badRequest('maintenance.assignedUserNotActive', 'Assigned user is not active');
    }

    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { assignedToId },
    });
    await this.audit.log(userId, 'UPDATE', 'MaintenanceRequest', id,
      { action: 'assign', assignedToId, oldAssignedToId: req.assignedToId });

    try {
      const assignedRequest = await this.findOne(id, ctx);
      await this.notificationService.notifyRequestAssigned(assignedRequest, assignedToId);
    } catch { }
    return updated;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status !== 'OPEN') {
      if (req.status === 'IN_PROGRESS') {
        throw this.badRequest('maintenance.cannotDeleteInProgressRequest', 'Cannot delete an in-progress request');
      }
      throw this.badRequest(
        'maintenance.onlyOpenRequestsCanBeDeleted',
        'Only OPEN maintenance requests without execution history can be deleted',
      );
    }
    await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log(userId, 'DELETE', 'MaintenanceRequest', id,
      { status: req.status });
    return { message: 'Maintenance request deleted successfully' };
  }

  async reopen(id: string, userId: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    if (req.status !== 'COMPLETED' && req.status !== 'CANCELLED' && req.status !== 'CLOSED') {
      throw this.badRequest('maintenance.onlyTerminalCanReopen', 'Only completed, cancelled, or closed requests can be reopened');
    }
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: { status: 'OPEN', endDate: null, downtimeHours: null },
    });
    // R2-C: reopening a terminal request is a header-only operation. Work orders are
    // never mutated; the audit records the current linked work-order context so the
    // reopen is fully accountable (reopen keeps COMPLETED/CANCELLED evidence intact).
    const linkedWorkOrders = await this.prisma.maintenanceWorkOrder.findMany({
      where: { requestId: id, deletedAt: null },
      select: { id: true, workOrderNumber: true, status: true },
    });
    await this.audit.log(userId, 'REOPEN', 'MaintenanceRequest', id,
      {
        oldStatus: req.status,
        newStatus: 'OPEN',
        linkedWorkOrders: linkedWorkOrders.map((w) => ({ id: w.id, workOrderNumber: w.workOrderNumber, status: w.status })),
      });
    return updated;
  }

  async getWorkflow(id: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    const transitions: { action: string; fromStatus: string; toStatus: string; permission: string }[] = [];
    switch (req.status) {
      case 'OPEN':
        transitions.push({ fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', action: 'start', permission: 'maintenance-request:start' });
        transitions.push({ fromStatus: 'OPEN', toStatus: 'CANCELLED', action: 'cancel', permission: 'maintenance-request:cancel' });
        break;
      case 'IN_PROGRESS':
        transitions.push({ fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', action: 'complete', permission: 'maintenance-request:complete' });
        transitions.push({ fromStatus: 'IN_PROGRESS', toStatus: 'CANCELLED', action: 'cancel', permission: 'maintenance-request:cancel' });
        break;
      case 'COMPLETED':
        transitions.push({ fromStatus: 'COMPLETED', toStatus: 'CLOSED', action: 'close', permission: 'maintenance-request:close' });
        transitions.push({ fromStatus: 'COMPLETED', toStatus: 'OPEN', action: 'reopen', permission: 'maintenance-request:reopen' });
        break;
      case 'CANCELLED':
        transitions.push({ fromStatus: 'CANCELLED', toStatus: 'OPEN', action: 'reopen', permission: 'maintenance-request:reopen' });
        break;
      case 'CLOSED':
        transitions.push({ fromStatus: 'CLOSED', toStatus: 'OPEN', action: 'reopen', permission: 'maintenance-request:reopen' });
        break;
    }
    const historyLogs = await this.prisma.auditLog.findMany({
      where: { entity: 'MaintenanceRequest', entityId: id, action: { in: ['CREATE', 'START', 'COMPLETE', 'CLOSE', 'CANCEL', 'REOPEN', 'UPDATE'] } },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
    const history = historyLogs.map((log) => {
      let details: any = null;
      if (typeof log.details === 'string') {
        try { details = JSON.parse(log.details); } catch { details = null; }
      } else {
        details = log.details;
      }
      return {
        id: log.id,
        action: log.action,
        performedBy: log.user,
        createdAt: log.createdAt,
        fromStatus: details?.oldStatus || null,
        toStatus: details?.newStatus || null,
        notes: details?.notes || null,
      };
    });
    return { id: req.id, requestNumber: req.requestNumber, title: req.title, status: req.status, currentStatus: req.status, transitions, history };
  }

  async getActivity(id: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entity: 'MaintenanceRequest', entityId: id },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { entity: 'MaintenanceRequest', entityId: id } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAttachments(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    return this.prisma.attachment.findMany({
      where: { entityName: 'MAINTENANCE_REQUEST', entityId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPrintData(id: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    const [parts, costs, tasks, downtimes] = await Promise.all([
      this.prisma.maintenanceRequestPartUsage.findMany({
        where: { requestId: id },
        include: { product: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.maintenanceRequestCostEntry.findMany({ where: { requestId: id } }),
      this.prisma.maintenanceTask.findMany({
        where: { requestId: id },
        include: { assignedTo: { select: { id: true, name: true } } },
      }),
      this.prisma.downtimeLog.findMany({
        where: { requestId: id },
        include: { machine: { select: { id: true, name: true, code: true } } },
      }),
    ]);
    return {
      ...req,
      parts,
      costs,
      tasks,
      downtimes,
      partsUsed: parts,
      costEntries: costs,
      downtimeLogs: downtimes,
    };
  }

  async getChecklists(id: string, ctx: ActiveOperationalContext) {
    await this.findOne(id, ctx);
    const executions = await this.prisma.maintenanceChecklistExecution.findMany({
      where: { requestId: id },
      include: {
        schedule: { select: { id: true, title: true } },
        completedBy: { select: { id: true, name: true } },
        items: {
          include: { checklistItem: { select: { id: true, title: true, isMandatory: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return executions.map((execution) => ({
      ...execution,
      _count: { items: execution.items.length },
    }));
  }

  async getChecklistExecution(requestId: string, executionId: string, ctx: ActiveOperationalContext) {
    await this.findOne(requestId, ctx);
    const execution = await this.prisma.maintenanceChecklistExecution.findFirst({
      where: { id: executionId, requestId },
      include: {
        schedule: { select: { id: true, title: true, type: true } },
        completedBy: { select: { id: true, name: true } },
        items: {
          include: { checklistItem: true },
          orderBy: { checklistItem: { sortOrder: 'asc' } },
        },
      },
    });
    if (!execution) throw this.notFound('maintenance.checklistExecutionNotFound', 'Checklist execution not found for this request');
    return execution;
  }

  async createChecklist(id: string, scheduleId: string, userId: string, ctx: ActiveOperationalContext) {
    const request = await this.findOne(id, ctx);
    if (request.status === 'COMPLETED' || request.status === 'CANCELLED' || request.status === 'CLOSED') {
      throw this.badRequest('maintenance.cannotAddChecklistTerminalRequest', 'Cannot add checklist executions to completed, cancelled, or closed requests');
    }
    const schedule = await this.prisma.maintenanceSchedule.findUnique({ where: { id: scheduleId }, include: { machine: true } });
    if (!schedule || !this.machineOwns(schedule.machine, ctx)) throw this.notFound('maintenance.checklistScheduleNotFound', 'Schedule not found');

    const checklistItems = await this.prisma.maintenanceChecklistItem.findMany({
      where: { scheduleId },
      orderBy: { sortOrder: 'asc' },
    });

    const execution = await this.prisma.maintenanceChecklistExecution.create({
      data: {
        scheduleId,
        requestId: id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        completedById: userId,
        items: {
          create: checklistItems.map(item => ({
            checklistItemId: item.id,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    await this.audit.log(userId, 'CREATE', 'MaintenanceChecklistExecution', execution.id,
      { requestId: id, scheduleId });
    return execution;
  }

  async getRequestSummary(id: string, ctx: ActiveOperationalContext) {
    const req = await this.findOne(id, ctx);
    const [partsCount, costsCount, tasksCount, downtimeCount, totalCost] = await Promise.all([
      this.prisma.maintenanceRequestPartUsage.count({ where: { requestId: id } }),
      this.prisma.maintenanceRequestCostEntry.count({ where: { requestId: id } }),
      this.prisma.maintenanceTask.count({ where: { requestId: id } }),
      this.prisma.downtimeLog.count({ where: { requestId: id } }),
      this.prisma.maintenanceRequestCostEntry.aggregate({ where: { requestId: id }, _sum: { amount: true } }),
    ]);
    return {
      ...req,
      summary: { partsCount, costsCount, tasksCount, downtimeCount, totalCost: totalCost._sum.amount || 0 },
    };
  }
}
