import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMaintenanceRequestCostDto } from './dto/create-maintenance-request-cost.dto';
import { UpdateMaintenanceRequestCostDto } from './dto/update-maintenance-request-cost.dto';

@Injectable()
export class MaintenanceRequestCostsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
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

  private assertRequestNotTerminal(request: { status: string }) {
    if (['COMPLETED', 'CANCELLED', 'CLOSED'].includes(request.status)) {
      throw new BadRequestException({
        messageKey: 'maintenance.cannotUpdateCostsTerminalRequest',
        message: 'Cannot update costs on completed, cancelled, or closed requests',
      });
    }
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const entry = await this.prisma.maintenanceRequestCostEntry.findUnique({
      where: { id },
      include: {
        request: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            status: true,
            machine: { select: { companyId: true, branchId: true } },
          },
        },
      },
    });
    if (!entry || !this.isMachineInScope(entry.request.machine, ctx)) {
      throw new NotFoundException('Cost entry not found');
    }
    return entry;
  }

  /**
   * R2-H: legacy request-cost recording is read-only.
   *
   * The canonical monetary authority is OperationalCostTransaction, written
   * only through the frozen Cost Program writer
   * (ProductionCostService.postLedgerEntryWithinTransaction) with
   * costPurpose MAINTENANCE and entryRole PRIMARY_COST.
   *
   * A legitimate manual maintenance cost use case does exist, and the closed
   * Cost Program already serves it canonically: work-order labor and external
   * service are asserted on MaintenanceWorkOrderCostEntry and projected into
   * the ledger when the work order completes, with a per-source fingerprint
   * and a maintenanceWorkOrderId reference. Material is posted from valued
   * inventory movement lines. A request-level manual cost entry is therefore
   * not a missing feature; it is a second ledger for the same money.
   *
   * The legacy row also cannot be delegated: the canonical writer requires a
   * resolvable maintenanceWorkOrderId and a cost centre resolved for the
   * posting date, neither of which the legacy payload (requestId/type/
   * description/amount) carries. Posting it would fabricate cost attribution,
   * so these mutations fail closed as deprecated instead.
   */
  private legacyWriteDeprecated(): BadRequestException {
    return new BadRequestException({
      messageKey: 'maintenance.legacyCostEntryWriteDeprecated',
      message: 'Legacy request cost recording is read-only; use work-order cost entries and the operational cost ledger',
    });
  }

  async create(_dto: CreateMaintenanceRequestCostDto, _userId: string, _ctx: ActiveOperationalContext) {
    throw this.legacyWriteDeprecated();
  }

  async findAll(query: { requestId?: string; type?: string }, ctx: ActiveOperationalContext) {
    const where: any = { request: { machine: this.machineScope(ctx) } };
    if (query.requestId) where.request = { ...where.request, id: query.requestId };
    if (query.type) where.type = query.type;

    return this.prisma.maintenanceRequestCostEntry.findMany({
      where,
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { incurredAt: 'desc' },
    });
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(_id: string, _dto: UpdateMaintenanceRequestCostDto, _userId: string, _ctx: ActiveOperationalContext) {
    throw this.legacyWriteDeprecated();
  }

  async remove(_id: string, _userId: string, _ctx: ActiveOperationalContext) {
    throw this.legacyWriteDeprecated();
  }
}
