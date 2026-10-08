import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { MaintenanceStockIssueService } from '../maintenance-stock-issue/maintenance-stock-issue.service';
import { IssueStockDto } from '../maintenance-stock-issue/dto/issue-stock.dto';
import {
  CreateSparePartIssueDto,
  ReturnSparePartIssueDto,
} from './dto/create-spare-part-issue.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { assertWarehouseInContext } from '../../../../common/operational-context/tenant-guards';

const ISSUABLE_STATUSES = ['APPROVED', 'RESERVED'];

/**
 * R4R — canonical Spare Part Issue authority.
 *
 * This service owns ONE write path for physically issuing a spare part out of a
 * warehouse. It deliberately does NOT re-implement any inventory, valuation,
 * condition-balance, installed-part or replacement logic: it resolves and validates
 * the maintenance context, then delegates to MaintenanceStockIssueService, which is
 * the single proven stock-mutation implementation in this system. There is therefore
 * exactly one place where an InventoryMovement is created, one place where the
 * InventoryBalance is decremented, and one place where the cost ledger entry is
 * posted for a maintenance spare-part OUT issue.
 *
 * Before R4R the only entry point was nested under the maintenance request route
 * (`POST /maintenance/requests/:requestId/parts/:lineId/stock-issue/issue`), which
 * made the warehouse transaction look like part of the request form. That route is
 * gone; this is the canonical route.
 */
