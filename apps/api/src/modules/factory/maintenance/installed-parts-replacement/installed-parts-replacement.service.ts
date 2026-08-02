import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { QueryInstalledPartDto, QueryReplacementHistoryDto, SetExpectedLifeDto, RecordInstalledPartReadingDto } from './dto/installed-parts-replacement.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

export const DUE_PROGRESS_THRESHOLD = 0.9;

export interface InstalledPartLifeState {
  lifeStatus: string;
  alertThresholdReached: string;
  progress: number | null;
  expectedExpiryDate: Date | null;
  expectedExpiryReading: number | null;
}

export function computeExpectedLifeState(part: {
  expectedLifeValue: number | null;
  expectedLifeUnit: string | null;
  lifeStartDate: Date | null;
  lifeStartReading: number | null;
  currentReading: number | null;
  warningThresholdPercent: number | null;
}, now: Date = new Date()): InstalledPartLifeState {
  const warningPercent = part.warningThresholdPercent ?? 80;
  if (!part.expectedLifeValue || part.expectedLifeValue <= 0) {
    return { lifeStatus: 'UNKNOWN', alertThresholdReached: 'NONE', progress: null, expectedExpiryDate: null, expectedExpiryReading: null };
  }

  let progress: number | null = null;
  let expectedExpiryDate: Date | null = null;
  let expectedExpiryReading: number | null = null;

  if (part.expectedLifeUnit === 'DAYS') {
    if (part.lifeStartDate) {
      const elapsed = now.getTime() - part.lifeStartDate.getTime();
      const total = part.expectedLifeValue * 86400000;
      progress = total > 0 ? elapsed / total : null;
      expectedExpiryDate = new Date(part.lifeStartDate.getTime() + total);
    }
  } else if (part.expectedLifeUnit === 'HOURS' || part.expectedLifeUnit === 'CYCLES') {
    if (part.lifeStartReading !== null && part.lifeStartReading !== undefined && part.currentReading !== null && part.currentReading !== undefined) {
      progress = (part.currentReading - part.lifeStartReading) / part.expectedLifeValue;
      expectedExpiryReading = part.lifeStartReading + part.expectedLifeValue;
    }
  }

  if (progress === null) {
    return { lifeStatus: 'UNKNOWN', alertThresholdReached: 'NONE', progress: null, expectedExpiryDate, expectedExpiryReading };
  }

  let lifeStatus: string;
  let alertThresholdReached: string;
  if (progress >= 1) {
    lifeStatus = 'EXPIRED';
    alertThresholdReached = 'EXPIRED';
  } else if (progress >= DUE_PROGRESS_THRESHOLD) {
    lifeStatus = 'DUE';
    alertThresholdReached = 'DUE';
  } else if (progress >= warningPercent / 100) {
    lifeStatus = 'WARNING';
    alertThresholdReached = 'WARNING';
  } else {
    lifeStatus = 'NORMAL';
    alertThresholdReached = 'NONE';
  }

  return { lifeStatus, alertThresholdReached, progress, expectedExpiryDate, expectedExpiryReading };
}

