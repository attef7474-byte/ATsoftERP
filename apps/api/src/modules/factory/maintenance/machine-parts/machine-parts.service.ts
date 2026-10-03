import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { CreateMachinePartDto } from './dto/create-machine-part.dto';
import { UpdateMachinePartDto } from './dto/update-machine-part.dto';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { AllowedContextResolver } from '../../../../common/operational-context/allowed-context.resolver';

@Injectable()
export class MachinePartsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
    private allowedContextResolver: AllowedContextResolver,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
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

  /**
   * R4O tenant-ownership test for the additive machine_parts ownership columns.
   *
   * A NULL companyId means ownership is UNPROVEN. An unproven owner is never
   * treated as "belongs to everybody": that reading is exactly the cross-tenant
   * leak this predicate exists to close. Such rows are quarantined for
   * SUPER_ADMIN only (see {@link isSuperAdmin}).
   *
   * Branch handling mirrors {@link machineOwns}: a row owned at company level
   * (branchId NULL) is visible from every branch of that company, a row owned at
   * branch level only from its own branch.
   */
  private ownershipMatches(
    companyId: string | null | undefined,
    branchId: string | null | undefined,
    ctx: ActiveOperationalContext,
  ): boolean {
    if (companyId == null) return false;
    if (companyId !== ctx.companyId) return false;
    return branchId === null || branchId === ctx.branchId;
  }

  /** R4O: tenant authority is re-resolved from the database, never trusted from the request context. */
  private async isSuperAdmin(userId: string): Promise<boolean> {
    const authorization = await this.allowedContextResolver.getAuthorization(userId);
    return authorization.isSuperAdmin;
  }

  /**
   * R4O. A machine part is reachable by a tenant only when ownership is PROVEN.
   * Precedence: the bound Machine (a foreign-key-backed fact) first, then the
   * additive companyId/branchId columns, and finally an explicit SUPER_ADMIN
   * quarantine for rows whose ownership no evidence can prove.
   */
  private async partAccess(id: string, ctx: ActiveOperationalContext, userId: string) {
    const part = await this.prisma.machinePart.findUnique({
      where: { id },
      include: { machine: { select: { id: true, companyId: true, branchId: true } } },
    });
    if (!part) throw this.notFound('maintenance.machinePartNotFound', 'Machine part not found');
    if (part.machineId) {
      if (!part.machine || !this.machineOwns(part.machine, ctx)) {
        throw this.notFound('maintenance.machinePartNotFound', 'Machine part not found');
      }
      return part;
    }
    if (this.ownershipMatches(part.companyId, part.branchId, ctx)) return part;
    if (part.companyId == null && await this.isSuperAdmin(userId)) return part;
    throw this.notFound('maintenance.machinePartNotFound', 'Machine part not found');
  }

  /**
   * R4N duplicate-prevention, part 1.
   *
   * A Machine part-list entry must not be created twice for the same machine
   * and the same normalized part name. The live baseline contains 64 such
   * duplicate groups; new writes must not extend that redundancy.
   */
  private async assertNoDuplicateMachinePartEntry(
    machineId: string | null | undefined,
    name: string,
    excludeId?: string,
  ) {
    if (!machineId) return;
    const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!normalized) return;
    const candidates = await this.prisma.machinePart.findMany({
      where: { machineId, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, code: true, name: true },
    });
    const clash = candidates.find((c) => c.name.trim().replace(/\s+/g, ' ').toLowerCase() === normalized);
    if (clash) {
      throw this.validationError(
        'name',
        'validation.duplicateValue',
        `A machine part named "${clash.name}" (${clash.code}) already exists for this machine`,
      );
    }
  }

  /**
   * R4N duplicate-prevention, part 2.
   *
   * A canonical item must not be represented twice for the same machine: once
   * as a MachineSparePart applicability link and once as a MachinePart
   * part-list entry. machine_spare_parts is already unique on
   * (machineId, sparePartId); this rejects the cross-table representation
   * clash that no database constraint can express.
   */
  private async assertNoDuplicateApplicability(
    machineId: string | null | undefined,
    sparePartId: string | null | undefined,
    excludeId?: string,
  ) {
    if (!machineId || !sparePartId) return;
    const existingLink = await this.prisma.machineSparePart.findFirst({
      where: { machineId, sparePartId, status: 'ACTIVE' },
      select: { id: true },
    });
    const existingEntry = await this.prisma.machinePart.findFirst({
      where: {
        machineId,
        sparePartId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, code: true },
    });
    if (existingLink && existingEntry) {
      throw this.validationError(
        'sparePartId',
        'validation.duplicateValue',
        `This canonical part is already applicable to this machine and is already represented by machine part ${existingEntry.code}`,
      );
    }
  }

  /** Resolves and validates a canonical SparePart reference. */
  private async canonicalPartAccess(sparePartId: string) {
    const sparePart = await this.prisma.sparePart.findUnique({
      where: { id: sparePartId },
      select: { id: true, code: true, name: true, status: true, deletedAt: true },
    });
    if (!sparePart || sparePart.deletedAt !== null) {
      throw this.validationError('sparePartId', 'validation.invalidReference', 'Canonical spare part not found');
    }
    if (sparePart.status !== 'ACTIVE') {
      throw this.validationError('sparePartId', 'validation.invalidValue', 'Canonical spare part is not active');
    }
    return sparePart;
  }

  /**
   * R4O: derives the owning tenant of a machine part.
   *
   * A bound part inherits its Machine's tenant, because a bound part-list entry
   * cannot belong to a tenant other than the machine it is attached to. An
   * unbound part inherits the authenticated operational context. Neither value is
   * ever taken from the request body: CreateMachinePartDto deliberately declares
   * no companyId/branchId, and the global ValidationPipe runs with
   * forbidNonWhitelisted, so a client-supplied ownership field is rejected
   * outright rather than silently dropped.
   */
  private async resolveOwner(dto: { machineId?: string | null }, ctx: ActiveOperationalContext) {
    if (!dto.machineId) {
      return { companyId: ctx.companyId, branchId: ctx.branchId ?? null };
    }
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine || !this.machineOwns(machine, ctx)) {
      throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
    }
    return { companyId: machine.companyId, branchId: machine.branchId ?? null };
  }

  async create(dto: CreateMachinePartDto, userId: string, ctx: ActiveOperationalContext) {
    const code = dto.code?.trim() || await this.numberingService.generateNumberAtomic('MACHINE_PART');
    const existing = await this.prisma.machinePart.findUnique({ where: { code } });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Machine part code already exists');

    const owner = await this.resolveOwner(dto, ctx);

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
    }

    if (dto.sparePartId) {
      await this.canonicalPartAccess(dto.sparePartId);
      await this.assertNoDuplicateApplicability(dto.machineId, dto.sparePartId);
    }
    await this.assertNoDuplicateMachinePartEntry(dto.machineId, dto.name);

    const part = await this.prisma.machinePart.create({
      data: { ...dto, code, companyId: owner.companyId, branchId: owner.branchId },
    });
    await this.auditService.log(userId, 'CREATE', 'MachinePart', part.id, {
      message: `Created machine part: ${part.code}`,
      new: { companyId: owner.companyId, branchId: owner.branchId, ownershipSource: dto.machineId ? 'MACHINE' : 'CONTEXT' },
    });
    return part;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; machineId?: string }, ctx: ActiveOperationalContext, userId: string) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const scopedMachineIds = await this.prisma.machine.findMany({
      where: this.machineScope(ctx),
      select: { id: true },
    });

    // R4O. The previous predicate matched { machineId: null } for every tenant,
    // so all 167 unowned rows were readable by every company. Ownership is now
    // an explicit disjunct, and rows with no proven owner are surfaced only to a
    // re-resolved SUPER_ADMIN who can reconcile them.
    const visible: any[] = [
      { machineId: { in: scopedMachineIds.map((m) => m.id) } },
      {
        machineId: null,
        companyId: ctx.companyId,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
    ];
    if (await this.isSuperAdmin(userId)) {
      visible.push({ machineId: null, companyId: null });
    }

    const where: any = { OR: visible };
    if (query.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.search } },
            { code: { contains: query.search } },
            { partNumber: { contains: query.search } },
          ],
        },
      ];
    }
    if (query.machineId) {
      await this.machineAccess(query.machineId, ctx);
      where.AND = [...(where.AND || []), { machineId: query.machineId }];
    }

    const [data, total] = await Promise.all([
      this.prisma.machinePart.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          machine: { select: { id: true, name: true, code: true } },
          product: { select: { id: true, name: true, code: true } },
          sparePart: { select: { id: true, code: true, name: true, partNumber: true, manufacturer: true, specification: true, unit: true } },
        },
      }),
      this.prisma.machinePart.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext, userId: string) {
    await this.partAccess(id, ctx, userId);
    const part = await this.prisma.machinePart.findUnique({
      where: { id },
      include: {
        machine: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, name: true, code: true } },
        sparePart: { select: { id: true, code: true, name: true, partNumber: true, manufacturer: true, specification: true, unit: true, category: true } },
      },
    });
    if (!part) throw this.notFound('maintenance.machinePartNotFound', 'Machine part not found');
    return part;
  }

  async update(id: string, dto: UpdateMachinePartDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.partAccess(id, ctx, userId);
    if (dto.code && dto.code !== existing.code) {
      throw this.validationError('code', 'validation.invalidValue', 'Code cannot be changed after creation');
    }
    const { code, ...updateDto } = dto;

    const effectiveMachineId = updateDto.machineId !== undefined ? updateDto.machineId : existing.machineId;
    const effectiveSparePartId = updateDto.sparePartId !== undefined ? updateDto.sparePartId : existing.sparePartId;
    const effectiveName = updateDto.name !== undefined ? updateDto.name : existing.name;

    let ownership: { companyId: string | null; branchId: string | null } | null = null;
    if (updateDto.machineId) {
      await this.machineAccess(updateDto.machineId, ctx);
      // R4O: reassignment re-derives ownership from the new authorized machine so
      // a row can never keep pointing at the previous tenant's ownership.
      const machine = await this.prisma.machine.findUnique({ where: { id: updateDto.machineId } });
      if (!machine || machine.companyId == null) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      }
      ownership = { companyId: machine.companyId, branchId: machine.branchId ?? null };
    }

    if (updateDto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: updateDto.productId } });
      if (!product) throw this.validationError('productId', 'validation.invalidReference', 'Product not found');
    }

    if (updateDto.sparePartId) {
      await this.canonicalPartAccess(updateDto.sparePartId);
    }
    // Only enforce the duplicate guards when the relevant input actually changed,
    // so a no-op update of an untouched legacy record is never rejected.
    if (updateDto.sparePartId !== undefined || updateDto.machineId !== undefined) {
      await this.assertNoDuplicateApplicability(effectiveMachineId, effectiveSparePartId, id);
    }
    if (updateDto.name !== undefined || updateDto.machineId !== undefined) {
      await this.assertNoDuplicateMachinePartEntry(effectiveMachineId, effectiveName, id);
    }

    const part = await this.prisma.machinePart.update({
      where: { id },
      data: ownership ? { ...updateDto, ...ownership } : updateDto,
    });
    await this.auditService.log(userId, 'UPDATE', 'MachinePart', id, {
      message: `Updated machine part: ${part.code}`,
      previous: { name: existing.name, machineId: existing.machineId, sparePartId: existing.sparePartId, companyId: existing.companyId, branchId: existing.branchId },
      new: { name: part.name, machineId: part.machineId, sparePartId: part.sparePartId, companyId: part.companyId, branchId: part.branchId },
    });
    return part;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.partAccess(id, ctx, userId);
    const usageCount = await this.prisma.maintenanceRequestPartUsage.count({ where: { productId: existing.productId || '' } });
    if (usageCount > 0) throw new ConflictException('Cannot delete machine part with linked usage records');
    await this.prisma.machinePart.delete({ where: { id } });
    await this.auditService.log(userId, 'DELETE', 'MachinePart', id, { message: `Deleted machine part: ${id}` });
    return { message: 'Machine part deleted successfully' };
  }

  async getPartMachines(id: string, ctx: ActiveOperationalContext, userId: string) {
    const part = await this.partAccess(id, ctx, userId);
    if (part.machineId) {
      await this.machineAccess(part.machineId, ctx);
      const machine = await this.prisma.machine.findUnique({
        where: { id: part.machineId },
        select: { id: true, code: true, name: true, status: true, model: true, manufacturer: true },
      });
      return machine ? [machine] : [];
    }
    return [];
  }

  async linkToMachine(partId: string, machineId: string, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(partId, ctx, userId);
    const machine = await this.machineAccess(machineId, ctx);
    // R4O: linking is an authorized act performed by a tenant, and the target
    // machine is inside that tenant, so ownership is re-derived from the machine
    // rather than accepted from the request.
    const updated = await this.prisma.machinePart.update({
      where: { id: partId },
      data: { machineId, companyId: machine.companyId, branchId: machine.branchId ?? null },
    });
    await this.auditService.log(userId, 'LINK', 'MachinePart', partId, {
      message: `Linked part ${updated.code} to machine ${machine.code}`,
      previous: { machineId: part.machineId, companyId: part.companyId, branchId: part.branchId },
      new: { machineId, companyId: machine.companyId, branchId: machine.branchId ?? null },
    });
    return updated;
  }

  async unlinkFromMachine(partId: string, machineId: string, userId: string, ctx: ActiveOperationalContext) {
    const part = await this.partAccess(partId, ctx, userId);
    await this.machineAccess(machineId, ctx);
    if (part.machineId !== machineId) throw this.notFound('maintenance.machinePartNotLinked', 'Part is not linked to this machine');
    // R4O: after an unlink the row is machine-free again, so its owner is no
    // longer provable from the machine. Ownership is cleared rather than kept, so
    // the row returns to the explicit UNPROVEN quarantine instead of silently
    // retaining the previous tenant's claim.
    const updated = await this.prisma.machinePart.update({
      where: { id: partId },
      data: { machineId: null, companyId: null, branchId: null },
    });
    await this.auditService.log(userId, 'UNLINK', 'MachinePart', partId, {
      message: `Unlinked part ${updated.code} from machine`,
      previous: { machineId: part.machineId, companyId: part.companyId, branchId: part.branchId },
      new: { machineId: null, companyId: null, branchId: null },
    });
    return updated;
  }

  async getUsageHistory(id: string, ctx: ActiveOperationalContext, userId: string) {
    const part = await this.partAccess(id, ctx, userId);
    if (!part.productId) return [];
    return this.prisma.maintenanceRequestPartUsage.findMany({
      where: { productId: part.productId },
      include: {
        request: { select: { id: true, requestNumber: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
