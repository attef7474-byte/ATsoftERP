import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { ResolveCostCenterDto } from './dto/resolve-cost-center.dto';

/**
 * Standalone operational cost-center resolver (Phase 2 Batch 2A, D4/D7/D9).
 *
 * Resolution contract (§8):
 *  - Tenant derives exclusively from the active context; client resource ids are
 *    cross-checked against the tenant (foreign ids yield 404, never 200).
 *  - Specificity chain machine > line > unit: a resource resolves at its most
 *    specific tier first. Parent fallback walks the resource hierarchy — a
 *    machine falls back to its production line when no MACHINE assignment
 *    qualifies. The line/unit tiers have no parent resource link in the approved
 *    data model (ProductionLine has no productionUnitId and ProductionUnit is a
 *    unit-of-measure master), so a LINE or UNIT resource resolves only at its
 *    own tier; there is nothing further to fall back to.
 *  - Within a tier at referenceDate only ACTIVE assignments whose range contains
 *    the date qualify; deterministic order: priority ASC (lower wins),
 *    effectiveFrom ASC, createdAt ASC. Two distinct assignments at the same tier
 *    with equal priority overlapping at referenceDate => explicit ambiguity error
 *    (409), never a silent pick.
 *  - No qualifying assignment at any tier => explicit missing error (404).
 *  - The resolved cost center's tenant must equal the active context tenant,
 *    otherwise 404.
 */
@Injectable()
export class OperationalCostCenterResolver {
  constructor(private prisma: PrismaService) {}

