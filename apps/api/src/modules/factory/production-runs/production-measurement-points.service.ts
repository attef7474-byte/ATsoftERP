import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateMeasurementPointDto } from './dto/create-measurement-point.dto';
import { UpdateMeasurementPointDto } from './dto/update-measurement-point.dto';
import { MeasurementPointQueryDto } from './dto/measurement-point-query.dto';
import { PRODUCTION_MEASUREMENT_POINT_AUDIT_ENTITY, PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE } from './production-runs.constants';

const pointInclude = {
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, code: true, name: true } },
  machineComponent: { select: { id: true, code: true, name: true } },
  productionUnit: { select: { id: true, code: true, name: true, abbreviation: true } },
};

@Injectable()
export class ProductionMeasurementPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  async create(dto: CreateMeasurementPointDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const references = await this.validateReferences(dto, ctx, tx);
      const code = dto.code?.trim() || (await this.numbering.generateNumberAtomicWithClient(PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE, tx));
      const codeExists = await tx.productionMeasurementPoint.findFirst({ where: { companyId: ctx.companyId, branchId: ctx.branchId, code, deletedAt: null } });
      if (codeExists) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.codeExists' });
      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
      const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
      if (!Number.isFinite(effectiveFrom.getTime()) || (effectiveTo && (!Number.isFinite(effectiveTo.getTime()) || effectiveTo < effectiveFrom))) {
        throw new BadRequestException({ messageKey: 'productionMeasurementPoint.invalidEffectiveRange' });
      }
      const modulus = dto.counterModulus !== undefined ? new Prisma.Decimal(dto.counterModulus) : null;
      if (modulus && modulus.lessThanOrEqualTo(0)) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.invalidModulus' });
      if (dto.source === 'COUNTER' && !modulus) {
        throw new BadRequestException({ messageKey: 'productionMeasurementPoint.counterModulusRequired' });
      }
      const isAuthoritativeFinal = dto.isAuthoritativeFinal ?? false;
      const draft = {
        ...references,
        code,
        name: dto.name,
        description: dto.description || null,
        role: dto.role,
        source: dto.source,
        unit: dto.unit,
        isAuthoritativeFinal,
        counterModulus: modulus,
        effectiveFrom,
        effectiveTo,
        status: 'DRAFT',
        createdById: userId,
        updatedById: userId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
      };
      const created = await tx.productionMeasurementPoint.create({ data: draft, include: pointInclude });
      await this.audit.logWithClient(tx, {
        userId,
        action: 'CREATE',
        entity: PRODUCTION_MEASUREMENT_POINT_AUDIT_ENTITY,
        entityId: created.id,
        details: { companyId: ctx.companyId, branchId: ctx.branchId, code: created.code, role: created.role, source: created.source, isAuthoritativeFinal: created.isAuthoritativeFinal },
      });
      return created;
    });
  }

  async findAll(query: MeasurementPointQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.role) where.role = query.role;
    if (query.productionLineId) where.productionLineId = query.productionLineId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
        { productionLine: { name: { contains: query.search } } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).productionMeasurementPoint.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ code: 'asc' }], include: pointInclude }),
      (this.prisma as any).productionMeasurementPoint.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateMeasurementPointDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(id, ctx, tx);
      if (current.status !== 'DRAFT') throw new ConflictException({ messageKey: 'productionMeasurementPoint.editDraftOnly' });
      const referenced = await tx.productionOutputEvent.count({ where: { measurementPointId: id, companyId: ctx.companyId, branchId: ctx.branchId } });
      if (referenced > 0) throw new ConflictException({ messageKey: 'productionMeasurementPoint.referencedLocked' });
      const references = await this.validateReferences({ ...current, ...dto, productionLineId: current.productionLineId, source: dto.source ?? current.source, role: dto.role ?? current.role, unit: dto.unit ?? current.unit, isAuthoritativeFinal: dto.isAuthoritativeFinal ?? current.isAuthoritativeFinal, counterModulus: dto.counterModulus !== undefined ? dto.counterModulus : current.counterModulus?.toString(), effectiveFrom: dto.effectiveFrom ?? new Date(current.effectiveFrom).toISOString(), effectiveTo: dto.effectiveTo ?? (current.effectiveTo ? new Date(current.effectiveTo).toISOString() : undefined) } as any, ctx, tx);
      const updated = await (tx as any).productionMeasurementPoint.update({
        where: { id },
        data: {
          ...references,
          name: dto.name ?? current.name,
          description: dto.description === undefined ? current.description : dto.description,
          role: dto.role ?? current.role,
          source: dto.source ?? current.source,
          unit: dto.unit ?? current.unit,
          isAuthoritativeFinal: dto.isAuthoritativeFinal ?? current.isAuthoritativeFinal,
          counterModulus: dto.counterModulus !== undefined ? new Prisma.Decimal(dto.counterModulus) : current.counterModulus,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : current.effectiveFrom,
          effectiveTo: dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : current.effectiveTo,
          updatedById: userId,
        },
        include: pointInclude,
      });
      await this.audit.logWithClient(tx, { userId, action: 'UPDATE', entity: PRODUCTION_MEASUREMENT_POINT_AUDIT_ENTITY, entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId, code: current.code, before: this.auditMaterial(current), after: this.auditMaterial(updated) } });
      return updated;
    });
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.statusTransition(id, userId, ctx, 'ACTIVATE', 'ACTIVE', ['DRAFT', 'INACTIVE']);
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.statusTransition(id, userId, ctx, 'DEACTIVATE', 'INACTIVE', ['ACTIVE']);
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(id, ctx, tx);
      if (current.status !== 'DRAFT') throw new ConflictException({ messageKey: 'productionMeasurementPoint.deleteDraftOnly' });
      const referenced = await tx.productionOutputEvent.count({ where: { measurementPointId: id, companyId: ctx.companyId, branchId: ctx.branchId } });
      if (referenced > 0) throw new ConflictException({ messageKey: 'productionMeasurementPoint.referencedLocked' });
      const updated = await (tx as any).productionMeasurementPoint.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
      await this.audit.logWithClient(tx, { userId, action: 'DELETE', entity: PRODUCTION_MEASUREMENT_POINT_AUDIT_ENTITY, entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId, code: current.code } });
      return updated;
    });
  }

  private async statusTransition(id: string, userId: string, ctx: ActiveOperationalContext, action: string, targetStatus: string, allowedFrom: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOwned(id, ctx, tx);
      if (!allowedFrom.includes(current.status)) throw new ConflictException({ messageKey: `productionMeasurementPoint.${action.toLowerCase()}StateInvalid` });
      if (targetStatus === 'ACTIVE') await this.assertNoAuthoritativeConflict({ ...current, isAuthoritativeFinal: current.isAuthoritativeFinal, productionLineId: current.productionLineId }, ctx, tx, id);
      const updated = await (tx as any).productionMeasurementPoint.update({
        where: { id },
        data: { status: targetStatus, updatedById: userId },
        include: pointInclude,
      });
      await this.audit.logWithClient(tx, { userId, action, entity: PRODUCTION_MEASUREMENT_POINT_AUDIT_ENTITY, entityId: id, details: { companyId: ctx.companyId, branchId: ctx.branchId, code: current.code, fromStatus: current.status, toStatus: targetStatus } });
      return updated;
    });
  }

  private async assertNoAuthoritativeConflict(point: any, ctx: ActiveOperationalContext, client: any, excludeId: string) {
    if (!point.isAuthoritativeFinal) return;
    const farFuture = new Date('9999-12-31T23:59:59.999Z');
    const overlapping = await client.productionMeasurementPoint.findFirst({
      where: {
        id: { not: excludeId },
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        productionLineId: point.productionLineId,
        isAuthoritativeFinal: true,
        status: 'ACTIVE',
        deletedAt: null,
        effectiveFrom: { lte: point.effectiveTo ?? farFuture },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: point.effectiveFrom } }],
      },
    });
    if (overlapping) throw new ConflictException({ messageKey: 'productionMeasurementPoint.authoritativeConflict', details: { existingCode: overlapping.code } });
  }

  private async validateReferences(input: any, ctx: ActiveOperationalContext, client: any) {
    const line = await client.productionLine.findFirst({ where: { id: input.productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
    if (!line) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.lineInvalid' });
    if (input.machineId) {
      const machine = await client.machine.findFirst({ where: { id: input.machineId, companyId: ctx.companyId, branchId: ctx.branchId, productionLineId: input.productionLineId, status: 'ACTIVE', deletedAt: null } });
      if (!machine) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.machineInvalid' });
    }
    if (input.machineComponentId) {
      const component = await client.machineComponent.findFirst({ where: { id: input.machineComponentId, companyId: ctx.companyId, branchId: ctx.branchId, ...(input.machineId ? { machineId: input.machineId } : {}), status: 'ACTIVE', deletedAt: null } });
      if (!component) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.componentInvalid' });
    }
    const unit = await client.productionUnit.findFirst({ where: { id: input.productionUnitId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null } });
    if (!unit) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.unitInvalid' });
    const modulus = input.counterModulus !== undefined && input.counterModulus !== null ? new Prisma.Decimal(input.counterModulus) : null;
    if (modulus && modulus.lessThanOrEqualTo(0)) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.invalidModulus' });
    if (input.source === 'COUNTER' && !modulus) throw new BadRequestException({ messageKey: 'productionMeasurementPoint.counterModulusRequired' });
    return {
      productionLineId: input.productionLineId,
      machineId: input.machineId || null,
      machineComponentId: input.machineComponentId || null,
      productionUnitId: input.productionUnitId,
    };
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext, client: any = this.prisma) {
    const record = await client.productionMeasurementPoint.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null }, include: pointInclude });
    if (!record) throw new NotFoundException({ messageKey: 'productionMeasurementPoint.notFound' });
    return record;
  }

  private auditMaterial(point: any) {
    return {
      name: point.name,
      description: point.description,
      productionLineId: point.productionLineId,
      machineId: point.machineId,
      machineComponentId: point.machineComponentId,
      productionUnitId: point.productionUnitId,
      role: point.role,
      source: point.source,
      unit: point.unit,
      isAuthoritativeFinal: point.isAuthoritativeFinal,
      counterModulus: point.counterModulus?.toString(),
      effectiveFrom: point.effectiveFrom,
      effectiveTo: point.effectiveTo,
      status: point.status,
    };
  }
}