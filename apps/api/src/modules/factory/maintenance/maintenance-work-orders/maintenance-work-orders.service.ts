import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { CreateMaintenanceWorkOrderDto, CreateWorkOrderPartDto } from './dto/create-maintenance-work-order.dto';
import { UpdateMaintenanceWorkOrderDto } from './dto/update-maintenance-work-order.dto';
import { AddWorkOrderPartDto, UpdateWorkOrderPartDto, IssueWorkOrderPartsDto } from './dto/work-order-part.dto';
import { AddWorkOrderCostEntryDto, UpdateWorkOrderCostEntryDto } from './dto/work-order-cost-entry.dto';
import { WorkOrderStatusActionDto } from './dto/work-order-status-action.dto';
import { CurrentUserType } from '../../../../modules/auth/types/current-user.type';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';

const FORBIDDEN_WAREHOUSE_TYPES = ['PRODUCT', 'RAW_MATERIAL'];

@Injectable()
export class MaintenanceWorkOrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private valuationEngine: InventoryValuationEngineService,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ messageKey: 'maintenance.workOrderNotFound', message });
  }

  private scope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }

  private owns(wo: { companyId: string; branchId: string }, ctx: ActiveOperationalContext): boolean {
    return wo.companyId === ctx.companyId && wo.branchId === ctx.branchId;
  }

  private readonly includeDetail = {
    company: { select: { id: true, name: true } },
    branch: { select: { id: true, name: true } },
    machine: { select: { id: true, code: true, name: true } },
    machineComponent: { select: { id: true, code: true, name: true } },
    request: { select: { id: true, requestNumber: true, title: true } },
    warehouse: { select: { id: true, code: true, name: true } },
    assignedTo: { select: { id: true, name: true } },
    supervisor: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true } },
    parts: {
      orderBy: { createdAt: 'asc' as const },
      include: {
        sparePart: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, code: true, name: true } },
        lastIssueBy: { select: { id: true, name: true } },
      },
    },
    costEntries: {
      orderBy: { incurredAt: 'asc' as const },
      include: { createdBy: { select: { id: true, name: true } } },
    },
  };

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const wo = await this.prisma.maintenanceWorkOrder.findUnique({
      where: { id },
      include: this.includeDetail,
    });
    if (!wo || !this.owns(wo, ctx)) {
      throw this.notFound('Maintenance work order not found');
    }
    return wo;
  }

  private async assertOwnedRef(
    model: 'machine' | 'machineComponent' | 'warehouse' | 'maintenanceRequest',
    id: string | undefined,
    field: string,
    ctx: ActiveOperationalContext,
  ) {
    if (!id) return;
    const record = await (this.prisma[model] as any).findUnique({ where: { id } });
    if (!record) {
      throw this.validationError(field, 'validation.invalidReference', `Referenced ${model} not found`);
    }
    // Machines and components may carry company/branch on the record itself;
    // validate any available tenant fields match the active context.
    if (record.companyId && record.companyId !== ctx.companyId) {
      throw this.validationError(field, 'validation.invalidReference', `Referenced ${model} belongs to another company`);
    }
    if (record.branchId && record.branchId !== ctx.branchId) {
      throw this.validationError(field, 'validation.invalidReference', `Referenced ${model} belongs to another branch`);
    }
    if (model === 'maintenanceRequest' && record.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: record.machineId } });
      if (machine && machine.companyId && machine.companyId !== ctx.companyId) {
        throw this.validationError(field, 'validation.invalidReference', 'Referenced request belongs to another company');
      }
    }
  }

  private async assertOwnedUser(id: string | undefined, field: string, ctx: ActiveOperationalContext) {
    if (!id) return;
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw this.validationError(field, 'validation.invalidReference', 'Referenced user not found');
    }
    if (user.companyId && user.companyId !== ctx.companyId) {
      throw this.validationError(field, 'validation.invalidReference', 'Referenced user belongs to another company');
    }
  }

  private async resolvePartProduct(dto: CreateWorkOrderPartDto, ctx: ActiveOperationalContext) {
    let sparePartId = dto.sparePartId ?? null;
    let productId = dto.productId ?? null;
    if (sparePartId) {
      const sparePart = await this.prisma.sparePart.findUnique({ where: { id: sparePartId } });
      if (!sparePart) {
        throw this.validationError('sparePartId', 'validation.invalidReference', 'Spare part not found');
      }
      if (sparePart.productId) productId = sparePart.productId;
      else if (!productId) {
        throw this.validationError('productId', 'validation.invalidReference', 'Spare part has no linked product. Provide productId explicitly.');
      }
    }
    if (!sparePartId && !productId) {
      throw this.validationError('sparePartId', 'validation.required', 'Either sparePartId or productId is required');
    }
    if (productId) {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
      }
    }
    return { sparePartId, productId, unit: dto.unit ?? null };
  }

  async create(dto: CreateMaintenanceWorkOrderDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    await Promise.all([
      this.assertOwnedRef('machine', dto.machineId, 'machineId', ctx),
      this.assertOwnedRef('machineComponent', dto.machineComponentId, 'machineComponentId', ctx),
      this.assertOwnedRef('maintenanceRequest', dto.requestId, 'requestId', ctx),
      this.assertOwnedRef('warehouse', dto.warehouseId, 'warehouseId', ctx),
      this.assertOwnedUser(dto.assignedToId, 'assignedToId', ctx),
      this.assertOwnedUser(dto.supervisorId, 'supervisorId', ctx),
    ]);

    const parts = dto.parts && dto.parts.length > 0 ? dto.parts : [];
    const resolvedParts = [];
    for (const p of parts) {
      resolvedParts.push(await this.resolvePartProduct(p, ctx));
    }

    const workOrderNumber = await this.numberingService.generateNumberAtomic('MAINTENANCE_WORK_ORDER');

    const wo = await this.prisma.maintenanceWorkOrder.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        workOrderNumber,
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type ?? 'CORRECTIVE',
        priority: dto.priority ?? 'MEDIUM',
        status: 'DRAFT',
        machineId: dto.machineId ?? null,
        machineComponentId: dto.machineComponentId ?? null,
        requestId: dto.requestId ?? null,
        warehouseId: dto.warehouseId ?? null,
        assignedToId: dto.assignedToId ?? null,
        supervisorId: dto.supervisorId ?? null,
        createdById: user.id,
        plannedStartAt: dto.plannedStartAt ? new Date(dto.plannedStartAt) : null,
        plannedEndAt: dto.plannedEndAt ? new Date(dto.plannedEndAt) : null,
        estimatedCost: dto.estimatedCost != null ? dto.estimatedCost : null,
        notes: dto.notes ?? null,
        parts: resolvedParts.length
          ? {
              create: resolvedParts.map((p, i) => ({
                sparePartId: p.sparePartId,
                productId: p.productId,
                quantity: parts[i].quantity,
                unit: p.unit ?? parts[i].unit ?? null,
                unitCost: parts[i].unitCost != null ? parts[i].unitCost : null,
                totalCost: parts[i].unitCost != null ? parts[i].quantity * parts[i].unitCost : null,
                notes: parts[i].notes ?? null,
              })),
            }
          : undefined,
      },
      include: this.includeDetail,
    });

    await this.audit.log(user.id, 'CREATE', 'MaintenanceWorkOrder', wo.id, {
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      type: wo.type,
      status: wo.status,
      companyId: wo.companyId,
      branchId: wo.branchId,
      machineId: wo.machineId,
      partsCount: resolvedParts.length,
    });

    return wo;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    status?: string; type?: string; priority?: string; machineId?: string; requestId?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { ...this.scope(ctx), deletedAt: null };
    if (query.search) {
      where.OR = [
        { workOrderNumber: { contains: query.search } },
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;
    if (query.machineId) where.machineId = query.machineId;
    if (query.requestId) where.requestId = query.requestId;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceWorkOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          request: { select: { id: true, requestNumber: true } },
          _count: { select: { parts: true, costEntries: true } },
        },
      }),
      this.prisma.maintenanceWorkOrder.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateMaintenanceWorkOrderDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const wo = await this.findOwned(id, ctx);

    await Promise.all([
      this.assertOwnedRef('machine', dto.machineId, 'machineId', ctx),
      this.assertOwnedRef('machineComponent', dto.machineComponentId, 'machineComponentId', ctx),
      this.assertOwnedRef('maintenanceRequest', dto.requestId, 'requestId', ctx),
      this.assertOwnedRef('warehouse', dto.warehouseId, 'warehouseId', ctx),
      this.assertOwnedUser(dto.assignedToId, 'assignedToId', ctx),
      this.assertOwnedUser(dto.supervisorId, 'supervisorId', ctx),
    ]);

    const updated = await this.prisma.maintenanceWorkOrder.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description !== undefined ? dto.description ?? null : undefined,
        type: dto.type,
        priority: dto.priority,
        machineId: dto.machineId !== undefined ? dto.machineId ?? null : undefined,
        machineComponentId: dto.machineComponentId !== undefined ? dto.machineComponentId ?? null : undefined,
        requestId: dto.requestId !== undefined ? dto.requestId ?? null : undefined,
        warehouseId: dto.warehouseId !== undefined ? dto.warehouseId ?? null : undefined,
        assignedToId: dto.assignedToId !== undefined ? dto.assignedToId ?? null : undefined,
        supervisorId: dto.supervisorId !== undefined ? dto.supervisorId ?? null : undefined,
        plannedStartAt: dto.plannedStartAt !== undefined ? (dto.plannedStartAt ? new Date(dto.plannedStartAt) : null) : undefined,
        plannedEndAt: dto.plannedEndAt !== undefined ? (dto.plannedEndAt ? new Date(dto.plannedEndAt) : null) : undefined,
        estimatedCost: dto.estimatedCost !== undefined ? dto.estimatedCost : undefined,
        notes: dto.notes !== undefined ? dto.notes ?? null : undefined,
      },
      include: this.includeDetail,
    });

    await this.audit.log(user.id, 'UPDATE', 'MaintenanceWorkOrder', wo.id, {
      workOrderNumber: wo.workOrderNumber,
      title: updated.title,
      type: updated.type,
      priority: updated.priority,
      machineId: updated.machineId,
      status: updated.status,
    });

    return updated;
  }

  async transition(id: string, dto: WorkOrderStatusActionDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const wo = await this.findOwned(id, ctx);

    const transitions: Record<string, { from: string[]; to: string }> = {
      plan: { from: ['DRAFT'], to: 'PLANNED' },
      start: { from: ['PLANNED'], to: 'IN_PROGRESS' },
      complete: { from: ['IN_PROGRESS'], to: 'COMPLETED' },
      cancel: { from: ['DRAFT', 'PLANNED'], to: 'CANCELLED' },
    };
    const rule = transitions[dto.action];
    if (!rule) {
      throw this.validationError('action', 'validation.invalidStatusTransition', `Unknown action '${dto.action}'`);
    }
    if (!rule.from.includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot ${dto.action} a work order in status '${wo.status}'. Expected ${rule.from.join(' or ')}`);
    }
    if (dto.action === 'cancel' && !dto.reason?.trim()) {
      throw this.validationError('reason', 'validation.required', 'A cancellation reason is required');
    }

    const data: any = { status: rule.to };
    if (dto.action === 'start') data.startedAt = new Date();
    if (dto.action === 'complete') {
      const partLines = await this.prisma.maintenanceWorkOrderPart.findMany({ where: { workOrderId: wo.id } });
      const partial = partLines.filter((p) => p.stockIssueStatus === 'PARTIALLY_ISSUED');
      if (partial.length > 0) {
        throw this.validationError('status', 'validation.invalidStatusTransition',
          `Cannot complete the work order: ${partial.length} part line(s) are only partially issued. Issue the remaining quantity or remove the line.`);
      }
      data.completedAt = new Date();
      data.actualCost = await this.computeActualCost(wo.id);
    }
    if (dto.action === 'cancel') {
      data.cancelledAt = new Date();
      data.cancelReason = dto.reason;
    }

    const updated = await this.prisma.maintenanceWorkOrder.update({
      where: { id },
      data,
      include: this.includeDetail,
    });

    await this.audit.log(user.id, 'STATUS_TRANSITION', 'MaintenanceWorkOrder', wo.id, {
      from: wo.status,
      to: updated.status,
      action: dto.action,
      reason: dto.reason ?? null,
      companyId: wo.companyId,
      branchId: wo.branchId,
    });

    return updated;
  }

  private async computeActualCost(workOrderId: string): Promise<number> {
    const [parts, costs] = await Promise.all([
      this.prisma.maintenanceWorkOrderPart.aggregate({
        where: { workOrderId, stockIssueStatus: { not: 'PENDING' } },
        _sum: { totalCost: true },
      }),
      this.prisma.maintenanceWorkOrderCostEntry.aggregate({
        where: { workOrderId },
        _sum: { amount: true },
      }),
    ]);
    const partsCost = Number(parts._sum.totalCost ?? 0);
    const entriesCost = Number(costs._sum.amount ?? 0);
    return Math.round((partsCost + entriesCost) * 100) / 100;
  }

  async addPart(workOrderId: string, dto: AddWorkOrderPartDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const wo = await this.findOwned(workOrderId, ctx);
    if (!['DRAFT', 'PLANNED'].includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot add parts to a work order in status '${wo.status}'`);
    }

    const resolved = await this.resolvePartProduct(dto, ctx);

    const part = await this.prisma.maintenanceWorkOrderPart.create({
      data: {
        workOrderId,
        sparePartId: resolved.sparePartId,
        productId: resolved.productId,
        quantity: dto.quantity,
        unit: resolved.unit ?? dto.unit ?? null,
        unitCost: dto.unitCost != null ? dto.unitCost : null,
        totalCost: dto.unitCost != null ? dto.quantity * dto.unitCost : null,
        notes: dto.notes ?? null,
      },
      include: {
        sparePart: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, code: true, name: true } },
      },
    });

    await this.audit.log(user.id, 'CREATE', 'MaintenanceWorkOrderPart', part.id, {
      workOrderId,
      sparePartId: part.sparePartId,
      productId: part.productId,
      quantity: part.quantity,
    });

    return part;
  }

  async updatePart(partId: string, dto: UpdateWorkOrderPartDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const part = await this.prisma.maintenanceWorkOrderPart.findUnique({ where: { id: partId } });
    if (!part) throw this.notFound('Work order part line not found');
    const wo = await this.findOwned(part.workOrderId, ctx);
    if (!['DRAFT', 'PLANNED'].includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot edit parts once the work order is '${wo.status}'`);
    }
    if ((part.issuedQuantity || 0) > 0) {
      throw this.validationError('quantity', 'validation.invalidStatusTransition',
        'Cannot edit a part line that has already been issued');
    }

    const quantity = dto.quantity ?? part.quantity;
    const unitCost = dto.unitCost !== undefined ? dto.unitCost : part.unitCost != null ? Number(part.unitCost) : null;

    const updated = await this.prisma.maintenanceWorkOrderPart.update({
      where: { id: partId },
      data: {
        quantity: dto.quantity,
        unit: dto.unit,
        unitCost: dto.unitCost !== undefined ? dto.unitCost : undefined,
        totalCost: unitCost != null && dto.quantity !== undefined ? quantity * unitCost : unitCost != null ? quantity * unitCost : undefined,
        notes: dto.notes,
      },
      include: {
        sparePart: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, code: true, name: true } },
      },
    });

    await this.audit.log(user.id, 'UPDATE', 'MaintenanceWorkOrderPart', part.id, {
      workOrderId: part.workOrderId,
      quantity: updated.quantity,
      unitCost: updated.unitCost,
    });

    return updated;
  }

  async removePart(partId: string, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const part = await this.prisma.maintenanceWorkOrderPart.findUnique({ where: { id: partId } });
    if (!part) throw this.notFound('Work order part line not found');
    const wo = await this.findOwned(part.workOrderId, ctx);
    if (!['DRAFT', 'PLANNED'].includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot remove parts once the work order is '${wo.status}'`);
    }
    if ((part.issuedQuantity || 0) > 0) {
      throw this.validationError('quantity', 'validation.invalidStatusTransition',
        'Cannot remove a part line that has already been issued');
    }

    await this.prisma.maintenanceWorkOrderPart.delete({ where: { id: partId } });

    await this.audit.log(user.id, 'DELETE', 'MaintenanceWorkOrderPart', part.id, {
      workOrderId: part.workOrderId,
      sparePartId: part.sparePartId,
      productId: part.productId,
    });

    return { message: 'Work order part line deleted successfully' };
  }

  async issueParts(workOrderId: string, dto: IssueWorkOrderPartsDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const wo = await this.findOwned(workOrderId, ctx);
    if (!['PLANNED', 'IN_PROGRESS'].includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot issue parts while the work order is '${wo.status}'. Expected PLANNED or IN_PROGRESS`);
    }

    let warehouseId = dto.warehouseId ?? wo.warehouseId;
    if (!warehouseId) {
      throw this.validationError('warehouseId', 'validation.required',
        'No warehouse set on the work order. Provide warehouseId in the issue request.');
    }
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse not found');
    }
    if (FORBIDDEN_WAREHOUSE_TYPES.includes(warehouse.warehouseType || '')) {
      throw this.validationError('warehouseId', 'validation.invalidReference',
        `Spare parts cannot be issued from ${(warehouse.warehouseType || '').toLowerCase().replace('_', ' ')} warehouses`);
    }
    if (warehouse.companyId !== ctx.companyId) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another company');
    }
    if (warehouse.branchId && warehouse.branchId !== ctx.branchId) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse belongs to another branch');
    }

    const wherePart: any = { workOrderId };
    const lines = await this.prisma.maintenanceWorkOrderPart.findMany({ where: wherePart });

    let targets = lines;
    if (dto.partLineIds && dto.partLineIds.length > 0) {
      const requested = new Set(dto.partLineIds);
      for (const l of lines) {
        if (!requested.has(l.id)) {
          throw this.validationError('partLineIds', 'validation.invalidReference',
            `Part line ${l.id} does not belong to this work order`);
        }
      }
      targets = lines.filter((l) => requested.has(l.id));
      for (const l of targets) {
        if ((l.issuedQuantity || 0) >= l.quantity) {
          throw this.validationError('partLineIds', 'validation.invalidReference',
            `Part line ${l.id} is already fully issued`);
        }
      }
    } else {
      targets = lines.filter((l) => (l.issuedQuantity || 0) < l.quantity);
    }

    if (targets.length === 0) {
      throw this.validationError('partLineIds', 'validation.required', 'No part lines are pending issue');
    }

    // Resolve product per line before entering the transaction.
    const targetProducts: { part: any; productId: string }[] = [];
    for (const part of targets) {
      let productId = part.productId;
      if (!productId && part.sparePartId) {
        const sp = await this.prisma.sparePart.findUnique({ where: { id: part.sparePartId } });
        productId = sp?.productId ?? null;
      }
      if (!productId) {
        throw this.validationError('partLineIds', 'validation.invalidReference',
          `Part line ${part.id} has no inventory product. Add a productId to the line.`);
      }
      targetProducts.push({ part, productId });
    }

    const movements: any[] = [];
    let movementNumber: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      movementNumber = await this.numberingService.generateNumberAtomicWithClient('INVENTORY_MOVEMENT', tx);
      // VAL-R1E: for an ACTIVE valuation warehouse the physical decrement,
      // monetary decrement, and immutable movement monetary quartet are all
      // applied atomically per line by the single inventory valuation authority
      // at the current weighted moving average. When no ACTIVE policy exists the
      // legacy unprotected behavior (physical only) is preserved.
      const activePolicy = await this.valuationEngine.findActivePolicyForWarehouse(tx, ctx.companyId, warehouseId);
      for (const { part, productId } of targetProducts) {
        const remaining = part.quantity - (part.issuedQuantity || 0);
        const issueQty = Math.min(remaining, part.quantity - (part.issuedQuantity || 0));
        if (issueQty <= 0) continue;

        const whereBalance: any = { warehouseId, productId };
        whereBalance.locationId = null;
        let balance = await tx.inventoryBalance.findFirst({ where: whereBalance });
        if (!balance) {
          balance = await tx.inventoryBalance.create({
            data: { warehouseId, productId, locationId: null, quantity: 0 },
          });
        }
        const newQuantity = balance.quantity - issueQty;
        if (newQuantity < 0) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          throw new BadRequestException({
            messageKey: 'common.validationFailed',
            message: 'Validation failed',
            errors: [{
              field: 'partLineIds',
              code: 'validation.insufficientStock',
              message: `Insufficient stock for ${product?.name || productId}. Available: ${balance.quantity}, Requested: ${issueQty}`,
            }],
          });
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            movementNumber,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            warehouseId,
            movementType: 'MAINTENANCE_ISSUE',
            status: 'POSTED',
            sourceType: 'MAINTENANCE_WORK_ORDER',
            sourceId: workOrderId,
            movementDate: new Date(),
            postedAt: new Date(),
            createdById: user.id,
            postedById: user.id,
            notes: dto.notes || `Maintenance work order ${wo.workOrderNumber} parts issue`,
            lines: {
              create: [{
                productId,
                warehouseLocationId: null,
                quantity: issueQty,
                direction: 'OUT',
                notes: `Work order ${wo.workOrderNumber} issue${part.sparePartId ? ` for spare part ${part.sparePartId}` : ''}`,
              }],
            },
          },
          include: { lines: true },
        });

        if (activePolicy) {
          const qold = await this.valuationEngine.aggregatePhysicalQuantity(tx, warehouseId, productId);
          await this.valuationEngine.applyValuedIssue(tx, {
            companyId: ctx.companyId,
            warehouseId,
            productId,
            qold,
            lineId: movement.lines[0].id,
            movementId: movement.id,
            currencyCode: activePolicy.currencyCode,
            quantity: new Prisma.Decimal(issueQty),
          });
        }

        // Physical decrement exactly once for both ACTIVE and INACTIVE flows,
        // twin-syncing the legacy Float `quantity` and the Decimal `quantityBase`
        // (physical authority = SUM(quantityBase)). Mirrors the proven R1C/R1D
        // inventory-balance mutation pattern; the engine is the single monetary
        // authority and is called above with the PRE-mutation `qold`.
        const currentBase =
          balance.quantityBase !== null && balance.quantityBase !== undefined
            ? new Prisma.Decimal(balance.quantityBase.toString())
            : new Prisma.Decimal(balance.quantity);
        const newQuantityBase = currentBase.minus(new Prisma.Decimal(issueQty));
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { quantity: newQuantity, quantityBase: newQuantityBase },
        });

        const newIssued = (part.issuedQuantity || 0) + issueQty;
        const newStatus = newIssued >= part.quantity ? 'FULLY_ISSUED' : 'PARTIALLY_ISSUED';

        await tx.maintenanceWorkOrderPart.update({
          where: { id: part.id },
          data: {
            issuedQuantity: newIssued,
            stockIssueStatus: newStatus,
            lastIssueAt: new Date(),
            lastIssueById: user.id,
          },
        });

        movements.push({ partId: part.id, movement, issuedQuantity: issueQty, newStatus });
      }
    });

    await this.audit.log(user.id, 'ISSUE_STOCK', 'MaintenanceWorkOrder', workOrderId, {
      workOrderNumber: wo.workOrderNumber,
      movementNumber,
      warehouseId,
      issuedLines: movements.length,
      parts: movements.map((m) => ({ partId: m.partId, issuedQuantity: m.issuedQuantity, status: m.newStatus })),
    });

    return this.findOwned(workOrderId, ctx);
  }

  async addCostEntry(workOrderId: string, dto: AddWorkOrderCostEntryDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const wo = await this.findOwned(workOrderId, ctx);
    if (['COMPLETED', 'CANCELLED'].includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot add cost entries to a ${wo.status} work order`);
    }

    const entry = await this.prisma.maintenanceWorkOrderCostEntry.create({
      data: {
        workOrderId,
        type: dto.type,
        description: dto.description ?? null,
        amount: dto.amount,
        incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : new Date(),
        createdById: user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await this.audit.log(user.id, 'CREATE', 'MaintenanceWorkOrderCostEntry', entry.id, {
      workOrderId,
      type: entry.type,
      amount: Number(entry.amount),
    });

    return entry;
  }

  async updateCostEntry(entryId: string, dto: UpdateWorkOrderCostEntryDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const entry = await this.prisma.maintenanceWorkOrderCostEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw this.notFound('Work order cost entry not found');
    await this.findOwned(entry.workOrderId, ctx);

    const updated = await this.prisma.maintenanceWorkOrderCostEntry.update({
      where: { id: entryId },
      data: {
        type: dto.type,
        description: dto.description !== undefined ? dto.description ?? null : undefined,
        amount: dto.amount,
        incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await this.audit.log(user.id, 'UPDATE', 'MaintenanceWorkOrderCostEntry', entry.id, {
      workOrderId: entry.workOrderId,
      type: updated.type,
      amount: Number(updated.amount),
    });

    return updated;
  }

  async removeCostEntry(entryId: string, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const entry = await this.prisma.maintenanceWorkOrderCostEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw this.notFound('Work order cost entry not found');
    const wo = await this.findOwned(entry.workOrderId, ctx);
    if (wo.status === 'COMPLETED') {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        'Cannot remove cost entries from a completed work order');
    }

    await this.prisma.maintenanceWorkOrderCostEntry.delete({ where: { id: entryId } });

    await this.audit.log(user.id, 'DELETE', 'MaintenanceWorkOrderCostEntry', entry.id, {
      workOrderId: entry.workOrderId,
      amount: Number(entry.amount),
    });

    return { message: 'Work order cost entry deleted successfully' };
  }

  async remove(id: string, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const wo = await this.findOwned(id, ctx);
    if (!['DRAFT', 'PLANNED', 'CANCELLED'].includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot delete a work order in status '${wo.status}'. Cancel it first if it was planned or started.`);
    }

    await this.prisma.maintenanceWorkOrder.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.log(user.id, 'DELETE', 'MaintenanceWorkOrder', wo.id, {
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      companyId: wo.companyId,
      branchId: wo.branchId,
    });

    return { message: 'Maintenance work order deleted successfully' };
  }
}
