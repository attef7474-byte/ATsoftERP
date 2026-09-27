import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateMaintenanceRequestPartDto } from './dto/create-maintenance-request-part.dto';
import { UpdateMaintenanceRequestPartDto } from './dto/update-maintenance-request-part.dto';

@Injectable()
export class MaintenanceRequestPartsService {
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
        messageKey: 'maintenance.cannotUpdatePartsTerminalRequest',
        message: 'Cannot update parts on completed, cancelled, or closed requests',
      });
    }
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const part = await this.prisma.maintenanceRequestPartUsage.findUnique({
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
        product: { select: { id: true, name: true, code: true, unit: true } },
      },
    });
    if (!part || !this.isMachineInScope(part.request.machine, ctx)) {
      throw new NotFoundException('Part usage not found');
    }
    return part;
  }

  /**
   * R2-H: legacy part-usage recording is read-only.
   *
   * MaintenanceRequestPartUsage was a parallel record with no inventory
   * movement, no balance effect, no valuation and no tenant columns of its
   * own, so a row written here asserted a part consumption that never
   * physically happened. The canonical physical authority is
   * MaintenanceRequestRequiredPart -> MaintenanceStockIssue ->
   * InventoryMovement -> InventoryBalance, and the canonical current-status
   * authority is the required-part lifecycle.
   *
   * The legacy payload carries only requestId/productId/quantity/unitCost. It
   * has no warehouse, no approval and no valuation evidence, so a safe
   * delegation to the canonical stock-issue path is impossible: performing it
   * would require inventing a warehouse, an approval and a cost. These
   * mutations therefore fail closed as deprecated rather than fabricating
   * physical truth.
   */
  private legacyWriteDeprecated(): BadRequestException {
    return new BadRequestException({
      messageKey: 'maintenance.legacyPartUsageWriteDeprecated',
      message: 'Legacy part usage recording is read-only; use the required-part and stock-issue flow',
    });
  }

  async create(_dto: CreateMaintenanceRequestPartDto, _userId: string, _ctx: ActiveOperationalContext) {
    throw this.legacyWriteDeprecated();
  }

  async findAll(query: { requestId?: string; productId?: string }, ctx: ActiveOperationalContext) {
    const where: any = { request: { machine: this.machineScope(ctx) } };
    if (query.requestId) where.request = { ...where.request, id: query.requestId };
    if (query.productId) where.productId = query.productId;

    return this.prisma.maintenanceRequestPartUsage.findMany({
      where,
      include: {
        request: { select: { id: true, requestNumber: true, title: true } },
        product: { select: { id: true, name: true, code: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(_id: string, _dto: UpdateMaintenanceRequestPartDto, _userId: string, _ctx: ActiveOperationalContext) {
    throw this.legacyWriteDeprecated();
  }

  async remove(_id: string, _userId: string, _ctx: ActiveOperationalContext) {
    throw this.legacyWriteDeprecated();
  }
}
