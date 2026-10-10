import { MaintenanceStockIssueService } from '../maintenance-stock-issue/maintenance-stock-issue.service';
import { resolveExecutionScope, executionError } from '../maintenance-tasks/maintenance-execution-policy';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { CreateMaintenanceWorkOrderDto, CreateWorkOrderPartDto } from './dto/create-maintenance-work-order.dto';
import { CreateWorkOrderFromRequestDto } from './dto/create-work-order-from-request.dto';
import { UpdateMaintenanceWorkOrderDto } from './dto/update-maintenance-work-order.dto';
import { AddWorkOrderPartDto, UpdateWorkOrderPartDto, IssueWorkOrderPartsDto } from './dto/work-order-part.dto';
import { AddWorkOrderCostEntryDto, UpdateWorkOrderCostEntryDto } from './dto/work-order-cost-entry.dto';
import { WorkOrderStatusActionDto } from './dto/work-order-status-action.dto';
import { CurrentUserType } from '../../../../modules/auth/types/current-user.type';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';
import { ProductionCostService } from '../../production-cost/production-cost.service';
import { MAINTENANCE_COST_PURPOSE } from '../../../../common/cost-purpose/cost-purpose.constants';
import {
  EXTERNAL_SERVICE_EVENT_TYPE,
  LABOR_EVENT_TYPE,
  MAINTENANCE_LABOR_SOURCE_TYPE,
  MANUAL_AMOUNT_UNIT,
} from '../../production-cost/production-cost.constants';
import { OperationalCostCenterResolver } from '../cost-centers/operational-cost-center-resolver.service';

const FORBIDDEN_WAREHOUSE_TYPES = ['PRODUCT', 'RAW_MATERIAL'];