@Injectable()
export class InstalledPartsReplacementService {
  constructor(
    private prisma: PrismaService,
    private numberingService: NumberingService,
    private audit: AuditService,
  ) {}

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private badRequest(key: string, message: string, params?: Record<string, string>): BadRequestException {
    return new BadRequestException({ messageKey: key, message, ...(params ? { params } : {}) });
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
    const part = await this.prisma.machineInstalledPart.findUnique({
      where: { id },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!part || !this.machineOwns(part.machine, ctx)) throw this.notFound('maintenance.installedPartNotFound', 'Installed part not found');
    return part;
  }

  private async requestAccess(maintenanceRequestId: string, ctx: ActiveOperationalContext) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id: maintenanceRequestId },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!request || !this.machineOwns(request.machine, ctx)) throw this.notFound('maintenance.requestNotFound', 'Maintenance request not found');
    return request;
  }

  async recordInstalledPartInTx(
    tx: any,
    data: {
      machineId: string;
      machineComponentId?: string | null;
      sparePartId: string;
      productId?: string | null;
      maintenanceRequestId: string;
      requiredPartId: string;
      inventoryMovementId: string;
      conditionMovementId?: string | null;
      installedQuantity: number;
      installedCondition: string;
      installedByUserId: string;
      sourceType?: string;
      sourceId?: string;
      serialNumber?: string | null;
      batchNumber?: string | null;
      notes?: string | null;
    },
  ) {
    return tx.machineInstalledPart.create({
      data: {
        machineId: data.machineId,
        machineComponentId: data.machineComponentId || null,
        sparePartId: data.sparePartId,
        productId: data.productId || null,
        maintenanceRequestId: data.maintenanceRequestId,
        requiredPartId: data.requiredPartId,
        inventoryMovementId: data.inventoryMovementId,
        conditionMovementId: data.conditionMovementId || null,
        installedQuantity: data.installedQuantity,
        installedCondition: data.installedCondition || 'NEW',
        installedAt: new Date(),
        installedByUserId: data.installedByUserId,
        sourceType: data.sourceType || 'MAINTENANCE_ISSUE',
        sourceId: data.sourceId || data.requiredPartId,
        serialNumber: data.serialNumber || null,
        batchNumber: data.batchNumber || null,
        status: 'ACTIVE',
        notes: data.notes || null,
      },
    });
  }

  async recordReplacementInTx(
    tx: any,
    data: {
      machineId: string;
      machineComponentId?: string | null;
      maintenanceRequestId: string;
      requiredPartId: string;
      newInstalledPartId: string;
      oldInstalledPartId?: string | null;
      oldSparePartId?: string | null;
      newSparePartId: string;
      issuedCondition: string;
      issuedQuantity: number;
      removedCondition?: string | null;
      removedQuantity?: number | null;
      replacementAction: string;
      noReturnReason?: string | null;
      removedReturnedToStock?: boolean;
      conditionOutMovementId?: string | null;
      conditionInMovementId?: string | null;
      inventoryOutMovementId: string;
      replacedByUserId: string;
      notes?: string | null;
    },
  ) {
    const replacementNumber = await this.numberingService.generateNumberAtomic('SPARE_PART_REPLACEMENT');

    return tx.sparePartReplacementHistory.create({
      data: {
        replacementNumber,
        machineId: data.machineId,
        machineComponentId: data.machineComponentId || null,
        maintenanceRequestId: data.maintenanceRequestId,
        requiredPartId: data.requiredPartId,
        newInstalledPartId: data.newInstalledPartId,
        oldInstalledPartId: data.oldInstalledPartId || null,
        oldSparePartId: data.oldSparePartId || null,
        newSparePartId: data.newSparePartId,
        issuedCondition: data.issuedCondition,
        issuedQuantity: data.issuedQuantity,
        removedCondition: data.removedCondition || null,
        removedQuantity: data.removedQuantity || null,
        replacementAction: data.replacementAction,
        noReturnReason: data.noReturnReason || null,
        removedReturnedToStock: data.removedReturnedToStock || false,
        conditionOutMovementId: data.conditionOutMovementId || null,
        conditionInMovementId: data.conditionInMovementId || null,
        inventoryOutMovementId: data.inventoryOutMovementId,
        replacedAt: new Date(),
        replacedByUserId: data.replacedByUserId,
        notes: data.notes || null,
      },
    });
  }

  async markInstalledPartRemovedInTx(
    tx: any,
    installedPartId: string,
    data: {
      removedAt?: Date;
      removedByUserId: string;
      removedCondition?: string | null;
      removedQuantity?: number | null;
      removedReason?: string | null;
      newStatus?: string;
    },
  ) {
    return tx.machineInstalledPart.update({
      where: { id: installedPartId },
      data: {
        status: data.newStatus || 'REMOVED',
        removedAt: data.removedAt || new Date(),
        removedByUserId: data.removedByUserId,
        removedCondition: data.removedCondition || null,
        removedQuantity: data.removedQuantity || null,
        removedReason: data.removedReason || null,
      },
    });
  }

  async getInstalledParts(query: QueryInstalledPartDto, ctx: ActiveOperationalContext) {
    const where: any = { machine: this.machineScope(ctx) };
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.maintenanceRequestId) {
      await this.requestAccess(query.maintenanceRequestId, ctx);
      where.maintenanceRequestId = query.maintenanceRequestId;
    }
    if (query.status) where.status = query.status;
    if (query.onlyActive === 'true') where.status = 'ACTIVE';
    if (query.lifeStatus) where.lifeStatus = query.lifeStatus;

    const parts = await this.prisma.machineInstalledPart.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { installedAt: 'desc' },
    });

    const enriched = parts.map((part: any) => {
      const state = computeExpectedLifeState(part);
      return { ...part, life: state };
    });
    return enriched;
  }

  async getInstalledPartById(id: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(id, ctx);
    const detail = await this.prisma.machineInstalledPart.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
    });
    if (!detail) throw this.notFound('maintenance.installedPartNotFound', 'Installed part not found');

    const evaluated = await this.evaluatePartLife(detail.id, ctx);
    const state = computeExpectedLifeState({ ...detail, ...evaluated } as any);
    return { ...detail, life: state };
  }

  async getInstalledPartsByMachine(machineId: string, ctx: ActiveOperationalContext) {
    await this.machineAccess(machineId, ctx);
    const parts = await this.prisma.machineInstalledPart.findMany({
      where: { machineId },
      include: {
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
    const enriched = parts.map((part: any) => ({ ...part, life: computeExpectedLifeState(part) }));
    return enriched;
  }

  async getInstalledPartsByRequest(maintenanceRequestId: string, ctx: ActiveOperationalContext) {
    await this.requestAccess(maintenanceRequestId, ctx);
    return this.prisma.machineInstalledPart.findMany({
      where: { maintenanceRequestId },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
  }

  async getReplacementHistory(query: QueryReplacementHistoryDto, ctx: ActiveOperationalContext) {
    const where: any = { machine: this.machineScope(ctx) };
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.maintenanceRequestId) {
      await this.requestAccess(query.maintenanceRequestId, ctx);
      where.maintenanceRequestId = query.maintenanceRequestId;
    }
    if (query.requiredPartId) where.requiredPartId = query.requiredPartId;

    return this.prisma.sparePartReplacementHistory.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        oldInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        newInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        oldSparePart: { select: { id: true, code: true, name: true } },
        newSparePart: { select: { id: true, code: true, name: true } },
      },
      orderBy: { replacedAt: 'desc' },
      take: query.limit || 50,
    });
  }

  async getReplacementHistoryByMachine(machineId: string, ctx: ActiveOperationalContext) {
    await this.machineAccess(machineId, ctx);
    return this.prisma.sparePartReplacementHistory.findMany({
      where: { machineId },
      include: {
        machineComponent: { select: { id: true, code: true, name: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
        oldInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        newInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        oldSparePart: { select: { id: true, code: true, name: true } },
        newSparePart: { select: { id: true, code: true, name: true } },
      },
      orderBy: { replacedAt: 'desc' },
    });
  }

  async getReplacementHistoryByRequest(maintenanceRequestId: string, ctx: ActiveOperationalContext) {
    await this.requestAccess(maintenanceRequestId, ctx);
    return this.prisma.sparePartReplacementHistory.findMany({
      where: { maintenanceRequestId },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        oldInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        newInstalledPart: {
          select: { id: true, sparePart: { select: { id: true, code: true, name: true } } },
        },
        oldSparePart: { select: { id: true, code: true, name: true } },
        newSparePart: { select: { id: true, code: true, name: true } },
      },
      orderBy: { replacedAt: 'desc' },
    });
  }

  async getActiveInstalledPartsCount(machineId: string, ctx: ActiveOperationalContext): Promise<number> {
    await this.machineAccess(machineId, ctx);
    return this.prisma.machineInstalledPart.count({
      where: { machineId, status: 'ACTIVE' },
    });
  }

  async getReplacementCount(machineId: string, ctx: ActiveOperationalContext): Promise<number> {
    await this.machineAccess(machineId, ctx);
    return this.prisma.sparePartReplacementHistory.count({
      where: { machineId },
    });
  }

  // ── Expected Life Configuration ────────────────────────────────

  async setExpectedLife(id: string, dto: SetExpectedLifeDto, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(id, ctx);
    if (part.status !== 'ACTIVE') {
      throw this.badRequest('maintenance.partNotActive', 'Expected life can only be configured on ACTIVE installed parts');
    }

    if (dto.expectedLifeUnit === 'DAYS' && !dto.lifeStartDate) {
      throw this.badRequest('maintenance.lifeStartDateRequired', 'Life start date is required for DAYS-based expected life');
    }
    if ((dto.expectedLifeUnit === 'HOURS' || dto.expectedLifeUnit === 'CYCLES') && dto.lifeStartReading === undefined) {
      throw this.badRequest('maintenance.lifeStartReadingRequired', 'Life start reading is required for HOURS/CYCLES-based expected life');
    }

    const warningThresholdPercent = dto.warningThresholdPercent ?? part.warningThresholdPercent ?? 80;

    const data: any = {
      expectedLifeValue: dto.expectedLifeValue,
      expectedLifeUnit: dto.expectedLifeUnit,
      warningThresholdPercent,
    };
    if (dto.lifeStartDate !== undefined) data.lifeStartDate = new Date(dto.lifeStartDate);
    if (dto.lifeStartReading !== undefined) data.lifeStartReading = dto.lifeStartReading;
    if (dto.currentReading !== undefined) data.currentReading = dto.currentReading;
    if (data.lifeStartDate !== undefined || data.lifeStartReading !== undefined || data.currentReading !== undefined) {
      data.lastEvaluatedAt = null;
    }

    const updated = await this.prisma.machineInstalledPart.update({
      where: { id },
      data,
    });

    await this.audit.log(userId, 'EXPECTED_LIFE_CONFIGURED', 'MachineInstalledPart', id, {
      expectedLifeValue: dto.expectedLifeValue,
      expectedLifeUnit: dto.expectedLifeUnit,
      lifeStartDate: dto.lifeStartDate || null,
      lifeStartReading: dto.lifeStartReading ?? null,
      currentReading: dto.currentReading ?? null,
      warningThresholdPercent,
    });

    await this.evaluatePartLife(id, ctx, userId);
    return this.getInstalledPartById(id, ctx);
  }

  // ── Readings ───────────────────────────────────────────────────

  async recordReading(id: string, dto: RecordInstalledPartReadingDto, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(id, ctx);
    if (part.status !== 'ACTIVE') {
      throw this.badRequest('maintenance.partNotActive', 'Readings can only be recorded on ACTIVE installed parts');
    }

    const readingType = dto.readingType;
    if (part.expectedLifeUnit && part.expectedLifeUnit !== 'DAYS' && part.expectedLifeUnit !== readingType) {
      throw this.badRequest('maintenance.readingTypeMismatch',
        `Reading type must match the configured expected-life unit (${part.expectedLifeUnit})`);
    }
    if (!part.expectedLifeUnit) {
      throw this.badRequest('maintenance.expectedLifeNotConfigured', 'Configure expected life first before recording readings');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const reading = await tx.machineInstalledPartReading.create({
        data: {
          installedPartId: id,
          readingType,
          readingValue: dto.readingValue,
          isReset: dto.isReset || false,
          recordedByUserId: userId,
          recordedAt: new Date(),
          notes: dto.notes || null,
        },
      });

      let currentReading = dto.readingValue;
      let lifeStartReading = part.lifeStartReading;
      if (dto.isReset) {
        currentReading = 0;
        lifeStartReading = 0;
      }

      const updated = await tx.machineInstalledPart.update({
        where: { id },
        data: {
          currentReading,
          ...(dto.isReset ? { lifeStartReading: 0 } : {}),
          lastEvaluatedAt: null,
        },
      });

      return { reading, updated };
    });

    await this.audit.log(userId, 'INSTALLED_PART_READING_RECORDED', 'MachineInstalledPart', id, {
      readingId: result.reading.id,
      readingType,
      readingValue: dto.readingValue,
      isReset: dto.isReset || false,
    });

    await this.evaluatePartLife(id, ctx, userId);
    return result.reading;
  }

  async getReadings(id: string, ctx: ActiveOperationalContext) {
    await this.partAccess(id, ctx);
    return this.prisma.machineInstalledPartReading.findMany({
      where: { installedPartId: id },
      orderBy: { recordedAt: 'desc' },
      include: { recordedBy: { select: { id: true, name: true } } },
    });
  }

  // ── Expected Life Evaluation (idempotent) ──────────────────────

  async evaluatePartLife(id: string, ctx: ActiveOperationalContext, actingUserId?: string) {
    const part = await this.partAccess(id, ctx);
    const state = computeExpectedLifeState(part);
    return this.persistLifeState(part.id, part, state, actingUserId);
  }

  async evaluateAll(ctx: ActiveOperationalContext) {
    const parts = await this.prisma.machineInstalledPart.findMany({
      where: { machine: this.machineScope(ctx), status: 'ACTIVE' },
      select: { id: true },
    });
    const evaluated = [];
    for (const p of parts) {
      const result = await this.evaluatePartLife(p.id, ctx);
      if (result.changed) evaluated.push(result);
    }
    return { evaluated: evaluated.length, results: evaluated };
  }

  private async persistLifeState(id: string, part: any, state: InstalledPartLifeState, actingUserId?: string) {
    const now = new Date();
    const oldMarker = part.alertThresholdReached || 'NONE';
    const markers = ['NONE', 'WARNING', 'DUE', 'EXPIRED'];
    const oldRank = markers.indexOf(oldMarker);
    const newRank = markers.indexOf(state.alertThresholdReached);
    const markerUpgraded = newRank > oldRank;

    const data: any = {
      lifeStatus: state.lifeStatus,
      alertThresholdReached: state.alertThresholdReached,
      lastEvaluatedAt: now,
      expectedExpiryDate: state.expectedExpiryDate,
      expectedExpiryReading: state.expectedExpiryReading,
    };
    if (markerUpgraded && state.alertThresholdReached !== 'NONE') {
      data.expectedLifeAlertAt = now;
    }

    const updated = await this.prisma.machineInstalledPart.update({ where: { id }, data });

    if (markerUpgraded && state.alertThresholdReached !== 'NONE') {
      await this.audit.log(
        actingUserId,
        'EXPECTED_LIFE_ALERT',
        'MachineInstalledPart',
        id,
        {
          previousThreshold: oldMarker,
          newThreshold: state.alertThresholdReached,
          lifeStatus: state.lifeStatus,
          progress: state.progress !== null ? Math.round(state.progress * 1000) / 1000 : null,
          machineId: part.machineId,
        },
      );
    }

    return { id, changed: markerUpgraded, previousThreshold: oldMarker, current: updated, state };
  }
}
