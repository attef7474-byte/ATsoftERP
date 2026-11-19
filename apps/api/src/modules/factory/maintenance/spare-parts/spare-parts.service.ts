import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateSparePartDto, UpdateSparePartDto } from './dto/create-spare-part.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import {
  CANONICAL_VERDICT_EXACT_DUPLICATE,
  CANONICAL_VERDICT_REVIEW_REQUIRED,
  CanonicalIdentityCandidate,
  CanonicalIdentityInput,
  evaluateSparePartCanonicalIdentity,
} from '../../../../common/canonical-identity/canonical-spare-part-identity';
import {
  DEFAULT_WARNING_THRESHOLD_PERCENT,
  EXPECTED_LIFE_UNITS,
  MAX_WARNING_THRESHOLD_PERCENT,
  MIN_WARNING_THRESHOLD_PERCENT,
} from '../expected-life/expected-life.constants';

@Injectable()
export class SparePartsService {
  private static readonly DEFAULT_LIFE_KEYS = [
    'defaultExpectedLifeValue',
    'defaultExpectedLifeUnit',
    'defaultWarningThresholdPercent',
  ] as const;

  constructor(private prisma: PrismaService, private auditService: AuditService, private numberingService: NumberingService) {}

  /**
   * Phase 3 — validate and normalize the catalog standard expected life.
   * NULL life is valid; a configured life must have value > 0, a canonical unit
   * and a warning threshold in 1..99. Cross-field validation lives here because
   * DTO decorators cannot see the other two fields reliably on PATCH.
   */
  private defaultLifeData(dto: CreateSparePartDto | UpdateSparePartDto, existing?: any) {
    const input = dto as any;
    const touched = SparePartsService.DEFAULT_LIFE_KEYS.some((key) => key in input);
    if (!touched) return {};

    const pick = (key: (typeof SparePartsService.DEFAULT_LIFE_KEYS)[number]) =>
      key in input ? input[key] : existing ? existing[key] ?? null : null;

    const value = pick('defaultExpectedLifeValue');
    const unit = pick('defaultExpectedLifeUnit');
    const warning = pick('defaultWarningThresholdPercent');

    const cleared = SparePartsService.DEFAULT_LIFE_KEYS.every((key) => key in input && input[key] === null);
    if (cleared || (value === null && unit === null && warning === null)) {
      return {
        defaultExpectedLifeValue: null,
        defaultExpectedLifeUnit: null,
        defaultWarningThresholdPercent: null,
      };
    }

    if (value === null || value === undefined) {
      throw new BadRequestException({
        messageKey: 'spareParts.defaultLifeValueRequired',
        message: 'A positive expected-life value is required when standard life is configured',
      });
    }
    if (!unit) {
      throw new BadRequestException({
        messageKey: 'spareParts.defaultLifeUnitRequired',
        message: 'An expected-life unit is required when standard life is configured',
      });
    }
    if (!(EXPECTED_LIFE_UNITS as readonly string[]).includes(unit)) {
      throw new BadRequestException({
        messageKey: 'spareParts.defaultLifeUnitInvalid',
        message: 'Expected-life unit must be DAYS, HOURS or CYCLES',
      });
    }
    if (value <= 0) {
      throw new BadRequestException({
        messageKey: 'spareParts.defaultLifeValueInvalid',
        message: 'Expected-life value must be greater than zero',
      });
    }
    const resolvedWarning = warning === null || warning === undefined ? DEFAULT_WARNING_THRESHOLD_PERCENT : warning;
    if (resolvedWarning < MIN_WARNING_THRESHOLD_PERCENT || resolvedWarning > MAX_WARNING_THRESHOLD_PERCENT) {
      throw new BadRequestException({
        messageKey: 'spareParts.defaultWarningThresholdInvalid',
        message: 'Warning threshold must be between 1 and 99 percent',
      });
    }

    return {
      defaultExpectedLifeValue: value,
      defaultExpectedLifeUnit: unit,
      defaultWarningThresholdPercent: resolvedWarning,
    };
  }