@Injectable()
export class MaintenanceWorkOrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
    private valuationEngine: InventoryValuationEngineService,
    private productionCost: ProductionCostService,
    private costCenterResolver: OperationalCostCenterResolver,
    private stockIssue: MaintenanceStockIssueService,
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
    productionLine: { select: { id: true, code: true, name: true } },
    costCenter: { select: { id: true, code: true, name: true } },
    machineComponent: { select: { id: true, code: true, name: true } },
    request: { select: { id: true, requestNumber: true, title: true, status: true } },
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

  private async findOwned(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const wo = await client.maintenanceWorkOrder.findUnique({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: this.includeDetail,
    });
    if (!wo || !this.owns(wo, ctx)) {
      throw this.notFound('Maintenance work order not found');
    }
    return wo;
  }

  private laborFingerprint(entryId: string): string {
    return `${MAINTENANCE_LABOR_SOURCE_TYPE}:${entryId}:${LABOR_EVENT_TYPE}`;
  }

  private externalServiceFingerprint(entryId: string): string {
    return `${MAINTENANCE_LABOR_SOURCE_TYPE}:${entryId}:${EXTERNAL_SERVICE_EVENT_TYPE}`;
  }

  private async configuredMaintenanceCostCenter(
    tx: any,
    costCenterId: string,
    occurredAt: Date,
    ctx: ActiveOperationalContext,
  ) {
    const costCenter = await tx.costCenter.findFirst({
      where: {
        id: costCenterId,
        companyId: ctx.companyId,
        deletedAt: null,
        status: 'ACTIVE',
        AND: [
          { OR: [{ branchId: ctx.branchId }, { branchId: null }] },
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: occurredAt } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: occurredAt } }] },
        ],
      },
      select: { id: true, departmentId: true },
    });
    if (!costCenter) {
      throw this.validationError(
        'costCenterId',
        'validation.invalidReference',
        'The maintenance cost center is not active in the work order tenant at the cost date',
      );
    }
    return costCenter;
  }

  private async resolveMaintenanceCostAttribution(tx: any, workOrder: any, occurredAt: Date, ctx: ActiveOperationalContext) {
    const request = workOrder.request ?? null;
    const machineId = workOrder.machineId ?? request?.machineId ?? null;
    if (workOrder.machineId && request?.machineId && workOrder.machineId !== request.machineId) {
      throw this.validationError('machineId', 'validation.invalidReference', 'Work order and maintenance request machines do not match');
    }

    let machine: any = null;
    if (machineId) {
      machine = await tx.machine.findFirst({
        where: {
          id: machineId,
          companyId: ctx.companyId,
          deletedAt: null,
          OR: [{ branchId: ctx.branchId }, { branchId: null }],
        },
        select: { id: true, productionLineId: true, departmentId: true, defaultCostCenterId: true },
      });
      if (!machine) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Maintenance cost machine is outside the active tenant');
      }
    }

    const configuredCostCenterId = request?.costCenterId ?? workOrder.costCenterId ?? machine?.defaultCostCenterId ?? null;
    let costCenter: { id: string; departmentId: string | null };
    if (configuredCostCenterId) {
      costCenter = await this.configuredMaintenanceCostCenter(tx, configuredCostCenterId, occurredAt, ctx);
    } else {
      if (!machineId) {
        throw this.validationError('costCenterId', 'validation.required', 'A maintenance cost center could not be resolved');
      }
      const resolved = await this.costCenterResolver.resolveWithClient(
        tx,
        { resourceType: 'MACHINE', machineId, referenceDate: occurredAt.toISOString() },
        ctx,
      );
      costCenter = await this.configuredMaintenanceCostCenter(tx, resolved.costCenterId, occurredAt, ctx);
    }

    return {
      machineId,
      productionLineId: machine?.productionLineId ?? request?.productionLineId ?? null,
      costCenterId: costCenter.id,
      departmentId: costCenter.departmentId ?? machine?.departmentId ?? null,
      maintenanceWorkOrderId: workOrder.id,
      maintenanceRequestId: workOrder.requestId ?? null,
    };
  }

  private async postMaintenanceLaborLedgerEntry(
    tx: any,
    workOrder: any,
    entry: { id: string; amount: Prisma.Decimal; incurredAt: Date },
    user: CurrentUserType,
    ctx: ActiveOperationalContext,
  ) {
    const refs = await this.resolveMaintenanceCostAttribution(tx, workOrder, entry.incurredAt, ctx);
    const sourceFingerprint = this.laborFingerprint(entry.id);
    await this.productionCost.postLedgerEntryWithinTransaction(tx, {
      eventType: LABOR_EVENT_TYPE,
      sourceType: MAINTENANCE_LABOR_SOURCE_TYPE,
      sourceId: entry.id,
      sourceLineId: entry.id,
      sourceFingerprint,
      costNature: 'MANUAL_ASSERTED_ACTUAL',
      costPurpose: MAINTENANCE_COST_PURPOSE,
      entryRole: 'PRIMARY_COST',
      amount: entry.amount,
      quantity: new Prisma.Decimal(0),
      rate: new Prisma.Decimal(0),
      unit: MANUAL_AMOUNT_UNIT,
      currencyCode: null,
      occurredAt: entry.incurredAt,
      clientRequestId: `maintenance-labor:${entry.id}:primary`,
      requestPayloadFingerprint: [
        MAINTENANCE_LABOR_SOURCE_TYPE,
        entry.id,
        entry.amount.toString(),
        ctx.companyId,
        ctx.branchId,
        refs.costCenterId,
      ].join('|'),
      sourceNumberSnapshot: workOrder.workOrderNumber,
      refs,
      createdById: user.id,
      ctx,
    });
  }

  private async postMaintenanceExternalServiceLedgerEntry(
    tx: any,
    workOrder: any,
    entry: { id: string; amount: Prisma.Decimal; incurredAt: Date },
    completedAt: Date,
    user: CurrentUserType,
    ctx: ActiveOperationalContext,
  ) {
    const refs = await this.resolveMaintenanceCostAttribution(tx, workOrder, entry.incurredAt, ctx);
    const sourceFingerprint = this.externalServiceFingerprint(entry.id);
    await this.productionCost.postLedgerEntryWithinTransaction(tx, {
      eventType: EXTERNAL_SERVICE_EVENT_TYPE,
      sourceType: MAINTENANCE_LABOR_SOURCE_TYPE,
      sourceId: entry.id,
      sourceLineId: entry.id,
      sourceFingerprint,
      costNature: 'MANUAL_ASSERTED_ACTUAL',
      costPurpose: MAINTENANCE_COST_PURPOSE,
      entryRole: 'PRIMARY_COST',
      amount: entry.amount,
      quantity: new Prisma.Decimal(0),
      rate: new Prisma.Decimal(0),
      unit: MANUAL_AMOUNT_UNIT,
      currencyCode: null,
      occurredAt: entry.incurredAt,
      postedAt: completedAt,
      clientRequestId: `maintenance-external-service:${entry.id}:primary`,
      requestPayloadFingerprint: [
        MAINTENANCE_LABOR_SOURCE_TYPE,
        entry.id,
        EXTERNAL_SERVICE_EVENT_TYPE,
        entry.amount.toString(),
        ctx.companyId,
        ctx.branchId,
        refs.costCenterId,
      ].join('|'),
      sourceNumberSnapshot: workOrder.workOrderNumber,
      refs,
      createdById: user.id,
      ctx,
    });
  }

  private async assertOwnedRef(
    model: 'machine' | 'machineComponent' | 'warehouse' | 'maintenanceRequest',
    id: string | null | undefined,
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
    if (user.branchId && user.branchId !== ctx.branchId) {
      throw this.validationError(field, 'validation.invalidReference', 'Referenced user belongs to another branch');
    }
    if (user.status && user.status !== 'ACTIVE') {
      throw this.validationError(field, 'validation.invalidReference', 'Referenced user is not active');
    }
    if (user.deletedAt) {
      throw this.validationError(field, 'validation.invalidReference', 'Referenced user is not active');
    }
  }

  /**
   * R2-C canonical request↔work-order link validation. When a work order is linked
   * to a maintenance request the effective machine must equal the request machine,
   * the component (when present) must belong to that machine, the request must be
   * tenant-owned and not soft-deleted, and (on creation/attachment) must not be
   * terminal. Server-side derivation: an omitted machine defaults from the request
   * and an omitted component defaults from the request component. Resolves the
   * canonical machine/component the caller must persist.
   */
  private async assertCanonicalRequestLink(
    input: { requestId?: string | null; machineId?: string | null | undefined; machineComponentId?: string | null | undefined },
    ctx: ActiveOperationalContext,
    opts: { requireNonTerminal?: boolean } = {},
  ): Promise<{ requestId: string | null; machineId: string | null; machineComponentId: string | null }> {
    let requestId = input.requestId ?? null;
    let machineId = input.machineId === undefined ? null : input.machineId;
    let machineComponentId = input.machineComponentId === undefined ? null : input.machineComponentId;

    if (requestId) {
      const request = await this.prisma.maintenanceRequest.findUnique({
        where: { id: requestId },
        include: { machine: true },
      });
      if (!request || request.deletedAt) {
        throw this.validationError('requestId', 'workOrderRequestInvalidReference', 'Referenced maintenance request not found or deleted');
      }
      // Tenant: the request must resolve to a machine owned by the active context.
      let reqMachine: { companyId: string | null; branchId: string | null } | null = request.machine ?? null;
      if (!reqMachine && request.machineId) {
        reqMachine = await this.prisma.machine.findUnique({ where: { id: request.machineId } });
      }
      if (!reqMachine || reqMachine.companyId !== ctx.companyId) {
        throw this.validationError('requestId', 'validation.invalidReference', 'Referenced request belongs to another company');
      }
      if (reqMachine.branchId && reqMachine.branchId !== ctx.branchId) {
        throw this.validationError('requestId', 'validation.invalidReference', 'Referenced request belongs to another branch');
      }
      // Terminal requests cannot drive new or re-planned work orders.
      if (opts.requireNonTerminal !== false && ['COMPLETED', 'CANCELLED', 'CLOSED'].includes(request.status)) {
        throw this.validationError('requestId', 'workOrderRequestTerminal', `Cannot link the ${request.status} maintenance request to a work order`);
      }
      // Work-order machine must equal the request machine.
      if (machineId && request.machineId && machineId !== request.machineId) {
        throw this.validationError('machineId', 'workOrderMachineRequestMismatch', 'Work order machine does not match the maintenance request machine');
      }
      if (machineId === null && request.machineId) {
        machineId = request.machineId;
      }
      // Component defaults from the request and must not contradict it.
      if (request.machineComponentId) {
        if (machineComponentId && machineComponentId !== request.machineComponentId) {
          throw this.validationError('machineComponentId', 'workOrderComponentRequestMismatch', 'Work order component does not match the maintenance request component');
        }
        if (machineComponentId === null) {
          machineComponentId = request.machineComponentId;
        }
      }
    }

    // General integrity: a component must belong to the effective machine.
    if (machineComponentId && machineId) {
      const component = await this.prisma.machineComponent.findUnique({ where: { id: machineComponentId } });
      if (!component) {
        throw this.validationError('machineComponentId', 'validation.invalidReference', 'Referenced machine component not found');
      }
      if (component.machineId && component.machineId !== machineId) {
        throw this.validationError('machineComponentId', 'workOrderComponentMachineMismatch', 'Work order component does not belong to the work order machine');
      }
    }

    return { requestId, machineId, machineComponentId };
  }

  /**
   * R2-C request-state coordination for work-order transitions. A linked work order
   * may only be planned against a non-terminal request and only started while its
   * request is actually IN_PROGRESS. Fail-closed: terminal or missing requests block
   * the transition with a structured validation error.
   */
  private async assertRequestStateAllowsTransition(requestId: string, action: string, ctx: ActiveOperationalContext) {
    if (action !== 'plan' && action !== 'start') {
      return;
    }
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!request || request.deletedAt) {
      throw this.validationError('requestId', 'workOrderRequestInvalidReference', 'The linked maintenance request does not exist or was deleted');
    }
    if (['COMPLETED', 'CANCELLED', 'CLOSED'].includes(request.status)) {
      throw this.validationError(
        'status',
        'workOrderRequestTerminalBlocksTransition',
        `Cannot ${action} the work order: its maintenance request is ${request.status}`,
      );
    }
    if (action === 'start' && request.status !== 'IN_PROGRESS') {
      throw this.validationError(
        'status',
        'workOrderStartRequiresInProgressRequest',
        'The maintenance request must be IN_PROGRESS before its work orders can start',
      );
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
    if (dto.requestId) throw executionError('maintenance.workOrderUseLegacyRequestEndpoint');
    // R2-C: any requestId/machineId/component pair is validated canonically
    // (tenant, terminal, request↔machine coupling, component↔machine binding).
    const resolved = await this.assertCanonicalRequestLink(
      { requestId: dto.requestId, machineId: dto.machineId, machineComponentId: dto.machineComponentId },
      ctx,
    );
    return this.executeCreate(dto, resolved, 'GENERIC', user, ctx);
  }

  /**
   * R2-C canonical create-from-request. requestId and machineId are server-derived
   * from the validated maintenance request (companyId/branchId always from ctx);
   * the machineComponentId defaults from the request and may only be overridden by
   * a component that belongs to the request machine.
   */
  async createFromRequest(requestId: string, dto: CreateWorkOrderFromRequestDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const resolved = await this.assertCanonicalRequestLink(
      { requestId, machineId: null, machineComponentId: dto.machineComponentId },
      ctx,
    );
    return this.executeCreate(dto, resolved, 'FROM_REQUEST', user, ctx, requestId);
  }

  private async executeCreate(
    dto: CreateMaintenanceWorkOrderDto | CreateWorkOrderFromRequestDto,
    resolvedLink: { requestId: string | null; machineId: string | null; machineComponentId: string | null },
    source: 'GENERIC' | 'FROM_REQUEST',
    user: CurrentUserType,
    ctx: ActiveOperationalContext,
    sourceRequestId?: string,
  ) {
    await Promise.all([
      this.assertOwnedRef('machine', resolvedLink.machineId, 'machineId', ctx),
      this.assertOwnedRef('machineComponent', resolvedLink.machineComponentId, 'machineComponentId', ctx),
      this.assertOwnedRef('warehouse', dto.warehouseId, 'warehouseId', ctx),
      this.assertOwnedUser(dto.assignedToId, 'assignedToId', ctx),
      this.assertOwnedUser(dto.supervisorId, 'supervisorId', ctx),
    ]);

    const executionScope = await resolveExecutionScope(this.prisma, { ...dto, ...resolvedLink }, ctx);
    const parts = dto.parts && dto.parts.length > 0 ? dto.parts : [];
    // R2-D (Option 1): a request-linked work order never carries parallel part
    // lines. Spare parts are the request's required parts; the work order plans
    // against them, it does not duplicate them.
    if (resolvedLink.requestId && parts.length > 0) {
      throw this.validationError(
        'parts',
        'validation.invalidStatusTransition',
        'Linked work orders do not carry part lines. Add required parts on the maintenance request instead.',
      );
    }
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
        title: dto.description?.trim().slice(0, 160) || workOrderNumber,
        ...executionScope,
        description: dto.description ?? null,
        type: dto.type ?? 'CORRECTIVE',
        priority: dto.priority ?? 'MEDIUM',
        status: 'DRAFT',
        machineId: resolvedLink.machineId,
        machineComponentId: resolvedLink.machineComponentId,
        requestId: resolvedLink.requestId,
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
      machineComponentId: wo.machineComponentId,
      requestId: wo.requestId,
      source,
      sourceRequestId: sourceRequestId ?? null,
      partsCount: resolvedParts.length,
    });

    return wo;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    status?: string; type?: string; priority?: string; machineId?: string; requestId?: string; executionEligible?: boolean;
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
    if (query.executionEligible) where.status = { in: ['DRAFT', 'PLANNED', 'IN_PROGRESS'] };
    else if (query.status) where.status = query.status;
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
          request: { select: { id: true, requestNumber: true, title: true } },
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

    // Historical request links are immutable. New request links are rejected by
    // generic PATCH; only the explicitly deprecated compatibility endpoint creates them.
    let effectiveRequestId = wo.requestId;
    if (dto.requestId !== undefined && (dto.requestId ?? null) !== wo.requestId) {
      if (wo.requestId) {
        throw this.validationError(
          'requestId',
          'workOrderRequestLinkImmutable',
          'The maintenance request link is immutable once set; cancel the work order instead of relinking it',
        );
      }
      throw this.validationError('requestId', 'workOrderRequestLinkImmutable',
        'New work orders are independent; only the explicitly deprecated compatibility endpoint creates request links');
    }

    const effectiveMachineId = dto.machineId !== undefined ? dto.machineId ?? null : wo.machineId;
    const effectiveMachineComponentId = dto.machineComponentId !== undefined ? dto.machineComponentId ?? null : wo.machineComponentId;

    // Canonical coupling on the effective values, with the terminal guard applied
    // only when a NEW link is being attached (existing links are never re-checked).
    const resolved = effectiveRequestId
      ? await this.assertCanonicalRequestLink(
          { requestId: effectiveRequestId, machineId: effectiveMachineId, machineComponentId: effectiveMachineComponentId },
          ctx,
          { requireNonTerminal: effectiveRequestId !== wo.requestId },
        )
      : { requestId: null, machineId: effectiveMachineId, machineComponentId: effectiveMachineComponentId };

    // Unlinked work orders still bind a component to its machine.
    if (!effectiveRequestId && effectiveMachineComponentId && effectiveMachineId) {
      const component = await this.prisma.machineComponent.findUnique({ where: { id: effectiveMachineComponentId } });
      if (!component) {
        throw this.validationError('machineComponentId', 'validation.invalidReference', 'Referenced machine component not found');
      }
      if (component.machineId && component.machineId !== effectiveMachineId) {
        throw this.validationError('machineComponentId', 'workOrderComponentMachineMismatch', 'Work order component does not belong to the work order machine');
      }
    }

    await Promise.all([
      this.assertOwnedRef('machine', resolved.machineId, 'machineId', ctx),
      this.assertOwnedRef('machineComponent', resolved.machineComponentId, 'machineComponentId', ctx),
      this.assertOwnedRef('warehouse', dto.warehouseId, 'warehouseId', ctx),
      this.assertOwnedUser(dto.assignedToId, 'assignedToId', ctx),
      this.assertOwnedUser(dto.supervisorId, 'supervisorId', ctx),
    ]);

    const executionScope = await resolveExecutionScope(this.prisma, {
      scopeType: dto.scopeType ?? wo.scopeType,
      machineId: resolved.machineId, machineComponentId: resolved.machineComponentId,
      productionLineId: dto.productionLineId !== undefined ? dto.productionLineId || null : wo.productionLineId,
      workLocation: dto.workLocation !== undefined ? dto.workLocation : wo.workLocation,
      costCenterId: dto.costCenterId !== undefined ? dto.costCenterId || null : wo.costCenterId,
    }, ctx);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql([
        'SELECT [id] FROM [dbo].[maintenance_work_orders] WITH (UPDLOCK,HOLDLOCK) WHERE [id]=',
        ' AND [companyId]=', ' AND [branchId]=', '',
      ], id, ctx.companyId, ctx.branchId));
      const current = await this.findOwned(id, ctx, tx);
      if (current.status !== wo.status || current.updatedAt && wo.updatedAt && +current.updatedAt !== +wo.updatedAt) {
        throw new ConflictException({ messageKey: 'maintenance.executionConcurrentChange' });
      }
      const executions = await tx.maintenanceTask.count({ where: { workOrderId: id } });
      if (executions && ['scopeType', 'machineId', 'machineComponentId', 'productionLineId', 'costCenterId', 'workLocation']
        .some(key => (dto as any)[key] !== undefined && ((dto as any)[key] || null) !== ((current as any)[key] || null))) {
        throw executionError('maintenance.executionSourceImmutable');
      }
    const updated = await tx.maintenanceWorkOrder.update({
      where: { id },
      data: {
        ...executionScope,
        title: dto.description !== undefined ? dto.description?.trim().slice(0, 160) || wo.workOrderNumber : dto.title,
        description: dto.description !== undefined ? dto.description ?? null : undefined,
        type: dto.type,
        priority: dto.priority,
        machineId: effectiveRequestId
          ? resolved.machineId
          : dto.machineId !== undefined
            ? resolved.machineId
            : undefined,
        machineComponentId: effectiveRequestId
          ? resolved.machineComponentId
          : dto.machineComponentId !== undefined
            ? resolved.machineComponentId
            : undefined,
        requestId: dto.requestId !== undefined ? effectiveRequestId : undefined,
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

    await this.audit.logWithClient(tx, { userId: user.id, action: 'UPDATE', entity: 'MaintenanceWorkOrder', entityId: id,
      details: { workOrderNumber: wo.workOrderNumber, companyId: ctx.companyId, branchId: ctx.branchId } });
    return updated;    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  }

  async transition(id: string, dto: WorkOrderStatusActionDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    if (dto.action === 'complete') {
      return this.completeWorkOrder(id, user, ctx);
    }
    const wo = await this.findOwned(id, ctx);

    // R2-C: a linked work order may only be planned/started in step with its request
    // state (plan requires a non-terminal request; start requires an IN_PROGRESS one).
    if (wo.requestId) {
      await this.assertRequestStateAllowsTransition(wo.requestId, dto.action, ctx);
    }

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

  private async completeWorkOrder(id: string, user: CurrentUserType, ctx: ActiveOperationalContext) {
    try {
      return await this.prisma.$transaction(tx => this.completeWithClient(tx, id, user, ctx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException({ messageKey: 'productionCostTransaction.sourceAlreadyValued' });
      throw error;
    }
  }

  async startExecutionWithClient(tx: any, id: string, userId: string, ctx: ActiveOperationalContext, at = new Date()) {
    const wo = await tx.maintenanceWorkOrder.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null }, include: { request: true } });
    if (!wo) throw this.notFound('Maintenance work order not found');
    if (wo.status === 'IN_PROGRESS') return wo;
    if (!['DRAFT', 'PLANNED'].includes(wo.status) || wo.request && !['OPEN', 'IN_PROGRESS'].includes(wo.request.status)) throw executionError('maintenance.executionSourceNotEligible');
    const updated = await tx.maintenanceWorkOrder.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: at } });
    await this.audit.logWithClient(tx, { userId, action: 'STATUS_TRANSITION', entity: 'MaintenanceWorkOrder', entityId: id,
      details: { from: wo.status, to: 'IN_PROGRESS', action: 'start-execution', companyId: ctx.companyId, branchId: ctx.branchId } });
    return updated;
  }

  async completeWithClient(tx: any, id: string, user: CurrentUserType, ctx: ActiveOperationalContext, completedAt = new Date()) {
        // Serialize completion of this tenant-owned work order. The existing filtered
        // unique ledger indexes remain the final DB-enforced duplicate barrier.
        await tx.$queryRaw(Prisma.sql`
          SELECT [id]
          FROM [dbo].[maintenance_work_orders] WITH (UPDLOCK, HOLDLOCK)
          WHERE [id] = ${id} AND [companyId] = ${ctx.companyId} AND [branchId] = ${ctx.branchId}
        `);

        const workOrder = await tx.maintenanceWorkOrder.findFirst({
          where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
          include: {
            ...this.includeDetail,
            machine: {
              select: {
                id: true,
                companyId: true,
                branchId: true,
                productionLineId: true,
                departmentId: true,
                defaultCostCenterId: true,
              },
            },
            request: {
              select: {
                id: true,
                requestNumber: true,
                title: true,
                machineId: true,
                productionLineId: true,
                costCenterId: true,
                status: true,
              },
            },
            costEntries: {
              orderBy: { incurredAt: 'asc' },
              include: { createdBy: { select: { id: true, name: true } } },
            },
          },
        });
        if (!workOrder) throw this.notFound('Maintenance work order not found');

        // Completion is idempotent. Historical already-completed work orders are
        // returned unchanged and are never silently backfilled.
        if (workOrder.status === 'COMPLETED') return workOrder;
        if (workOrder.status !== 'IN_PROGRESS') {
          throw this.validationError(
            'status',
            'validation.invalidStatusTransition',
            `Cannot complete a work order in status '${workOrder.status}'. Expected IN_PROGRESS`,
          );
        }

        // R2-C: a work order cannot complete against a cancelled/closed request.
        // (Request completion itself is already blocked while this work order is
        // open, so this is defense-in-depth for inconsistent historical data.)
        const linkedRequestStatus = workOrder.request?.status;
        if (linkedRequestStatus === 'CANCELLED' || linkedRequestStatus === 'CLOSED') {
          throw this.validationError(
            'status',
            'workOrderRequestCancelledBlocksCompletion',
            `Cannot complete the work order: its maintenance request is ${linkedRequestStatus}`,
          );
        }

        const openExecutions = await tx.maintenanceTask.count({ where: { workOrderId: id, status: { in: ['PENDING', 'IN_PROGRESS'] } } });
        if (openExecutions) throw executionError('maintenance.openTasksBlockCompletion');
        // Planned quantities are estimates. Actual consumption may be less, more, or unplanned.

        const eligibleCostEntries = await tx.maintenanceWorkOrderCostEntry.findMany({
          where: { workOrderId: workOrder.id, type: { in: ['LABOR', 'EXTERNAL'] }, amount: { gt: 0 } },
          orderBy: [{ incurredAt: 'asc' }, { id: 'asc' }],
          select: { id: true, type: true, amount: true, incurredAt: true },
        });
        const laborEntries = eligibleCostEntries.filter((entry: any) => entry.type === 'LABOR');
        const externalServiceEntries = eligibleCostEntries.filter((entry: any) => entry.type === 'EXTERNAL');
        for (const entry of laborEntries) {
          await this.postMaintenanceLaborLedgerEntry(tx, workOrder, entry, user, ctx);
        }

        for (const entry of externalServiceEntries) {
          await this.postMaintenanceExternalServiceLedgerEntry(tx, workOrder, entry, completedAt, user, ctx);
        }
        const actualCost = await this.computeActualCost(tx, workOrder.id);
        const updated = await tx.maintenanceWorkOrder.update({
          where: { id: workOrder.id },
          data: { status: 'COMPLETED', completedAt, actualCost },
          include: this.includeDetail,
        });

        await this.audit.logWithClient(tx, {
          userId: user.id,
          action: 'STATUS_TRANSITION',
          entity: 'MaintenanceWorkOrder',
          entityId: workOrder.id,
          details: {
            from: 'IN_PROGRESS',
            to: 'COMPLETED',
            action: 'complete',
            companyId: workOrder.companyId,
            branchId: workOrder.branchId,
            maintenanceLaborPrimaryCount: laborEntries.length,
            maintenanceExternalServicePrimaryCount: externalServiceEntries.length,
          },
        });
        return updated;
  }

  private async computeActualCost(client: any, workOrderId: string): Promise<number> {
    const [parts, costs] = await Promise.all([
      client.inventoryMovementLine.aggregate({
        where: { direction: 'OUT', movement: { status: 'POSTED', OR: [{ sourceType: 'MAINTENANCE_WORK_ORDER', sourceId: workOrderId }, { sourceType: 'MAINTENANCE_EXECUTION', executionPartUsages: { some: { execution: { workOrderId } } } }] } },
        _sum: { totalCost: true },
      }),
      client.maintenanceWorkOrderCostEntry.aggregate({
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
    // R2-D (Option 1): request-linked work orders must not create a parallel part
    // truth. Spare parts belong on the maintenance request.
    if (wo.requestId) {
      throw this.validationError(
        'sparePartId',
        'validation.invalidStatusTransition',
        'This work order is linked to a maintenance request. Add required parts on the request instead.',
      );
    }
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
    // R2-D (Option 1): stock for a request-linked work order is issued through the
    // request's required parts (the canonical stock-issue authority). A linked work
    // order never issues independent inventory movements.
    if (wo.requestId) {
      throw this.validationError(
        'partLineIds',
        'validation.invalidStatusTransition',
        'Issue stock through the linked maintenance request parts instead of the work order.',
      );
    }
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
      for (const requestedId of requested) {
        if (!lines.some(line => line.id === requestedId)) {
          throw this.validationError('partLineIds', 'validation.invalidReference',
            `Part line ${requestedId} does not belong to this work order`);
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
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql([
        'SELECT [id] FROM [dbo].[maintenance_work_orders] WITH (UPDLOCK,HOLDLOCK) WHERE [id]=',
        ' AND [companyId]=', ' AND [branchId]=', '',
      ], workOrderId, ctx.companyId, ctx.branchId));
      const currentOrder = await this.findOwned(workOrderId, ctx, tx);
      if (currentOrder.requestId || !['PLANNED', 'IN_PROGRESS'].includes(currentOrder.status)) {
        throw this.validationError('status', 'validation.invalidStatusTransition', 'Work order is no longer eligible for independent issue');
      }
      for (const target of targetProducts) {
        const part = await tx.maintenanceWorkOrderPart.findUnique({ where: { id: target.part.id } });
        if (!part || part.workOrderId !== workOrderId) throw this.validationError('partLineIds', 'validation.invalidReference', 'Work order part not found');
        const spare = part.sparePartId ? await tx.sparePart.findUnique({ where: { id: part.sparePartId } }) : null;
        if (part.sparePartId && (!spare || spare.deletedAt || spare.status !== 'ACTIVE')) {
          throw this.validationError('partLineIds', 'validation.invalidReference', 'Only an active canonical spare part may be issued');
        }
        const productId = spare?.productId || part.productId;
        const product = productId ? await tx.product.findUnique({ where: { id: productId } }) : null;
        if (!productId || !product || product.deletedAt || product.status !== 'ACTIVE'
          || part.productId && spare?.productId && part.productId !== spare.productId) {
          throw this.validationError('partLineIds', 'validation.invalidReference', 'Only the matching active inventory product may be issued');
        }
        const remaining = part.quantity - (part.issuedQuantity || 0);
        const issueQty = Math.min(remaining, part.quantity - (part.issuedQuantity || 0));
        if (issueQty <= 0) continue;

        let movement: any;
        try {
          movement = await this.stockIssue.postStockIssueInTx(tx, {
            productId, warehouseId, quantity: issueQty,
            sourceType: 'MAINTENANCE_WORK_ORDER', sourceId: workOrderId,
            maintenanceWorkOrderId: workOrderId, machineId: wo.machineId,
            productionLineId: wo.productionLineId, costCenterId: wo.costCenterId,
            notes: dto.notes || 'Maintenance work order ' + wo.workOrderNumber + ' parts issue',
            lineNotes: 'Work order ' + wo.workOrderNumber + ' issue',
          }, user.id, ctx);
        } catch (error) {
          if (error instanceof BadRequestException && (error.getResponse() as any).messageKey === 'maintenance.executionInsufficientStock') {
            throw this.validationError('partLineIds', 'validation.insufficientStock', 'Insufficient stock for the requested work order parts');
          }
          throw error;
        }

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
      await this.audit.logWithClient(tx, { userId: user.id, action: 'ISSUE_STOCK', entity: 'MaintenanceWorkOrder', entityId: workOrderId,
        details: { workOrderNumber: wo.workOrderNumber, warehouseId, companyId: ctx.companyId, branchId: ctx.branchId,
          movementNumbers: movements.map(m => m.movement.movementNumber),
          issuedLines: movements.length, parts: movements.map(m => ({ partId: m.partId, issuedQuantity: m.issuedQuantity, status: m.newStatus })) } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
    const wo = await this.findOwned(entry.workOrderId, ctx);
    await this.assertCostEntryMutable(entryId, wo.status, ctx);

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
    if (['COMPLETED', 'CANCELLED'].includes(wo.status)) {
      throw this.validationError('status', 'validation.invalidStatusTransition',
        `Cannot remove cost entries from a ${wo.status.toLowerCase()} work order`);
    }
    await this.assertCostEntryMutable(entryId, wo.status, ctx);

    await this.prisma.maintenanceWorkOrderCostEntry.delete({ where: { id: entryId } });

    await this.audit.log(user.id, 'DELETE', 'MaintenanceWorkOrderCostEntry', entry.id, {
      workOrderId: entry.workOrderId,
      amount: Number(entry.amount),
    });

    return { message: 'Work order cost entry deleted successfully' };
  }

  private async assertCostEntryMutable(entryId: string, workOrderStatus: string, ctx: ActiveOperationalContext) {
    if (['COMPLETED', 'CANCELLED'].includes(workOrderStatus)) {
      throw this.validationError(
        'status',
        'validation.invalidStatusTransition',
        `Cannot change cost entries on a ${workOrderStatus.toLowerCase()} work order`,
      );
    }
    const posted = await this.prisma.operationalCostTransaction.findFirst({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        sourceType: MAINTENANCE_LABOR_SOURCE_TYPE,
        sourceId: entryId,
        sourceFingerprint: { in: [this.laborFingerprint(entryId), this.externalServiceFingerprint(entryId)] },
        entryRole: 'PRIMARY_COST',
      },
      select: { id: true },
    });
    if (posted) {
      throw this.validationError(
        'amount',
        'validation.invalidStatusTransition',
        'Posted maintenance cost is immutable; correct it through canonical reversal and a replacement source event',
      );
    }
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
