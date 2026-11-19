import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../../modules/numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { QueryInstalledPartDto, QueryInstalledPartLookupDto, QueryReplacementHistoryDto, SetExpectedLifeDto, RecordInstalledPartReadingDto, RegisterInstalledPartDto, RemoveInstalledPartDto } from './dto/installed-parts-replacement.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { assertMachineComponentBelongsToMachine } from '../../../../common/operational-context/tenant-guards';
import {
  DEFAULT_WARNING_THRESHOLD_PERCENT,
  EXPECTED_LIFE_UNITS,
  MAX_WARNING_THRESHOLD_PERCENT,
  MIN_WARNING_THRESHOLD_PERCENT,
} from '../expected-life/expected-life.constants';

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

const round = (value: number, decimals = 3) => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * Phase 3 read model. `computeExpectedLifeState` remains the only authority for
 * status, expiry and progress; this function only derives display quantities
 * from that state and the stored snapshot. The frontend never recalculates.
 */
export function buildInstalledPartLifeView(part: any, standard?: any, now: Date = new Date()) {
  const state = computeExpectedLifeState(part, now);
  const value = part?.expectedLifeValue ?? null;
  const unit = part?.expectedLifeUnit ?? null;
  const warning = part?.warningThresholdPercent ?? null;

  let consumed: number | null = null;
  let remaining: number | null = null;
  let overBy: number | null = null;

  if (unit === 'DAYS' && part?.lifeStartDate && value && value > 0) {
    const start = new Date(part.lifeStartDate).getTime();
    if (Number.isFinite(start)) {
      const elapsedDays = (now.getTime() - start) / 86400000;
      consumed = round(elapsedDays);
      remaining = round(value - elapsedDays);
    }
  } else if ((unit === 'HOURS' || unit === 'CYCLES') && value && value > 0
    && part?.lifeStartReading !== null && part?.lifeStartReading !== undefined
    && part?.currentReading !== null && part?.currentReading !== undefined) {
    const delta = part.currentReading - part.lifeStartReading;
    consumed = round(delta);
    remaining = round(value - delta);
  }
  if (remaining !== null && remaining < 0) overBy = round(Math.abs(remaining));

  const standardValue = standard?.defaultExpectedLifeValue ?? null;
  const standardUnit = standard?.defaultExpectedLifeUnit ?? null;
  const standardWarning = standard?.defaultWarningThresholdPercent ?? null;
  const isOverridden = standardValue !== null
    && (value !== standardValue || unit !== standardUnit || warning !== (standardWarning ?? DEFAULT_WARNING_THRESHOLD_PERCENT));

  return {
    standardExpectedLifeValue: standardValue,
    standardExpectedLifeUnit: standardUnit,
    standardWarningThresholdPercent: standardWarning,
    appliedExpectedLifeValue: value,
    appliedExpectedLifeUnit: unit,
    warningThresholdPercent: warning,
    isOverridden,
    lifeStartDate: part?.lifeStartDate ?? null,
    lifeStartReading: part?.lifeStartReading ?? null,
    currentReading: part?.currentReading ?? null,
    consumed,
    remaining,
    overBy,
    progress: state.progress,
    progressPercent: state.progress === null ? null : round(state.progress * 100, 1),
    expectedExpiryDate: state.expectedExpiryDate,
    expectedExpiryReading: state.expectedExpiryReading,
    lifeStatus: state.lifeStatus,
    alertThresholdReached: state.alertThresholdReached,
    lastEvaluatedAt: part?.lastEvaluatedAt ?? null,
  };
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

  /**
   * Phase 3 — one canonical inheritance boundary. Every production writer of
   * MachineInstalledPart calls recordInstalledPartInTx, so snapshotting here
   * covers manual registration, execution issue, direct issue and replacement.
   * The result is an immutable copy: later SparePart default changes never
   * mutate this installed instance.
   */
  private async buildInstalledPartLifeSnapshot(
    tx: any,
    sparePartId: string,
    override: {
      expectedLifeValue?: number | null;
      expectedLifeUnit?: string | null;
      lifeStartDate?: Date | string | null;
      lifeStartReading?: number | null;
      currentReading?: number | null;
      warningThresholdPercent?: number | null;
    },
    installedAt: Date,
  ) {
    const sparePart = await tx.sparePart.findUnique({
      where: { id: sparePartId },
      select: {
        defaultExpectedLifeValue: true,
        defaultExpectedLifeUnit: true,
        defaultWarningThresholdPercent: true,
      },
    });

    const value = override.expectedLifeValue ?? sparePart?.defaultExpectedLifeValue ?? null;
    const unit = override.expectedLifeUnit ?? sparePart?.defaultExpectedLifeUnit ?? null;
    let warning = override.warningThresholdPercent ?? sparePart?.defaultWarningThresholdPercent ?? DEFAULT_WARNING_THRESHOLD_PERCENT;

    if (value !== null && (value === undefined || value <= 0)) {
      throw this.badRequest('maintenance.expectedLifeValueInvalid', 'Expected life value must be greater than zero');
    }
    if (value !== null && !unit) {
      throw this.badRequest('maintenance.expectedLifeUnitRequired', 'Expected life unit is required when a life value is configured');
    }
    if (unit && !(EXPECTED_LIFE_UNITS as readonly string[]).includes(unit)) {
      throw this.badRequest('maintenance.expectedLifeUnitInvalid', 'Expected life unit must be DAYS, HOURS or CYCLES');
    }
    if (warning < MIN_WARNING_THRESHOLD_PERCENT || warning > MAX_WARNING_THRESHOLD_PERCENT) {
      throw this.badRequest('maintenance.warningThresholdInvalid', 'Warning threshold must be between 1 and 99 percent');
    }

    const now = new Date();
    let lifeStartDate: Date | null = null;
    let lifeStartReading: number | null = null;
    let currentReading: number | null = null;

    if (unit === 'DAYS' && value !== null) {
      lifeStartDate = override.lifeStartDate ? new Date(override.lifeStartDate) : installedAt;
      if (!Number.isFinite(lifeStartDate.getTime())) {
        throw this.badRequest('maintenance.lifeStartDateInvalid', 'Life start date must be valid');
      }
      if (lifeStartDate.getTime() > now.getTime()) {
        throw this.badRequest('maintenance.lifeStartDateInvalid', 'Life start date cannot be in the future');
      }
    } else if ((unit === 'HOURS' || unit === 'CYCLES') && value !== null) {
      lifeStartReading = override.lifeStartReading ?? null;
      if (lifeStartReading !== null) {
        currentReading = override.currentReading ?? lifeStartReading;
        if (currentReading < lifeStartReading) {
          throw this.badRequest('maintenance.readingCannotDecrease', 'Current reading cannot be lower than the life start reading');
        }
      }
    }

    if (value === null) {
      // Preserve NULL life as UNKNOWN; never fabricate a default.
      lifeStartDate = null;
      lifeStartReading = null;
      currentReading = null;
      warning = DEFAULT_WARNING_THRESHOLD_PERCENT;
    }

    const state = computeExpectedLifeState({
      expectedLifeValue: value,
      expectedLifeUnit: unit,
      lifeStartDate,
      lifeStartReading,
      currentReading,
      warningThresholdPercent: warning,
    }, now);

    return {
      expectedLifeValue: value,
      expectedLifeUnit: unit,
      warningThresholdPercent: warning,
      lifeStartDate,
      lifeStartReading,
      currentReading,
      expectedExpiryDate: state.expectedExpiryDate,
      expectedExpiryReading: state.expectedExpiryReading,
      lifeStatus: state.lifeStatus,
      alertThresholdReached: state.alertThresholdReached,
      lastEvaluatedAt: now,
    };
  }

  async recordInstalledPartInTx(
    tx: any,
    data: {
      machineId: string;
      machineComponentId?: string | null;
      sparePartId: string;
      productId?: string | null;
      maintenanceRequestId?: string | null;
      requiredPartId?: string | null;
      inventoryMovementId?: string | null;
      conditionMovementId?: string | null;
      installedQuantity: number;
      installedCondition: string;
      installedByUserId: string;
      installedAt?: Date;
      sourceType?: string;
      sourceId?: string;
      serialNumber?: string | null;
      batchNumber?: string | null;
      notes?: string | null;
      expectedLifeValue?: number | null;
      expectedLifeUnit?: string | null;
      lifeStartDate?: Date | string | null;
      lifeStartReading?: number | null;
      currentReading?: number | null;
      warningThresholdPercent?: number | null;
    },
  ) {
    // Invariant A — the component must be mounted on the machine the part is
    // installed on. Enforced here on the single MachineInstalledPart writer so
    // every current and future caller is covered. Runs on the same tx client.
    if (data.machineComponentId) {
      await assertMachineComponentBelongsToMachine(tx, data.machineComponentId, data.machineId);
    }

    const installedAt = data.installedAt ?? new Date();
    const lifeSnapshot = await this.buildInstalledPartLifeSnapshot(tx, data.sparePartId, data, installedAt);

    return tx.machineInstalledPart.create({
      data: {
        machineId: data.machineId,
        machineComponentId: data.machineComponentId || null,
        sparePartId: data.sparePartId,
        productId: data.productId || null,
        maintenanceRequestId: data.maintenanceRequestId,
        requiredPartId: data.requiredPartId,
        inventoryMovementId: data.inventoryMovementId || null,
        conditionMovementId: data.conditionMovementId || null,
        installedQuantity: data.installedQuantity,
        installedCondition: data.installedCondition || 'NEW',
        installedAt,
        installedByUserId: data.installedByUserId,
        sourceType: data.sourceType || 'MAINTENANCE_ISSUE',
        sourceId: data.sourceId || data.requiredPartId,
        serialNumber: data.serialNumber || null,
        batchNumber: data.batchNumber || null,
        status: 'ACTIVE',
        notes: data.notes || null,
        ...lifeSnapshot,
      },
    });
  }

  async recordReplacementInTx(
    tx: any,
    data: {
      machineId: string;
      machineComponentId?: string | null;
      maintenanceRequestId?: string | null;
      requiredPartId?: string | null;
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
      replacedAt?: Date;
      notes?: string | null;
    },
  ) {
    // Invariant A (defense in depth) — the SAME canonical guard used by the
    // installed-part writer. The replacement history is written in the same
    // transaction, immediately after the guarded installed-part write, and both
    // the machine and component identities are server-derived from the
    // tenant-scoped requirement line (findPartLineOrFail -> assertMachineInContext),
    // never from the client. Because this low-level writer operates only on
    // already tenant-validated identities, no active context is re-sourced here
    // (the helper's ctx is optional for exactly this case). Null component stays
    // valid for whole-machine parts.
    if (data.machineComponentId) {
      await assertMachineComponentBelongsToMachine(tx, data.machineComponentId, data.machineId);
    }

    const replacementNumber = await this.numberingService.generateNumberAtomicWithClient('SPARE_PART_REPLACEMENT', tx);

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
        replacedAt: data.replacedAt ?? new Date(),
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

  /**
   * Applicability check (SOFT mode). MachineSparePart / ComponentSparePart define
   * whether a spare part is *allowed* on a machine/component; a physical
   * installation may still be registered even when the catalog link is missing,
   * because the applicability catalog is still being completed. The result is
   * reported (and audited) but never blocks registration.
   */
  private async checkApplicability(machineId: string, machineComponentId: string | null, sparePartId: string) {
    const [machineLink, componentLink] = await Promise.all([
      this.prisma.machineSparePart.findFirst({ where: { machineId, sparePartId, status: 'ACTIVE' }, select: { id: true } }),
      machineComponentId
        ? this.prisma.componentSparePart.findFirst({ where: { componentId: machineComponentId, sparePartId, status: 'ACTIVE' }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    return {
      mode: 'SOFT' as const,
      machineApplicable: !!machineLink,
      componentApplicable: machineComponentId ? !!componentLink : null,
      applicable: !!machineLink || !!componentLink,
    };
  }

  /**
   * REGISTER_EXISTING_INSTALLATION — records a part that is already physically
   * installed on a machine (or a component of it). This is a master/state
   * registration: it does NOT issue stock, does NOT create an inventory movement,
   * and derives the inventory product from the canonical SparePart link (never
   * from client input). Idempotent on `clientRequestId`.
   */
  async registerExistingInstallation(dto: RegisterInstalledPartDto, userId: string, ctx: ActiveOperationalContext) {
    await this.machineAccess(dto.machineId, ctx);

    if (dto.installedAt) {
      const at = new Date(dto.installedAt);
      if (!Number.isFinite(at.getTime()) || at.getTime() > Date.now()) {
        throw this.badRequest('maintenance.installedAtInvalid', 'Installation time must be valid and cannot be in the future');
      }
    }

    const sparePart = await this.prisma.sparePart.findUnique({ where: { id: dto.sparePartId } });
    if (!sparePart || sparePart.deletedAt || sparePart.status !== 'ACTIVE') {
      throw this.notFound('maintenance.installedPartSparePartInvalid', 'Active canonical spare part not found');
    }

    const applicability = await this.checkApplicability(dto.machineId, dto.machineComponentId || null, dto.sparePartId);

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.machineComponentId) {
        await assertMachineComponentBelongsToMachine(tx, dto.machineComponentId, dto.machineId);
      }

      // Idempotency — a resubmitted registration (same submission key) returns
      // the original record instead of creating a duplicate installation.
      const existing = await tx.machineInstalledPart.findFirst({
        where: { sourceType: 'MANUAL_REGISTRATION', sourceId: dto.clientRequestId },
      });
      if (existing) return { part: existing, idempotent: true };

      // Duplicate-active safety — an identical serialized instance already
      // installed on the same machine/component is rejected. Non-serialized
      // spare parts intentionally allow multiple concurrent units.
      if (dto.serialNumber) {
        const dup = await tx.machineInstalledPart.findFirst({
          where: {
            machineId: dto.machineId,
            machineComponentId: dto.machineComponentId || null,
            sparePartId: dto.sparePartId,
            serialNumber: dto.serialNumber,
            status: 'ACTIVE',
          },
        });
        if (dup) {
          throw new ConflictException({
            messageKey: 'maintenance.installedPartDuplicateActive',
            message: 'An active installed part with the same serial number already exists on this machine/component',
          });
        }
      }

      const part = await this.recordInstalledPartInTx(tx, {
        machineId: dto.machineId,
        machineComponentId: dto.machineComponentId || null,
        sparePartId: dto.sparePartId,
        productId: sparePart.productId || null,
        installedQuantity: dto.installedQuantity ?? 1,
        installedCondition: dto.installedCondition || 'NEW',
        installedByUserId: userId,
        installedAt: dto.installedAt ? new Date(dto.installedAt) : undefined,
        sourceType: 'MANUAL_REGISTRATION',
        sourceId: dto.clientRequestId,
        serialNumber: dto.serialNumber || null,
        batchNumber: dto.batchNumber || null,
        notes: dto.notes || null,
        expectedLifeValue: dto.expectedLifeValue,
        expectedLifeUnit: dto.expectedLifeUnit,
        lifeStartDate: dto.lifeStartDate ? new Date(dto.lifeStartDate) : undefined,
        lifeStartReading: dto.lifeStartReading,
        currentReading: dto.currentReading,
        warningThresholdPercent: dto.warningThresholdPercent,
      });
      return { part, idempotent: false };
    });

    if (!result.idempotent) {
      await this.audit.log(userId, 'INSTALLED_PART_REGISTERED', 'MachineInstalledPart', result.part.id, {
        machineId: dto.machineId,
        machineComponentId: dto.machineComponentId || null,
        sparePartId: dto.sparePartId,
        productId: sparePart.productId || null,
        installedQuantity: dto.installedQuantity ?? 1,
        installedCondition: dto.installedCondition || 'NEW',
        serialNumber: dto.serialNumber || null,
        source: 'MANUAL_REGISTRATION',
        applicability,
        lifeSnapshot: buildInstalledPartLifeView(result.part, sparePart),
        companyId: ctx.companyId,
        branchId: ctx.branchId,
      });
    }

    const detail = await this.getInstalledPartById(result.part.id, ctx);
    return { ...detail, idempotent: result.idempotent, applicability };
  }

  /**
   * Authorized removal/decommission of an installed part. This is a state
   * transition only — it never moves stock. Stocked replacements are handled by
   * the maintenance execution flow (maintenance-stock-issue).
   */
  async removeInstalledPart(id: string, dto: RemoveInstalledPartDto, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(id, ctx);
    if (part.status !== 'ACTIVE') {
      throw this.badRequest('maintenance.partNotActive', 'Only an ACTIVE installed part can be removed');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return this.markInstalledPartRemovedInTx(tx, id, {
        removedByUserId: userId,
        removedCondition: dto.removedCondition || null,
        removedQuantity: dto.removedQuantity ?? part.installedQuantity,
        removedReason: dto.removedReason || null,
        newStatus: dto.newStatus || 'REMOVED',
      });
    });

    await this.audit.log(userId, 'INSTALLED_PART_REMOVED', 'MachineInstalledPart', id, {
      machineId: part.machineId,
      machineComponentId: part.machineComponentId || null,
      sparePartId: part.sparePartId,
      newStatus: dto.newStatus || 'REMOVED',
      removedCondition: dto.removedCondition || null,
      removedReason: dto.removedReason || null,
      companyId: ctx.companyId,
      branchId: ctx.branchId,
    });

    return updated;
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
        sparePart: { select: { id: true, code: true, name: true, unit: true, defaultExpectedLifeValue: true, defaultExpectedLifeUnit: true, defaultWarningThresholdPercent: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { installedAt: 'desc' },
    });

    const enriched = parts.map((part: any) => ({
      ...part,
      life: buildInstalledPartLifeView(part, part.sparePart),
    }));
    return enriched;
  }

  /**
   * R2-E — paginated, tenant-scoped lookup used by the unified F9 search. A
   * replacement must be selected as the ACTUAL installed physical part, so the
   * caller can restrict the list to one machine and receive the human-readable
   * identity (spare part, condition, quantity, serial/batch) instead of a bare id.
   *
   * Machine access is validated for an explicit machineId, and the whole query
   * stays inside the active company/branch machine scope, so the list can never
   * leak another tenant's installed parts.
   */
  async lookupInstalledParts(query: QueryInstalledPartLookupDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { machine: this.machineScope(ctx) };
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.machineId = query.machineId;
    }
    if (query.machineComponentId) where.machineComponentId = query.machineComponentId;
    if (query.sparePartId) where.sparePartId = query.sparePartId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.AND = [{
        OR: [
          { serialNumber: { contains: query.search } },
          { batchNumber: { contains: query.search } },
          { sparePart: { code: { contains: query.search } } },
          { sparePart: { name: { contains: query.search } } },
        ],
      }];
    }

    const [parts, total] = await Promise.all([
      this.prisma.machineInstalledPart.findMany({
        where,
        skip,
        take: limit,
        orderBy: { installedAt: 'desc' },
        include: {
          machine: { select: { id: true, code: true, name: true } },
          machineComponent: { select: { id: true, code: true, name: true } },
          sparePart: { select: { id: true, code: true, name: true, unit: true, defaultExpectedLifeValue: true, defaultExpectedLifeUnit: true, defaultWarningThresholdPercent: true } },
        },
      }),
      this.prisma.machineInstalledPart.count({ where }),
    ]);

    const data = parts.map((part: any) => ({
      ...part,
      life: buildInstalledPartLifeView(part, part.sparePart),
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getInstalledPartById(id: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(id, ctx);
    const detail = await this.prisma.machineInstalledPart.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true, defaultExpectedLifeValue: true, defaultExpectedLifeUnit: true, defaultWarningThresholdPercent: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
    });
    if (!detail) throw this.notFound('maintenance.installedPartNotFound', 'Installed part not found');

    await this.evaluatePartLife(detail.id, ctx);
    return { ...detail, life: buildInstalledPartLifeView(detail, detail.sparePart) };
  }

  async getInstalledPartsByMachine(machineId: string, ctx: ActiveOperationalContext) {
    await this.machineAccess(machineId, ctx);
    const parts = await this.prisma.machineInstalledPart.findMany({
      where: { machineId },
      include: {
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true, defaultExpectedLifeValue: true, defaultExpectedLifeUnit: true, defaultWarningThresholdPercent: true } },
        maintenanceRequest: { select: { id: true, requestNumber: true, title: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
    const enriched = parts.map((part: any) => ({
      ...part,
      life: buildInstalledPartLifeView(part, part.sparePart),
    }));
    return enriched;
  }

  async getInstalledPartsByRequest(maintenanceRequestId: string, ctx: ActiveOperationalContext) {
    await this.requestAccess(maintenanceRequestId, ctx);
    const parts = await this.prisma.machineInstalledPart.findMany({
      where: { maintenanceRequestId },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        machineComponent: { select: { id: true, code: true, name: true } },
        sparePart: { select: { id: true, code: true, name: true, unit: true, defaultExpectedLifeValue: true, defaultExpectedLifeUnit: true, defaultWarningThresholdPercent: true } },
      },
      orderBy: { installedAt: 'desc' },
    });
    return parts.map((part: any) => ({
      ...part,
      life: buildInstalledPartLifeView(part, part.sparePart),
    }));
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

    const value = dto.expectedLifeValue;
    const unit = dto.expectedLifeUnit;
    if (!(EXPECTED_LIFE_UNITS as readonly string[]).includes(unit)) {
      throw this.badRequest('maintenance.expectedLifeUnitInvalid', 'Expected life unit must be DAYS, HOURS or CYCLES');
    }
    if (value <= 0) {
      throw this.badRequest('maintenance.expectedLifeValueInvalid', 'Expected life value must be greater than zero');
    }

    const warningThresholdPercent = dto.warningThresholdPercent ?? part.warningThresholdPercent ?? DEFAULT_WARNING_THRESHOLD_PERCENT;
    if (warningThresholdPercent < MIN_WARNING_THRESHOLD_PERCENT || warningThresholdPercent > MAX_WARNING_THRESHOLD_PERCENT) {
      throw this.badRequest('maintenance.warningThresholdInvalid', 'Warning threshold must be between 1 and 99 percent');
    }

    const unitChanged = part.expectedLifeUnit !== unit;
    const data: any = {
      expectedLifeValue: value,
      expectedLifeUnit: unit,
      warningThresholdPercent,
      expectedExpiryDate: null,
      expectedExpiryReading: null,
      lastEvaluatedAt: null,
    };

    if (unit === 'DAYS') {
      if (!dto.lifeStartDate) {
        throw this.badRequest('maintenance.lifeStartDateRequired', 'Life start date is required for DAYS-based expected life');
      }
      const start = new Date(dto.lifeStartDate);
      if (!Number.isFinite(start.getTime()) || start.getTime() > Date.now()) {
        throw this.badRequest('maintenance.lifeStartDateInvalid', 'Life start date must be valid and cannot be in the future');
      }
      data.lifeStartDate = start;
      // Unit-change safety: never retain reading-based fields on a DAYS instance.
      data.lifeStartReading = null;
      data.currentReading = null;
    } else {
      if (dto.lifeStartReading === undefined) {
        throw this.badRequest('maintenance.lifeStartReadingRequired', 'Life start reading is required for HOURS/CYCLES-based expected life');
      }
      if (dto.currentReading !== undefined && dto.currentReading < dto.lifeStartReading) {
        throw this.badRequest('maintenance.readingCannotDecrease', 'Current reading cannot be lower than the life start reading');
      }
      data.lifeStartDate = null;
      data.lifeStartReading = dto.lifeStartReading;
      data.currentReading = unitChanged
        ? (dto.currentReading ?? dto.lifeStartReading)
        : (dto.currentReading ?? part.currentReading ?? dto.lifeStartReading);
    }

    const updated = await this.prisma.machineInstalledPart.update({
      where: { id },
      data,
    });

    await this.audit.log(userId, 'EXPECTED_LIFE_CONFIGURED', 'MachineInstalledPart', id, {
      expectedLifeValue: value,
      expectedLifeUnit: unit,
      lifeStartDate: data.lifeStartDate || null,
      lifeStartReading: data.lifeStartReading ?? null,
      currentReading: data.currentReading ?? null,
      warningThresholdPercent,
      previous: {
        expectedLifeValue: part.expectedLifeValue ?? null,
        expectedLifeUnit: part.expectedLifeUnit ?? null,
        warningThresholdPercent: part.warningThresholdPercent ?? null,
      },
      current: {
        expectedLifeValue: value,
        expectedLifeUnit: unit,
        warningThresholdPercent,
      },
      machineId: part.machineId,
      sparePartId: part.sparePartId,
      unitChanged,
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
    if (!part.expectedLifeUnit) {
      throw this.badRequest('maintenance.expectedLifeNotConfigured', 'Configure expected life first before recording readings');
    }
    if (part.expectedLifeUnit === 'DAYS') {
      throw this.badRequest('maintenance.readingNotAllowedForDays', 'DAYS-based life has no meter readings');
    }
    if (part.expectedLifeUnit !== readingType) {
      throw this.badRequest('maintenance.readingTypeMismatch',
        `Reading type must match the configured expected-life unit (${part.expectedLifeUnit})`);
    }
    if (!dto.isReset && part.currentReading !== null && part.currentReading !== undefined && dto.readingValue < part.currentReading) {
      throw this.badRequest('maintenance.readingCannotDecrease', 'A meter reading cannot decrease unless an explicit reset is recorded');
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
      previousReading: part.currentReading ?? null,
      newReading: result.updated.currentReading,
      isReset: dto.isReset || false,
      notes: dto.notes || null,
      machineId: part.machineId,
      sparePartId: part.sparePartId,
      recordedAt: result.reading.recordedAt,
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