  private defaultLifeSnapshot(row: any) {
    return {
      value: row?.defaultExpectedLifeValue ?? null,
      unit: row?.defaultExpectedLifeUnit ?? null,
      warningThresholdPercent: row?.defaultWarningThresholdPercent ?? null,
    };
  }

  async create(dto: CreateSparePartDto, userId: string) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('SPARE_PART');
    const existing = await this.prisma.sparePart.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Spare part code already exists');

    return this.prisma.$transaction(async (tx) => {
      return this.createInTx(tx, { ...dto, code }, userId);
    });
  }

  async validateMasterInTx(tx: any, dto: CreateSparePartDto | UpdateSparePartDto, existing?: any) {
    if (!existing || 'productId' in dto) await this.assertProductLinkIsUsable(tx, dto.productId, existing?.id);
    if (!existing || 'unitId' in dto) await this.assertUnitIsUsable(tx, dto.unitId);
    const merged = existing ? {
      manufacturer: dto.manufacturer ?? existing.manufacturer, partNumber: dto.partNumber ?? existing.partNumber,
      productId: 'productId' in dto ? dto.productId : existing.productId, model: dto.model ?? existing.model, specification: dto.specification ?? existing.specification,
    } : dto;
    await this.assertNoCanonicalDuplicate(tx, merged, existing?.code || dto.code || '', existing?.id);
  }

  async createInTx(tx: any, dto: CreateSparePartDto, userId: string) {
    const defaultLife = this.defaultLifeData(dto);
    const data = { ...dto, ...defaultLife };
    await this.validateMasterInTx(tx, data);
    const part = await tx.sparePart.create({ data });
    await this.auditService.logWithClient(tx, {
      userId,
      action: 'CREATE',
      entity: 'SparePart',
      entityId: part.id,
      details: {
        message: `Created spare part: ${part.code}`,
        code: part.code,
        ...(Object.keys(defaultLife).length > 0 ? { defaultLife: this.defaultLifeSnapshot(part) } : {}),
      },
    });
    return part;
  }

  async updateInTx(tx: any, id: string, dto: UpdateSparePartDto, existing: any, userId: string) {
    if (dto.code && dto.code !== existing.code) throw new BadRequestException('Code cannot be changed after creation');
    const { code, ...rest } = dto;
    const defaultLife = this.defaultLifeData(dto, existing);
    const data = { ...rest, ...defaultLife };
    await this.validateMasterInTx(tx, data, existing);
    const part = await tx.sparePart.update({ where: { id }, data });
    const previousDefaultLife = this.defaultLifeSnapshot(existing);
    const currentDefaultLife = this.defaultLifeSnapshot(part);
    const defaultLifeChanged = JSON.stringify(previousDefaultLife) !== JSON.stringify(currentDefaultLife);
    await this.auditService.logWithClient(tx, {
      userId,
      action: 'UPDATE',
      entity: 'SparePart',
      entityId: id,
      details: {
        message: `Updated spare part: ${part.code}`,
        code: part.code,
        ...(defaultLifeChanged ? { defaultLife: { previous: previousDefaultLife, current: currentDefaultLife } } : {}),
      },
    });
    return part;
  }

  /**
   * R4P TASK 17: a spare part may only be attached to a Product that exists, is
   * ACTIVE and is not soft-deleted.
   *
   * Previously `productId` was written straight from the DTO, so a client could
   * point a canonical catalog item at a missing or deleted inventory record and
   * leave the SparePart -> Product -> Stock chain permanently unresolvable.
   *
   * `excludeSparePartId` is used on update so that re-saving a spare part without
   * changing its product does not collide with itself.
   */
  private async assertProductLinkIsUsable(tx: any, productId: string | null | undefined, excludeSparePartId: string | undefined) {
    if (!productId) return;
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true, code: true, status: true, itemType: true },
    });
    if (!product) throw new BadRequestException('Linked product was not found or is deleted');
    if (product.status !== 'ACTIVE') throw new BadRequestException('Linked product is not ACTIVE');
    // Phase 1: the only authoritative stock identity a SparePart may point at is
    // a Product classified SPARE_PART. Never silently link a finished good or a
    // raw material into the maintenance technical catalog.
    if (product.itemType !== 'SPARE_PART') {
      throw new BadRequestException({
        messageKey: 'spareParts.productItemTypeConflict',
        message: 'The linked item must be classified as SPARE_PART',
      });
    }

    // One Product may back more than one SparePart only when those spare parts are
    // themselves distinguished by technical identity. When the caller supplies no
    // technical identity at all, linking to a Product that already backs another
    // spare part would create two indistinguishable inventory representations.
    const siblings = await tx.sparePart.count({
      where: { productId, deletedAt: null, ...(excludeSparePartId ? { id: { not: excludeSparePartId } } : {}) },
    });
    if (siblings > 0) {
      throw new ConflictException(
        `Product ${product.code} already represents another active spare part. Reuse that canonical spare part instead of creating a second one for the same inventory item.`,
      );
    }
  }

  /**
   * R4P TASK 4: canonical duplicate prevention.
   *
   * Rejects a create that would introduce a second canonical row for a technically
   * identical part. The candidate set is limited to live rows and to the technical
   * identity fields, so quantity, stock policy and naming cannot influence the
   * verdict. See canonical-spare-part-identity.ts for the ladder and for the fields
   * that are deliberately excluded as evidence.
   */
  private async assertNoCanonicalDuplicate(tx: any, dto: CanonicalIdentityInput, code: string, excludeSparePartId?: string) {
    const candidates = (await tx.sparePart.findMany({
      where: {
        deletedAt: null,
        ...(excludeSparePartId ? { id: { not: excludeSparePartId } } : {}),
        OR: [
          ...(dto.partNumber ? [{ partNumber: dto.partNumber }] : []),
          ...(dto.productId ? [{ productId: dto.productId }] : []),
          ...(dto.specification ? [{ specification: dto.specification }] : []),
          ...(dto.manufacturer ? [{ manufacturer: dto.manufacturer }] : []),
          ...(dto.model ? [{ model: dto.model }] : []),
        ],
      },
      select: { id: true, code: true, name: true, manufacturer: true, partNumber: true, productId: true, model: true, specification: true },
    })) as CanonicalIdentityCandidate[];

    const decision = evaluateSparePartCanonicalIdentity(dto, candidates);

    if (decision.verdict === CANONICAL_VERDICT_EXACT_DUPLICATE) {
      const match = decision.matches[0];
      throw new ConflictException({
        message: decision.reason,
        error: 'CANONICAL_SPAREPART_EXISTS',
        existingSparePartId: match.id,
        existingSparePartCode: match.code,
        identityBasis: decision.basisLabel,
      });
    }

    if (decision.verdict === CANONICAL_VERDICT_REVIEW_REQUIRED) {
      throw new ConflictException({
        message: decision.reason,
        error: 'CANONICAL_SPAREPART_REVIEW_REQUIRED',
        candidates: decision.matches.map((m) => ({ id: m.id, code: m.code })),
        identityBasis: decision.basisLabel,
      });
    }
  }

  async findAll(query: { page?: number; limit?: number; search?: string; code?: string; name?: string; category?: string; partNumber?: string; barcode?: string; isCritical?: string; status?: string; technicalClassification?: string; usageType?: string; nature?: string; importance?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (query.search) { where.OR = [{ name: { contains: query.search } }, { code: { contains: query.search } }, { partNumber: { contains: query.search } }]; }
    if (query.code) where.code = { contains: query.code };
    if (query.name) where.name = { contains: query.name };
    if (query.category) where.category = query.category;
    if (query.partNumber) where.partNumber = { contains: query.partNumber };
    if (query.barcode) where.barcode = { contains: query.barcode };
    if (query.isCritical) where.isCritical = query.isCritical === 'true';
    if (query.status) where.status = query.status;
    if (query.technicalClassification) where.technicalClassification = query.technicalClassification;
    if (query.usageType) where.usageType = query.usageType;
    if (query.nature) where.nature = query.nature;
    if (query.importance) where.importance = query.importance;
    const [data, total] = await Promise.all([
      this.prisma.sparePart.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, code: true, unit: true } },
          unitRef: { select: { id: true, code: true, nameAr: true, nameEn: true, symbol: true } },
          _count: { select: { machineLinks: true } },
        },
      }),
      this.prisma.sparePart.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const part = await this.prisma.sparePart.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, code: true, unit: true } },
        unitRef: { select: { id: true, code: true, nameAr: true, nameEn: true, symbol: true } },
        componentLinks: { include: { component: { select: { id: true, name: true, code: true } } } },
        machineLinks: { where: { status: 'ACTIVE' }, include: { machine: { select: { id: true, name: true, code: true } } } },
        _count: { select: { machineLinks: true } },
      },
    });
    if (!part) throw new NotFoundException('Spare part not found');
    return part;
  }

  async update(id: string, dto: UpdateSparePartDto, userId: string) {
    const existing = await this.findOne(id);
    if (dto.code && dto.code !== existing.code) {
      throw new BadRequestException('Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;

    return this.prisma.$transaction((tx) => this.updateInTx(tx, id, updateDto, existing, userId));
  }

  async activate(id: string, userId: string) {
    await this.findOne(id);
    const part = await this.prisma.sparePart.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', 'SparePart', id);
    return part;
  }

  async deactivate(id: string, userId: string) {
    await this.findOne(id);
    const part = await this.prisma.sparePart.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', 'SparePart', id);
    return part;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    const machineLinkCount = await this.prisma.machineSparePart.count({ where: { sparePartId: id } });
    if (machineLinkCount > 0) throw new ConflictException('Cannot delete spare part linked to machines');
    const componentLinkCount = await this.prisma.componentSparePart.count({ where: { sparePartId: id } });
    if (componentLinkCount > 0) throw new ConflictException('Cannot delete spare part linked to components');
    const reqPartCount = await this.prisma.maintenanceRequestRequiredPart.count({ where: { sparePartId: id } });
    if (reqPartCount > 0) throw new ConflictException('Cannot delete spare part with linked request parts');

    // R4P TASK 19: installation and replacement history is permanent business
    // evidence. Soft-deleting a catalog row that is still physically fitted to a
    // machine, or that participated in a replacement, would erase the meaning of
    // that history, so those references block deletion. Deactivation remains the
    // correct way to retire an item that is still fitted.
    const installedCount = await this.prisma.machineInstalledPart.count({ where: { sparePartId: id } });
    if (installedCount > 0) throw new ConflictException('Cannot delete spare part with installation history');
    const replacementCount = await this.prisma.sparePartReplacementHistory.count({
      where: { OR: [{ oldSparePartId: id }, { newSparePartId: id }] },
    });
    if (replacementCount > 0) throw new ConflictException('Cannot delete spare part with replacement history');

    // R4P TASK 6: a spare part that backs a Product holding stock cannot be
    // removed, because the inventory record would be left pointing at a catalog
    // row that no longer participates in selection.
    const part = await this.prisma.sparePart.findUnique({ where: { id }, select: { productId: true } });
    if (part?.productId) {
      const balanceCount = await this.prisma.inventoryBalance.count({ where: { productId: part.productId } });
      if (balanceCount > 0) throw new ConflictException('Cannot delete spare part whose linked product holds warehouse stock');
    }

    await this.prisma.sparePart.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', 'SparePart', id, { message: `Deleted spare part: ${id}` });
    return { message: 'Spare part deleted successfully' };
  }

  /**
   * The canonical unit of a spare part, when provided, must reference an existing,
   * active Unit master row. Free text is never accepted as the canonical unit.
   */
  private async assertUnitIsUsable(tx: any, unitId: string | null | undefined) {
    if (!unitId) return;
    const unit = await tx.unit.findFirst({ where: { id: unitId }, select: { id: true, isActive: true } });
    if (!unit) throw new BadRequestException('Linked unit was not found');
    if (!unit.isActive) throw new BadRequestException('Linked unit is not active');
  }

  private machineScope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] };
  }

  /** Linked machines (active applicability) for a spare part. */
  async getMachineLinks(sparePartId: string, ctx: ActiveOperationalContext) {
    await this.findOne(sparePartId);
    const links = await this.prisma.machineSparePart.findMany({
      where: { sparePartId, status: 'ACTIVE', machine: this.machineScope(ctx) },
      orderBy: { createdAt: 'asc' },
      include: { machine: { select: { id: true, name: true, code: true } } },
    });
    return links.map((l) => ({ id: l.id, machineId: l.machineId, machine: l.machine, quantity: l.quantity, isPrimary: l.isPrimary, usageNote: l.usageNote }));
  }

  /**
   * UNIFIED MULTI-MACHINE APPLICABILITY (batch).
   *
   * Replaces the entire active machine-applicability set of one spare part in a
   * single atomic operation: machines in `machineIds` are added (or reactivated),
   * machines no longer present are deactivated. Rows are never deleted, so
   * applicability history is preserved. Every machine id is validated against the
   * caller's operational context; an invalid or foreign id rejects the whole
   * transaction. Duplicate pairs are impossible (unique machineId+sparePartId).
   */
  async setMachineLinks(sparePartId: string, machineIds: string[], userId: string, ctx: ActiveOperationalContext) {
    const uniqueIds = Array.from(new Set((machineIds || []).filter((m) => typeof m === 'string' && m.trim().length > 0)));

    return this.prisma.$transaction(async (tx) => {
      const sparePart = await tx.sparePart.findFirst({ where: { id: sparePartId, deletedAt: null }, select: { id: true, code: true, unit: true, unitId: true } });
      if (!sparePart) throw new NotFoundException('Spare part not found');

      if (uniqueIds.length > 0) {
        const machines = await tx.machine.findMany({ where: { id: { in: uniqueIds }, ...this.machineScope(ctx) }, select: { id: true } });
        if (machines.length !== uniqueIds.length) {
          throw new BadRequestException('One or more machines were not found or are outside the active context');
        }
      }

      const existing = await tx.machineSparePart.findMany({ where: { sparePartId }, select: { id: true, machineId: true, status: true } });
      const existingByMachine = new Map(existing.map((e) => [e.machineId, e]));
      const wanted = new Set(uniqueIds);

      let added = 0;
      let reactivated = 0;
      let deactivated = 0;

      const unitCode = sparePart.unitId ? (await tx.unit.findUnique({ where: { id: sparePart.unitId }, select: { code: true } }))?.code : undefined;
      const legacyUnit = unitCode ?? sparePart.unit ?? undefined;

      for (const machineId of uniqueIds) {
        const current = existingByMachine.get(machineId);
        if (!current) {
          await tx.machineSparePart.create({ data: { machineId, sparePartId, quantity: 1, unit: legacyUnit } });
          added += 1;
        } else if (current.status !== 'ACTIVE') {
          await tx.machineSparePart.update({ where: { id: current.id }, data: { status: 'ACTIVE' } });
          reactivated += 1;
        }
      }

      for (const row of existing) {
        if (!wanted.has(row.machineId) && row.status === 'ACTIVE') {
          await tx.machineSparePart.update({ where: { id: row.id }, data: { status: 'INACTIVE' } });
          deactivated += 1;
        }
      }

      await this.auditService.logWithClient(tx, {
        userId,
        action: 'SET_MACHINE_APPLICABILITY',
        entity: 'SparePart',
        entityId: sparePartId,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, added, reactivated, deactivated, machineIds: uniqueIds },
      });

      const links = await tx.machineSparePart.findMany({
        where: { sparePartId, status: 'ACTIVE', machine: this.machineScope(ctx) },
        orderBy: { createdAt: 'asc' },
        include: { machine: { select: { id: true, name: true, code: true } } },
      });
      return { added, reactivated, deactivated, linkedMachines: links.length, machines: links.map((l) => ({ id: l.id, machineId: l.machineId, machine: l.machine })) };
    });
  }
}