@Injectable()
export class SparePartIssuesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private stockIssue: MaintenanceStockIssueService,
  ) {}

  /**
   * The issue desk worklist: approved/reserved maintenance requirements in the active
   * company/branch whose spare part can physically be issued. Tenant-scoped at the
   * owning machine, exactly like the write path, so the list can never disclose
   * another company's issuable requirements.
   */
  async listIssuable(query: {
    page?: number;
    limit?: number;
    search?: string;
    requestId?: string;
    warehouseId?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 200);

    const where: Prisma.MaintenanceRequestRequiredPartWhereInput = {
      status: { in: ISSUABLE_STATUSES as any },
      maintenanceRequest: {
        machine: {
          companyId: ctx.companyId,
          OR: [{ branchId: ctx.branchId }, { branchId: null }],
        },
      },
      ...(query.requestId ? { maintenanceRequestId: query.requestId } : {}),
      ...(query.search
        ? {
            OR: [
              { sparePart: { code: { contains: query.search } } },
              { sparePart: { name: { contains: query.search } } },
              { maintenanceRequest: { requestNumber: { contains: query.search } } },
            ],
          }
        : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.maintenanceRequestRequiredPart.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sparePart: {
            select: {
              id: true, code: true, name: true, productId: true, unit: true,
              status: true, deletedAt: true, isCritical: true,
              technicalClassification: true, usageType: true, nature: true, importance: true,
            },
          },
          maintenanceRequest: {
            select: {
              id: true, requestNumber: true, title: true, status: true,
              machine: { select: { id: true, code: true, name: true, branchId: true } },
            },
          },
          machineComponent: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          lastIssueBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceRequestRequiredPart.count({ where }),
    ]);

    const productIds = [...new Set(rows.map((r) => r.sparePart?.productId).filter((v): v is string => !!v))];
    const balances = productIds.length
      ? await this.prisma.inventoryBalance.findMany({
          where: {
            productId: { in: productIds },
            warehouse: { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] },
          },
          select: { productId: true, warehouseId: true, quantity: true },
        })
      : [];
    const balanceByKey = new Map(balances.map((b) => [`${b.productId}::${b.warehouseId}`, Number(b.quantity)]));

    return {
      data: rows.map((r) => {
        const approvable = r.approvedQuantity || r.requestedQuantity || r.quantity;
        const netIssued = Number(r.issuedQuantity || 0) - Number(r.returnedQuantity || 0);
        return {
          id: r.id,
          maintenanceRequestId: r.maintenanceRequestId,
          requestNumber: r.maintenanceRequest.requestNumber,
          requestTitle: r.maintenanceRequest.title,
          requestStatus: r.maintenanceRequest.status,
          machine: r.maintenanceRequest.machine,
          machineComponent: r.machineComponent,
          sparePart: r.sparePart,
          requestedQuantity: Number(r.requestedQuantity || 0),
          approvedQuantity: Number(r.approvedQuantity || 0),
          issuedQuantity: Number(r.issuedQuantity || 0),
          returnedQuantity: Number(r.returnedQuantity || 0),
          remainingIssuableQuantity: Math.max(0, Number(approvable) - netIssued),
          stockIssueStatus: r.stockIssueStatus,
          warehouse: r.warehouse,
          lastIssueAt: r.lastIssueAt,
          lastIssueBy: r.lastIssueBy,
          issuable:
            !!r.sparePart?.productId &&
            r.sparePart?.status === 'ACTIVE' &&
            !r.sparePart?.deletedAt &&
            Math.max(0, Number(approvable) - netIssued) > 0,
          availableQuantity: r.sparePart?.productId && r.warehouseId
            ? balanceByKey.get(`${r.sparePart.productId}::${r.warehouseId}`) ?? null
            : null,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * R4R — the canonical write. Validates the maintenance context in THIS service
   * (so a bad payload is rejected before any delegation) and then hands the single
   * proven stock-mutation implementation to do the atomic work.
   */
  async issue(dto: CreateSparePartIssueDto, userId: string, ctx: ActiveOperationalContext) {
    const requirement = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: dto.requiredPartId },
      select: {
        id: true,
        maintenanceRequestId: true,
        machineComponentId: true,
        status: true,
        sparePart: { select: { id: true, code: true, productId: true, status: true, deletedAt: true } },
        maintenanceRequest: {
          select: { id: true, machine: { select: { id: true, companyId: true, branchId: true } } },
        },
      },
    });

    // A requirement from another tenant and a missing requirement are reported
    // identically so this route never discloses another company's record ids.
    if (!requirement) {
      throw new NotFoundException({
        messageKey: 'sparePartIssue.requirementNotFound',
        message: 'The selected maintenance requirement does not exist in the active company and branch',
      });
    }
    if (requirement.maintenanceRequest.machine.companyId !== ctx.companyId) {
      throw new NotFoundException({
        messageKey: 'sparePartIssue.requirementNotFound',
        message: 'The selected maintenance requirement does not exist in the active company and branch',
      });
    }
    if (
      requirement.maintenanceRequest.machine.branchId &&
      requirement.maintenanceRequest.machine.branchId !== ctx.branchId
    ) {
      throw new NotFoundException({
        messageKey: 'sparePartIssue.requirementNotFound',
        message: 'The selected maintenance requirement does not exist in the active company and branch',
      });
    }
    if (requirement.maintenanceRequestId !== dto.maintenanceRequestId) {
      throw new BadRequestException({
        messageKey: 'sparePartIssue.requirementRequestMismatch',
        message: 'The requirement does not belong to the supplied maintenance request',
      });
    }
    if (!ISSUABLE_STATUSES.includes(requirement.status)) {
      throw new BadRequestException({
        messageKey: 'sparePartIssue.requirementNotIssuable',
        message: `Requirement is in status '${requirement.status}' and must be APPROVED or RESERVED before stock can be issued`,
      });
    }
    if (!requirement.sparePart) {
      throw new BadRequestException({
        messageKey: 'sparePartIssue.sparePartMissing',
        message: 'The requirement has no canonical spare part item attached',
      });
    }

    // Warehouse authorization is enforced here AND again inside the transaction of
    // the stock authority. It is never trusted from the payload alone.
    await assertWarehouseInContext(this.prisma, dto.warehouseId, ctx);

    // Only these fields are forwarded to the stock authority. This is an explicit
    // allow-list, not a rest-spread: a payload that carries identity fields
    // (sparePartId, productId, machineId, approvedQuantity, ...) must never reach the
    // authority, so no client-supplied identity can influence the transaction even if
    // the global validation pipe is ever relaxed. The spare part, machine, component
    // and approved quantity are resolved from the requirement, server-side.
    const issueDto: IssueStockDto = {
      warehouseId: dto.warehouseId,
      issuedQuantity: dto.issuedQuantity,
      warehouseLocationId: dto.warehouseLocationId,
      notes: dto.notes,
      costOwnerType: dto.costOwnerType,
      costOwnerAdministrationId: dto.costOwnerAdministrationId,
      costDepartmentId: dto.costDepartmentId,
      costProductionLineId: dto.costProductionLineId,
      costMachineId: dto.costMachineId,
      costMachineComponentId: dto.costMachineComponentId,
      unitCost: dto.unitCost,
      receivedByUserId: dto.receivedByUserId,
      issuedStockCondition: dto.issuedStockCondition,
      replacementAction: dto.replacementAction,
      oldInstalledPartId: dto.oldInstalledPartId,
      removedPartCondition: dto.removedPartCondition,
      removedPartWarehouseId: dto.removedPartWarehouseId,
      removedPartQuantity: dto.removedPartQuantity,
      removedPartReturnedByUserId: dto.removedPartReturnedByUserId,
      noReturnReason: dto.noReturnReason,
      costPurpose: dto.costPurpose,
      costPurposeOverrideReason: dto.costPurposeOverrideReason,
    };
    for (const key of Object.keys(issueDto)) {
      if ((issueDto as unknown as Record<string, unknown>)[key] === undefined) {
        delete (issueDto as unknown as Record<string, unknown>)[key];
      }
    }

    const result = await this.stockIssue.issue(
      dto.maintenanceRequestId,
      dto.requiredPartId,
      issueDto,
      userId,
      ctx,
      dto.clientRequestId ? { clientRequestId: dto.clientRequestId } : {},
    );

    // R4R: an idempotent replay did not create a second stock movement, so it must
    // not create a second canonical audit event either. The authority already audited
    // the original ISSUE_STOCK event; duplicating SPARE_PART_ISSUE would misrepresent
    // the number of transactions in the audit trail.
    const replayed = Boolean((result as { idempotentReplay?: boolean } | null)?.idempotentReplay);
    if (!replayed) {
      await this.audit.log(userId, 'SPARE_PART_ISSUE', 'MaintenanceRequestRequiredPart', dto.requiredPartId, {
        canonicalWorkflow: 'SPARE_PART_ISSUE',
        maintenanceRequestId: dto.maintenanceRequestId,
        machineId: requirement.maintenanceRequest.machine.id,
        machineComponentId: requirement.machineComponentId,
        sparePartId: requirement.sparePart.id,
        sparePartCode: requirement.sparePart.code,
        warehouseId: dto.warehouseId,
        issuedQuantity: dto.issuedQuantity,
        ...(dto.clientRequestId ? { clientRequestId: dto.clientRequestId } : {}),
        companyId: ctx.companyId,
        branchId: ctx.branchId,
      });
    }

    return result;
  }

  async return(dto: ReturnSparePartIssueDto, requiredPartId: string, maintenanceRequestId: string, userId: string, ctx: ActiveOperationalContext) {
    await this.assertRequirementInContext(requiredPartId, maintenanceRequestId, ctx);
    return this.stockIssue.returnStock(maintenanceRequestId, requiredPartId, dto, userId, ctx);
  }

  /**
   * Immutable issue history for a requirement, read through the canonical route.
   * Tenant-scoped by company/branch exactly like the write path.
   */
  async movements(requiredPartId: string, maintenanceRequestId: string, ctx: ActiveOperationalContext) {
    await this.assertRequirementInContext(requiredPartId, maintenanceRequestId, ctx);
    return this.stockIssue.getIssues(requiredPartId, maintenanceRequestId, ctx);
  }

  private async assertRequirementInContext(
    requiredPartId: string,
    maintenanceRequestId: string,
    ctx: ActiveOperationalContext,
  ) {
    const requirement = await this.prisma.maintenanceRequestRequiredPart.findUnique({
      where: { id: requiredPartId },
      select: {
        maintenanceRequestId: true,
        maintenanceRequest: { select: { machine: { select: { companyId: true, branchId: true } } } },
      },
    });
    if (!requirement) {
      throw new NotFoundException({
        messageKey: 'sparePartIssue.requirementNotFound',
        message: 'The selected maintenance requirement does not exist in the active company and branch',
      });
    }
    const machine = requirement.maintenanceRequest.machine;
    if (machine.companyId !== ctx.companyId || (machine.branchId && machine.branchId !== ctx.branchId)) {
      throw new NotFoundException({
        messageKey: 'sparePartIssue.requirementNotFound',
        message: 'The selected maintenance requirement does not exist in the active company and branch',
      });
    }
    if (requirement.maintenanceRequestId !== maintenanceRequestId) {
      throw new BadRequestException({
        messageKey: 'sparePartIssue.requirementRequestMismatch',
        message: 'The requirement does not belong to the supplied maintenance request',
      });
    }
  }
}
