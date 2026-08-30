import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { CreateOperationalCostCenterAssignmentDto } from './dto/create-operational-cost-center-assignment.dto';
import { UpdateOperationalCostCenterAssignmentDto } from './dto/update-operational-cost-center-assignment.dto';
import { OperationalCostCenterAssignmentQueryDto } from './dto/operational-cost-center-assignment-query.dto';
import { TransitionOperationalCostCenterAssignmentDto } from './dto/transition-operational-cost-center-assignment.dto';
import { ResolveCostCenterDto } from './dto/resolve-cost-center.dto';
import { OperationalCostCenterResolver } from './operational-cost-center-resolver.service';
import { COST_CENTER_AUDIT_ENTITY, OPERATIONAL_COST_CENTER_ASSIGNMENT_AUDIT_ENTITY } from './cost-centers.constants';

@Injectable()
export class CostCentersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private numberingService: NumberingService,
    private resolver: OperationalCostCenterResolver,
  ) {}

  private validationError(field: string, code: string, message: string): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'Validation failed',
      errors: [{ field, code, message }],
    });
  }

  private badRequest(key: string, message: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message });
  }

  private conflict(key: string, message: string): ConflictException {
    return new ConflictException({ messageKey: key, message });
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private forbidden(key: string, message: string): ForbiddenException {
    return new ForbiddenException({ messageKey: key, message });
  }

  private costCenterIncludes() {
    return {
      parent: { select: { id: true, code: true, name: true } },
      children: { select: { id: true, code: true, name: true, status: true } },
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
      administration: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true, code: true } },
    };
  }

  private async findOwnedCostCenter(id: string, ctx: ActiveOperationalContext) {
    const item = await this.prisma.costCenter.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
        deletedAt: null,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
    });
    if (!item) throw this.notFound('maintenance.costCenterNotFound', 'Cost center not found');
    return item;
  }

  private async findOwnedAssignment(id: string, ctx: ActiveOperationalContext) {
    const item = await this.prisma.operationalCostCenterAssignment.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
        deletedAt: null,
        OR: [{ branchId: ctx.branchId }, { branchId: null }],
      },
    });
    if (!item) throw this.notFound('costCenter.assignNotFound', 'Operational cost center assignment not found');
    return item;
  }

  /**
   * Normalizes an optional date value to its business calendar-day UTC key.
   *
   * Date-only PATCH values like "2026-08-30" and the stored midnight UTC value
   * "2026-08-30T00:00:00.000Z" represent the SAME cost center business date and
   * must not be treated as a change by raw string comparison. Compare business
   * dates at their UTC calendar day, never by the raw ISO representation.
   */
  private effectiveDayKey(value?: string | Date | null): string | null {
    if (value === undefined || value === null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private parseDates(effectiveFrom: string | undefined, effectiveTo?: string | null): { effectiveFrom?: Date; effectiveTo?: Date | null } {
    if (!effectiveFrom && effectiveTo === undefined) return {};
    const from = effectiveFrom ? new Date(effectiveFrom) : new Date();
    if (effectiveFrom && isNaN(from.getTime())) {
      throw this.validationError('effectiveFrom', 'validation.invalidDate', 'effectiveFrom is not a valid date');
    }
    let to: Date | null = null;
    if (effectiveTo !== undefined && effectiveTo !== null && effectiveTo !== '') {
      to = new Date(effectiveTo);
      if (isNaN(to.getTime())) {
        throw this.validationError('effectiveTo', 'validation.invalidDate', 'effectiveTo is not a valid date');
      }
      if (effectiveFrom && to.getTime() < from.getTime()) {
        throw this.validationError('effectiveTo', 'costCenter.overlay.invalidRange', 'effectiveTo must not be before effectiveFrom');
      }
    } else if (effectiveTo === null && effectiveFrom) {
      to = null;
    }
    return { effectiveFrom: effectiveFrom ? from : undefined, effectiveTo: effectiveTo === undefined ? undefined : to };
  }

  /**
   * Tenant scope derivation (§6): companyId/branchId always come from the active
   * context; client-supplied tenant ids are never trusted — a mismatch is a 403,
   * an explicit null branchId is a company-level record (D2/D5).
   */
  private deriveScope(dto: { companyId?: string | null; branchId?: string | null }, ctx: ActiveOperationalContext) {
    if (dto.companyId && dto.companyId !== ctx.companyId) {
      throw this.forbidden('operationalContext.companyMismatch', 'Company does not match the active context');
    }
    if (dto.branchId && dto.branchId !== ctx.branchId) {
      throw this.forbidden('operationalContext.branchMismatch', 'Branch does not match the active context');
    }
    return { companyId: ctx.companyId, branchId: dto.branchId === null ? null : dto.branchId ?? ctx.branchId };
  }

  /**
   * Hierarchy validation (D5): company-level parent -> branch-level child allowed
   * (child branch belongs to the parent company); branch-level parent ->
   * company-level child rejected; cross-company parent rejected; cycles and
   * self-parent rejected; parent must be ACTIVE.
   */
  private async validateParent(dto: { parentId?: string; branchId?: string | null }, ctx: ActiveOperationalContext, selfId?: string, client: any = this.prisma) {
    if (!dto.parentId) return;
    if (dto.parentId === selfId) {
      throw this.badRequest('costCenter.hierarchy.selfParent', 'A cost center cannot be its own parent');
    }
    const parent = await client.costCenter.findFirst({
      where: { id: dto.parentId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true, status: true, branchId: true, parentId: true, companyId: true },
    });
    if (!parent) throw this.badRequest('costCenter.hierarchy.parentNotFound', 'Parent cost center not found in tenant context');
    if (parent.companyId !== ctx.companyId) {
      throw this.badRequest('costCenter.hierarchy.crossCompany', 'Parent cost center belongs to another company');
    }
    if (parent.status !== 'ACTIVE') {
      throw this.badRequest('costCenter.hierarchy.parentInactive', 'Parent cost center must be ACTIVE');
    }
    const childIsCompanyLevel = dto.branchId === null;
    if (parent.branchId && childIsCompanyLevel) {
      throw this.badRequest('costCenter.hierarchy.branchParentToCompanyChild', 'A branch-level cost center cannot be the parent of a company-level cost center');
    }

    // Cycle detection: walk the parent chain of the proposed parent; if it leads
    // back to the node being edited, the edit would form a cycle.
    let cursor: string | null = parent.parentId;
    let guard = 0;
    while (cursor && guard < 100) {
      if (cursor === selfId) {
        throw this.badRequest('costCenter.hierarchy.cycle', 'Cost center hierarchy cycle detected');
      }
      const ancestor = await client.costCenter.findFirst({
        where: { id: cursor, companyId: ctx.companyId, deletedAt: null },
        select: { parentId: true },
      });
      if (!ancestor) break;
      cursor = ancestor.parentId;
      guard += 1;
    }
  }

  private async validateReferenceScope(dto: { administrationId?: string; departmentId?: string; branchId?: string | null }, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const scope = { companyId: ctx.companyId, branchId: dto.branchId ?? ctx.branchId, administrationId: dto.administrationId, departmentId: dto.departmentId };
    if (scope.departmentId) {
      const dept = await client.department.findUnique({ where: { id: scope.departmentId } });
      if (!dept) throw this.badRequest('validation.invalidReference', 'Department not found');
      if (dept.companyId !== ctx.companyId) throw this.badRequest('validation.invalidReference', 'Department belongs to another company');
      if (dept.branchId && scope.branchId && dept.branchId !== scope.branchId) {
        throw this.badRequest('validation.invalidReference', 'Department does not belong to the selected branch');
      }
      if (scope.administrationId && dept.administrationId !== scope.administrationId) {
        throw this.badRequest('validation.invalidReference', 'Department does not belong to the selected administration');
      }
    }
    if (scope.administrationId) {
      const admin = await client.administration.findUnique({ where: { id: scope.administrationId } });
      if (!admin) throw this.badRequest('validation.invalidReference', 'Administration not found');
      if (admin.branchId !== ctx.branchId) throw this.badRequest('validation.invalidReference', 'Administration does not belong to the active branch');
    }
  }

  private requireReason(dto: { reason?: string }, changed: boolean): void {
    if (changed && !dto.reason?.trim()) {
      throw this.badRequest('costCenter.reasonRequired', 'A reason is required for this change');
    }
  }

  private assignmentIncludes() {
    return {
      costCenter: { select: { id: true, code: true, name: true, status: true, isPrimary: true } },
      machine: { select: { id: true, code: true, name: true } },
      productionLine: { select: { id: true, code: true, name: true } },
      productionUnit: { select: { id: true, code: true, name: true } },
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
    };
  }

  private async validateAssignmentCostCenter(costCenterId: string, ctx: ActiveOperationalContext) {
    const cc = await this.prisma.costCenter.findFirst({
      where: { id: costCenterId, companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] },
      select: { id: true },
    });
    if (!cc) throw this.validationError('costCenterId', 'validation.invalidReference', 'Cost center not found in tenant context');
  }

  private async validateAssignmentResources(
    resourceType: string,
    machineId: string | undefined,
    productionLineId: string | undefined,
    productionUnitId: string | undefined,
    ctx: ActiveOperationalContext,
  ): Promise<{ machineId: string | null; productionLineId: string | null; productionUnitId: string | null }> {
    const type = resourceType.toUpperCase();
    if (type === 'MACHINE') {
      if (!machineId || productionLineId || productionUnitId) {
        throw this.validationError('machineId', 'costCenter.assign.resourceConflict', 'MACHINE assignment requires machineId and no line/unit');
      }
      const machine = await this.prisma.machine.findUnique({ where: { id: machineId }, select: { id: true, companyId: true, branchId: true } });
      if (!machine) throw this.validationError('machineId', 'validation.invalidReference', 'Machine not found');
      if (machine.companyId && machine.companyId !== ctx.companyId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another company');
      }
      if (machine.branchId && machine.branchId !== ctx.branchId) {
        throw this.validationError('machineId', 'validation.invalidReference', 'Machine belongs to another branch');
      }
      return { machineId, productionLineId: null, productionUnitId: null };
    }
    if (type === 'LINE') {
      if (!productionLineId || machineId || productionUnitId) {
        throw this.validationError('productionLineId', 'costCenter.assign.resourceConflict', 'LINE assignment requires productionLineId and no machine/unit');
      }
      const line = await this.prisma.productionLine.findFirst({
        where: { id: productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { id: true },
      });
      if (!line) throw this.validationError('productionLineId', 'validation.invalidReference', 'Production line not found in tenant context');
      return { machineId: null, productionLineId, productionUnitId: null };
    }
    if (type === 'UNIT') {
      if (!productionUnitId || machineId || productionLineId) {
        throw this.validationError('productionUnitId', 'costCenter.assign.resourceConflict', 'UNIT assignment requires productionUnitId and no machine/line');
      }
      const unit = await this.prisma.productionUnit.findFirst({
        where: { id: productionUnitId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { id: true },
      });
      if (!unit) throw this.validationError('productionUnitId', 'validation.invalidReference', 'Production unit not found in tenant context');
      return { machineId: null, productionLineId: null, productionUnitId };
    }
    throw this.validationError('resourceType', 'costCenter.assign.invalidResourceType', 'resourceType must be MACHINE, LINE or UNIT');
  }

  private async findEqualPriorityOverlap(
    resourceType: string,
    resource: { machineId: string | null; productionLineId: string | null; productionUnitId: string | null },
    priority: number,
    effectiveFrom: Date,
    effectiveTo: Date | null,
    ctx: ActiveOperationalContext,
    excludeId?: string,
  ) {
    return this.prisma.operationalCostCenterAssignment.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        resourceType: resourceType.toUpperCase(),
        machineId: resource.machineId,
        productionLineId: resource.productionLineId,
        productionUnitId: resource.productionUnitId,
        companyId: ctx.companyId,
        deletedAt: null,
        status: 'ACTIVE',
        priority,
        effectiveFrom: { lte: effectiveTo ?? effectiveFrom },
        AND: [
          { OR: [{ branchId: ctx.branchId }, { branchId: null }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }] },
        ],
      },
      select: { id: true },
    });
  }

  private generateAssignmentCode(): string {
    return `OCCA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  // ── Cost center CRUD ────────────────────────────────────────────

  async create(dto: CreateCostCenterDto, userId: string, ctx: ActiveOperationalContext) {
    const scope = this.deriveScope(dto, ctx);
    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('COST_CENTER'));
    const existing = await this.prisma.costCenter.findFirst({ where: { companyId: ctx.companyId, code, deletedAt: null }, select: { id: true } });
    if (existing) throw this.conflict('costCenter.codeExists', 'Cost center code already exists in this company');

    await this.validateParent(dto, ctx);
    await this.validateReferenceScope(dto, ctx);
    const dates = this.parseDates(dto.effectiveFrom, dto.effectiveTo);

    const item = await this.prisma.costCenter.create({
      data: {
        code,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        parentId: dto.parentId ?? null,
        effectiveFrom: dates.effectiveFrom ?? null,
        effectiveTo: dates.effectiveTo ?? null,
        isPrimary: dto.isPrimary ?? false,
        companyId: scope.companyId,
        branchId: scope.branchId,
        administrationId: dto.administrationId ?? null,
        departmentId: dto.departmentId ?? null,
        status: 'ACTIVE',
      },
      include: this.costCenterIncludes(),
    });
    await this.auditService.log(userId, 'CREATE', COST_CENTER_AUDIT_ENTITY, item.id, { message: `Created cost center: ${item.code}`, companyId: ctx.companyId, branchId: item.branchId });
    return item;
  }

  /**
   * Creates a Cost Center using the canonical business rules against the given
   * Prisma client (normally a transaction client). Single source of truth for
   * the business rules, reused by the standalone create page and by the atomic
   * "machine with dedicated cost center" workflow. The caller owns the outer
   * transaction so a machine + its dedicated cost center commit or roll back
   * together (no orphan cost centers).
   */
  async createDedicatedCostCenter(
    client: any,
    dto: CreateCostCenterDto,
    ctx: ActiveOperationalContext,
    userId: string,
  ) {
    const scope = this.deriveScope(dto, ctx);
    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomicWithClient('COST_CENTER', client));
    const existing = await client.costCenter.findFirst({ where: { companyId: ctx.companyId, code, deletedAt: null }, select: { id: true } });
    if (existing) throw this.conflict('costCenter.codeExists', 'Cost center code already exists in this company');

    await this.validateParent(dto, ctx, undefined, client);
    await this.validateReferenceScope(dto, ctx, client);
    const dates = this.parseDates(dto.effectiveFrom, dto.effectiveTo);

    const item = await client.costCenter.create({
      data: {
        code,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        parentId: dto.parentId ?? null,
        effectiveFrom: dates.effectiveFrom ?? null,
        effectiveTo: dates.effectiveTo ?? null,
        isPrimary: dto.isPrimary ?? false,
        companyId: scope.companyId,
        branchId: scope.branchId,
        administrationId: dto.administrationId ?? null,
        departmentId: dto.departmentId ?? null,
        status: 'ACTIVE',
      },
      include: this.costCenterIncludes(),
    });
    await this.auditService.logWithClient(client, {
      userId,
      action: 'CREATE',
      entity: COST_CENTER_AUDIT_ENTITY,
      entityId: item.id,
      details: { message: `Created cost center: ${item.code}`, companyId: ctx.companyId, branchId: item.branchId },
    });
    return item;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    type?: string; companyId?: string; branchId?: string;
    administrationId?: string; departmentId?: string; status?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, companyId: ctx.companyId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { code: { contains: query.search } },
      ];
    }
    if (query.type) where.type = query.type;
    if (query.branchId && query.branchId === ctx.branchId) {
      where.branchId = query.branchId;
    } else {
      where.OR = (where.OR || []).concat([{ branchId: ctx.branchId }, { branchId: null }]);
    }
    if (query.administrationId) where.administrationId = query.administrationId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.costCenter.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: this.costCenterIncludes(),
      }),
      this.prisma.costCenter.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    await this.findOwnedCostCenter(id, ctx);
    return this.prisma.costCenter.findUnique({ where: { id }, include: this.costCenterIncludes() });
  }

  async update(id: string, dto: UpdateCostCenterDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwnedCostCenter(id, ctx);
    if (dto.code && dto.code !== existing.code) {
      throw this.badRequest('costCenter.codeImmutable', 'Code cannot be changed after creation');
    }
    const scope = this.deriveScope(dto, ctx);

    const newParentId = dto.parentId === '' ? null : dto.parentId;
    const sensitiveChanged =
      (dto.parentId !== undefined && (newParentId ?? null) !== (existing.parentId ?? null)) ||
      (dto.effectiveFrom !== undefined &&
        this.effectiveDayKey(dto.effectiveFrom) !== this.effectiveDayKey(existing.effectiveFrom)) ||
      (dto.effectiveTo !== undefined &&
        this.effectiveDayKey(dto.effectiveTo) !== this.effectiveDayKey(existing.effectiveTo)) ||
      (dto.isPrimary !== undefined && dto.isPrimary !== existing.isPrimary);
    this.requireReason(dto, sensitiveChanged);

    const childBranchId = dto.branchId === undefined ? existing.branchId : scope.branchId;
    await this.validateParent({ parentId: dto.parentId ?? existing.parentId ?? undefined, branchId: childBranchId }, ctx, id);
    await this.validateReferenceScope(dto, ctx);
    const dates = this.parseDates(dto.effectiveFrom, dto.effectiveTo);

    const item = await this.prisma.costCenter.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        ...(dates.effectiveFrom !== undefined ? { effectiveFrom: dates.effectiveFrom } : {}),
        ...(dates.effectiveTo !== undefined ? { effectiveTo: dates.effectiveTo } : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        ...(dto.branchId !== undefined ? { branchId: scope.branchId } : {}),
        ...(dto.administrationId !== undefined ? { administrationId: dto.administrationId || null } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}),
      },
      include: this.costCenterIncludes(),
    });
    await this.auditService.log(userId, 'UPDATE', COST_CENTER_AUDIT_ENTITY, id, { message: `Updated cost center: ${item.code}`, companyId: ctx.companyId, branchId: item.branchId, reason: dto.reason ?? null });
    return item;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedCostCenter(id, ctx);
    const machineCount = await this.prisma.machine.count({ where: { defaultCostCenterId: id, deletedAt: null } });
    if (machineCount > 0) throw this.conflict('costCenter.delete.linkedMachines', 'Cannot delete cost center with linked machines');
    const plCount = await this.prisma.productionLine.count({ where: { costCenterId: id, deletedAt: null } });
    if (plCount > 0) throw this.conflict('costCenter.delete.linkedLines', 'Cannot delete cost center with linked production lines');
    const reqCount = await this.prisma.maintenanceRequest.count({ where: { costCenterId: id, deletedAt: null } });
    if (reqCount > 0) throw this.conflict('costCenter.delete.linkedRequests', 'Cannot delete cost center with linked maintenance requests');
    const childCount = await this.prisma.costCenter.count({ where: { parentId: id, deletedAt: null } });
    if (childCount > 0) throw this.conflict('costCenter.delete.hasChildren', 'Cannot delete a cost center with child cost centers');
    const assignCount = await this.prisma.operationalCostCenterAssignment.count({ where: { costCenterId: id, deletedAt: null } });
    if (assignCount > 0) throw this.conflict('costCenter.delete.hasAssignments', 'Cannot delete a cost center with operational assignments');

    await this.prisma.costCenter.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', COST_CENTER_AUDIT_ENTITY, id, { companyId: ctx.companyId });
    return { message: 'Cost center deleted successfully' };
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedCostCenter(id, ctx);
    const item = await this.prisma.costCenter.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.auditService.log(userId, 'ACTIVATE', COST_CENTER_AUDIT_ENTITY, id, { companyId: ctx.companyId });
    return item;
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    await this.findOwnedCostCenter(id, ctx);
    const item = await this.prisma.costCenter.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.auditService.log(userId, 'DEACTIVATE', COST_CENTER_AUDIT_ENTITY, id, { companyId: ctx.companyId });
    return item;
  }

  // ── Operational cost center assignments ─────────────────────────

  async createAssignment(dto: CreateOperationalCostCenterAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    await this.validateAssignmentCostCenter(dto.costCenterId, ctx);
    const resource = await this.validateAssignmentResources(dto.resourceType, dto.machineId, dto.productionLineId, dto.productionUnitId, ctx);
    const dates = this.parseDates(dto.effectiveFrom, dto.effectiveTo);
    const effectiveFrom = dates.effectiveFrom;
    if (!effectiveFrom) throw this.validationError('effectiveFrom', 'validation.required', 'effectiveFrom is required');

    const code = dto.code?.trim() || this.generateAssignmentCode();
    const codeExists = await this.prisma.operationalCostCenterAssignment.findUnique({ where: { code } });
    if (codeExists) throw this.validationError('code', 'costCenter.assign.codeExists', 'Assignment code already exists');

    const priority = dto.priority ?? 0;
    const overlap = await this.findEqualPriorityOverlap(dto.resourceType, resource, priority, effectiveFrom, dates.effectiveTo ?? null, ctx);
    if (overlap) {
      throw this.conflict('costCenter.assign.overlap', 'An ACTIVE assignment with equal priority already covers this resource and period');
    }

    const assignment = await this.prisma.operationalCostCenterAssignment.create({
      data: {
        code,
        resourceType: dto.resourceType.toUpperCase(),
        costCenterId: dto.costCenterId,
        machineId: resource.machineId,
        productionLineId: resource.productionLineId,
        productionUnitId: resource.productionUnitId,
        effectiveFrom,
        effectiveTo: dates.effectiveTo,
        priority,
        source: dto.source ?? 'MANUAL',
        reason: dto.reason ?? null,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'DRAFT',
      },
      include: this.assignmentIncludes(),
    });
    await this.auditService.log(userId, 'CREATE', OPERATIONAL_COST_CENTER_ASSIGNMENT_AUDIT_ENTITY, assignment.id, { code: assignment.code, resourceType: assignment.resourceType, companyId: ctx.companyId, branchId: ctx.branchId });
    return assignment;
  }

  async findAssignments(query: OperationalCostCenterAssignmentQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { companyId: ctx.companyId, deletedAt: null, AND: [{ OR: [{ branchId: ctx.branchId }, { branchId: null }] }] };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { costCenter: { is: { name: { contains: query.search } } } },
        { machine: { is: { name: { contains: query.search } } } },
        { productionLine: { is: { name: { contains: query.search } } } },
        { productionUnit: { is: { name: { contains: query.search } } } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.resourceType) where.resourceType = query.resourceType.toUpperCase();
    if (query.machineId) where.machineId = query.machineId;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.productionUnitId) where.productionUnitId = query.productionUnitId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;

    const [data, total] = await Promise.all([
      this.prisma.operationalCostCenterAssignment.findMany({
        where, skip, take: limit, orderBy: { effectiveFrom: 'desc' },
        include: this.assignmentIncludes(),
      }),
      this.prisma.operationalCostCenterAssignment.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findAssignment(id: string, ctx: ActiveOperationalContext) {
    await this.findOwnedAssignment(id, ctx);
    return this.prisma.operationalCostCenterAssignment.findUnique({ where: { id }, include: this.assignmentIncludes() });
  }

  async updateAssignment(id: string, dto: UpdateOperationalCostCenterAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwnedAssignment(id, ctx);
    if (existing.status === 'ENDED') {
      throw this.badRequest('costCenter.assign.immutable', 'An ENDED assignment is immutable');
    }

    const structural = dto.resourceType !== undefined || dto.machineId !== undefined || dto.productionLineId !== undefined || dto.productionUnitId !== undefined;
    if (existing.status === 'ACTIVE' && structural) {
      throw this.badRequest('costCenter.assign.structuralChange', 'The resource scope of an ACTIVE assignment is immutable; end it and create a new assignment');
    }

    const overrideChanged =
      (dto.costCenterId !== undefined && dto.costCenterId !== existing.costCenterId) ||
      (dto.priority !== undefined && dto.priority !== existing.priority) ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveTo !== undefined;
    if (existing.status === 'ACTIVE') {
      this.requireReason(dto, overrideChanged);
    }

    const resource = structural
      ? await this.validateAssignmentResources(
          dto.resourceType ?? existing.resourceType,
          dto.machineId ?? existing.machineId ?? undefined,
          dto.productionLineId ?? existing.productionLineId ?? undefined,
          dto.productionUnitId ?? existing.productionUnitId ?? undefined,
          ctx,
        )
      : { machineId: existing.machineId, productionLineId: existing.productionLineId, productionUnitId: existing.productionUnitId };

    if (dto.costCenterId !== undefined) {
      await this.validateAssignmentCostCenter(dto.costCenterId, ctx);
    }

    const dates = this.parseDates(
      dto.effectiveFrom ?? (existing.effectiveFrom ? existing.effectiveFrom.toISOString() : undefined),
      dto.effectiveTo !== undefined ? dto.effectiveTo : existing.effectiveTo ? existing.effectiveTo.toISOString() : null,
    );
    const effectiveFrom: Date | null = dates.effectiveFrom ?? existing.effectiveFrom ?? null;
    const effectiveTo: Date | null = dates.effectiveTo === undefined ? existing.effectiveTo : dates.effectiveTo;

    const priority = dto.priority ?? existing.priority;
    const overlap = await this.findEqualPriorityOverlap(existing.resourceType, resource, priority, effectiveFrom, effectiveTo, ctx, id);
    if (overlap) {
      throw this.conflict('costCenter.assign.overlap', 'An ACTIVE assignment with equal priority already covers this resource and period');
    }

    const assignment = await this.prisma.operationalCostCenterAssignment.update({
      where: { id },
      data: {
        ...(dto.costCenterId !== undefined ? { costCenterId: dto.costCenterId } : {}),
        ...(resource.machineId !== undefined ? { machineId: resource.machineId } : {}),
        ...(resource.productionLineId !== undefined ? { productionLineId: resource.productionLineId } : {}),
        ...(resource.productionUnitId !== undefined ? { productionUnitId: resource.productionUnitId } : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: dates.effectiveFrom } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
        ...(dto.priority !== undefined ? { priority } : {}),
        ...(dto.source !== undefined ? { source: dto.source } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      },
      include: this.assignmentIncludes(),
    });
    await this.auditService.log(userId, 'UPDATE', OPERATIONAL_COST_CENTER_ASSIGNMENT_AUDIT_ENTITY, id, { code: assignment.code, reason: dto.reason ?? null, companyId: ctx.companyId, branchId: ctx.branchId });
    return assignment;
  }

  async transitionAssignment(id: string, dto: TransitionOperationalCostCenterAssignmentDto, userId: string, ctx: ActiveOperationalContext) {
    if (!dto.reason?.trim()) {
      throw this.badRequest('costCenter.assign.reasonRequired', 'A reason is required for the transition');
    }
    const existing = await this.findOwnedAssignment(id, ctx);
    if (existing.status === 'ENDED') {
      throw this.badRequest('costCenter.assign.immutable', 'An ENDED assignment is immutable');
    }

    let next: string;
    if (dto.toStatus === 'ACTIVE') {
      if (existing.status !== 'DRAFT') {
        throw this.badRequest('costCenter.assign.transition.invalid', 'Only DRAFT assignments can be activated');
      }
      const overlap = await this.findEqualPriorityOverlap(
        existing.resourceType,
        { machineId: existing.machineId, productionLineId: existing.productionLineId, productionUnitId: existing.productionUnitId },
        existing.priority,
        existing.effectiveFrom,
        existing.effectiveTo,
        ctx,
        id,
      );
      if (overlap) {
        throw this.conflict('costCenter.assign.overlap', 'An ACTIVE assignment with equal priority already covers this resource and period');
      }
      next = 'ACTIVE';
    } else if (dto.toStatus === 'ENDED') {
      if (existing.status !== 'ACTIVE') {
        throw this.badRequest('costCenter.assign.transition.invalid', 'Only ACTIVE assignments can be ended');
      }
      next = 'ENDED';
    } else {
      throw this.badRequest('costCenter.assign.transition.invalid', 'Unsupported transition target');
    }

    const assignment = await this.prisma.operationalCostCenterAssignment.update({
      where: { id },
      data: { status: next, reason: dto.reason },
      include: this.assignmentIncludes(),
    });
    await this.auditService.log(userId, 'TRANSITION', OPERATIONAL_COST_CENTER_ASSIGNMENT_AUDIT_ENTITY, id, {
      from: existing.status, to: next, reason: dto.reason, companyId: ctx.companyId, branchId: ctx.branchId,
    });
    return assignment;
  }

  async removeAssignment(id: string, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findOwnedAssignment(id, ctx);
    if (existing.status !== 'DRAFT') {
      throw this.badRequest('costCenter.assign.immutable', 'Only DRAFT assignments can be deleted; end ACTIVE assignments instead');
    }
    await this.prisma.operationalCostCenterAssignment.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.log(userId, 'DELETE', OPERATIONAL_COST_CENTER_ASSIGNMENT_AUDIT_ENTITY, id, { companyId: ctx.companyId, branchId: ctx.branchId });
    return { message: 'Operational cost center assignment deleted successfully' };
  }

  // ── Standalone resolution (D9) ──────────────────────────────────

  async resolve(dto: ResolveCostCenterDto, ctx: ActiveOperationalContext) {
    return this.resolver.resolve(dto, ctx);
  }
}