  private badRequest(key: string, message: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message });
  }

  private notFound(key: string, message: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message });
  }

  private ambiguity(key: string, message: string): ConflictException {
    return new ConflictException({ messageKey: key, message });
  }

  private async resourceChain(
    client: any,
    dto: ResolveCostCenterDto,
    ctx: ActiveOperationalContext,
  ): Promise<Array<{ resourceType: string; resourceId: string }>> {
    const type = dto.resourceType.toUpperCase();
    if (type === 'MACHINE') {
      if (!dto.machineId || dto.productionLineId || dto.productionUnitId) {
        throw this.badRequest('costCenter.resolve.resourceConflict', 'MACHINE resolution requires machineId and no line/unit');
      }
      const machine = await client.machine.findFirst({
        where: { id: dto.machineId, companyId: ctx.companyId, deletedAt: null },
        select: { id: true, companyId: true, branchId: true, productionLineId: true },
      });
      if (!machine) throw this.notFound('costCenter.resolve.machineNotFound', 'Machine not found in tenant context');
      if (machine.companyId !== ctx.companyId) {
        throw this.notFound('costCenter.resolve.machineNotFound', 'Machine not found in tenant context');
      }
      if (machine.branchId && machine.branchId !== ctx.branchId) {
        throw this.notFound('costCenter.resolve.machineNotFound', 'Machine not found in branch context');
      }
      const chain: Array<{ resourceType: string; resourceId: string }> = [{ resourceType: 'MACHINE', resourceId: machine.id }];
      if (machine.productionLineId) chain.push({ resourceType: 'LINE', resourceId: machine.productionLineId });
      return chain;
    }
    if (type === 'LINE') {
      if (!dto.productionLineId || dto.machineId || dto.productionUnitId) {
        throw this.badRequest('costCenter.resolve.resourceConflict', 'LINE resolution requires productionLineId and no machine/unit');
      }
      const line = await client.productionLine.findFirst({
        where: { id: dto.productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { id: true },
      });
      if (!line) throw this.notFound('costCenter.resolve.lineNotFound', 'Production line not found in tenant context');
      return [{ resourceType: 'LINE', resourceId: line.id }];
    }
    if (type === 'UNIT') {
      if (!dto.productionUnitId || dto.machineId || dto.productionLineId) {
        throw this.badRequest('costCenter.resolve.resourceConflict', 'UNIT resolution requires productionUnitId and no machine/line');
      }
      const unit = await client.productionUnit.findFirst({
        where: { id: dto.productionUnitId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { id: true },
      });
      if (!unit) throw this.notFound('costCenter.resolve.unitNotFound', 'Production unit not found in tenant context');
      return [{ resourceType: 'UNIT', resourceId: unit.id }];
    }
    throw this.badRequest('costCenter.resolve.invalidResourceType', 'resourceType must be MACHINE, LINE or UNIT');
  }

  async resolve(dto: ResolveCostCenterDto, ctx: ActiveOperationalContext) {
    return this.resolveWithClient(this.prisma, dto, ctx);
  }

  /**
   * Tx-aware resolution used by the cost-post flow so every authoritative read runs
   * inside the same Prisma transaction client. Public `resolve` behavior is unchanged.
   */
  async resolveWithClient(client: any, dto: ResolveCostCenterDto, ctx: ActiveOperationalContext) {
    const reference = dto.referenceDate ? new Date(dto.referenceDate) : new Date();
    if (isNaN(reference.getTime())) {
      throw this.badRequest('costCenter.resolve.invalidDate', 'referenceDate is not a valid date');
    }

    const chain = await this.resourceChain(client, dto, ctx);

    let matched: any = null;
    let matchedLevel: { resourceType: string; resourceId: string } | null = null;

    for (const level of chain) {
      const resourceField = level.resourceType === 'MACHINE' ? 'machineId' : level.resourceType === 'LINE' ? 'productionLineId' : 'productionUnitId';
      const candidates = await client.operationalCostCenterAssignment.findMany({
        where: {
          resourceType: level.resourceType,
          [resourceField]: level.resourceId,
          companyId: ctx.companyId,
          deletedAt: null,
          status: 'ACTIVE',
          effectiveFrom: { lte: reference },
          AND: [
            { OR: [{ branchId: ctx.branchId }, { branchId: null }] },
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: reference } }] },
          ],
        },
        orderBy: [{ priority: 'asc' }, { effectiveFrom: 'asc' }, { createdAt: 'asc' }],
        include: {
          costCenter: {
            select: { id: true, code: true, name: true, companyId: true, branchId: true, parentId: true, isPrimary: true },
          },
        },
      });

      if (candidates.length === 0) continue;

      if (candidates.length > 1 && candidates[0].priority === candidates[1].priority) {
        throw this.ambiguity(
          'costCenter.resolve.ambiguity',
          `Ambiguous cost center assignments for ${level.resourceType} at the reference date`,
        );
      }
      matched = candidates[0];
      matchedLevel = level;
      break;
    }

    if (!matched || !matchedLevel) {
      throw this.notFound('costCenter.resolve.missing', 'No qualifying operational cost center assignment for the resource at the reference date');
    }

    const cc = matched.costCenter;
    if (!cc || cc.companyId !== ctx.companyId) {
      throw this.notFound('costCenter.resolve.tenantMismatch', 'Resolved cost center does not belong to the active tenant');
    }
    if (cc.branchId && cc.branchId !== ctx.branchId) {
      throw this.notFound('costCenter.resolve.tenantMismatch', 'Resolved cost center does not belong to the active branch');
    }

    const hierarchyChain = await this.costCenterChain(client, cc.id, ctx);

    return {
      costCenterId: cc.id,
      costCenter: { id: cc.id, code: cc.code, name: cc.name, isPrimary: cc.isPrimary },
      matchedAssignment: {
        id: matched.id,
        code: matched.code,
        resourceType: matchedLevel.resourceType,
        resourceId: levelId(matchedLevel.resourceType, matched),
        effectiveFrom: matched.effectiveFrom,
        effectiveTo: matched.effectiveTo,
        priority: matched.priority,
        source: matched.source,
        isPrimary: matched.isPrimary,
        branchId: matched.branchId,
      },
      tenant: { companyId: ctx.companyId, branchId: ctx.branchId },
      hierarchyChain,
    };
  }

  private async costCenterChain(client: any, rootId: string, ctx: ActiveOperationalContext) {
    const chain: Array<{ id: string; code: string; name: string }> = [];
    let cursor: string | null = rootId;
    let guard = 0;
    while (cursor && guard < 50) {
      const node: { id: string; code: string; name: string; parentId: string | null } | null =
        await client.costCenter.findFirst({
          where: { id: cursor, companyId: ctx.companyId, deletedAt: null },
          select: { id: true, code: true, name: true, parentId: true },
        });
      if (!node) break;
      chain.push({ id: node.id, code: node.code, name: node.name });
      cursor = node.parentId;
      guard += 1;
    }
    return chain;
  }
}

function levelId(resourceType: string, assignment: any): string {
  if (resourceType === 'MACHINE') return assignment.machineId;
  if (resourceType === 'LINE') return assignment.productionLineId;
  return assignment.productionUnitId;
}
