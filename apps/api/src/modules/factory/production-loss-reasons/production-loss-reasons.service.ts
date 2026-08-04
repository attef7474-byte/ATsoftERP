import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CreateLossReasonDto } from './dto/create-loss-reason.dto';
import { UpdateLossReasonDto } from './dto/update-loss-reason.dto';
import { LossReasonQueryDto } from './dto/loss-reason-query.dto';
import {
  LOSS_REASON_ACTIVE_STATUS,
  LOSS_REASON_AUDIT_ENTITY,
} from './production-loss-reasons.constants';

const reasonInclude = {
  parent: { select: { id: true, code: true, nameAr: true, nameEn: true, lossCategory: true, status: true } },
} as const;

@Injectable()
export class ProductionLossReasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private notFound(): NotFoundException {
    return new NotFoundException({ messageKey: 'productionLossReason.notFound', message: 'productionLossReason.notFound' });
  }

  private badRequest(key: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message: key });
  }

  private conflict(key: string): ConflictException {
    return new ConflictException({ messageKey: key, message: key });
  }

  private tenantWhere(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }

  async create(dto: CreateLossReasonDto, userId: string, ctx: ActiveOperationalContext) {
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw this.badRequest('productionLossReason.effectiveRangeInvalid');
    }
    if (dto.parentId) {
      const parent = await this.prisma.operationalLossReason.findFirst({
        where: { id: dto.parentId, ...this.tenantWhere(ctx), deletedAt: null },
      });
      if (!parent) throw this.badRequest('productionLossReason.parentNotFound');
    }

    const data: Prisma.OperationalLossReasonUncheckedCreateInput = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      code: dto.code.trim().toUpperCase(),
      nameAr: dto.nameAr,
      nameEn: dto.nameEn,
      description: dto.description || null,
      parentId: dto.parentId || null,
      lossCategory: dto.lossCategory,
      plannedDefault: dto.plannedDefault ?? false,
      severityDefault: dto.severityDefault ?? null,
      maintenanceRequestPolicy: dto.maintenanceRequestPolicy ?? 'OPTIONAL',
      effectiveFrom,
      effectiveTo,
      status: dto.status ?? 'DRAFT',
      createdById: userId,
      updatedById: userId,
    };

    try {
      const created = await this.prisma.operationalLossReason.create({ data, include: reasonInclude });
      await this.audit.log(userId, 'CREATE', LOSS_REASON_AUDIT_ENTITY, created.id, {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        code: created.code,
        lossCategory: created.lossCategory,
        status: created.status,
      });
      return created;
    } catch (error: any) {
      if (error?.code === 'P2002') throw this.conflict('productionLossReason.duplicateCode');
      throw error;
    }
  }

  async findAll(query: LossReasonQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { ...this.tenantWhere(ctx), deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.lossCategory) where.lossCategory = query.lossCategory;
    if (query.parentId) where.parentId = query.parentId;
    if (query.search) {
      where.AND = [
        { OR: [
          { code: { contains: query.search } },
          { nameAr: { contains: query.search } },
          { nameEn: { contains: query.search } },
        ] },
      ];
    }
    if (query.effectiveDate) {
      const date = new Date(query.effectiveDate);
      where.effectiveFrom = { lte: date };
      where.OR = [{ effectiveTo: null }, { effectiveTo: { gt: date } }];
    }

    const [data, total] = await Promise.all([
      this.prisma.operationalLossReason.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ code: 'asc' }],
        include: reasonInclude,
      }),
      this.prisma.operationalLossReason.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const reason = await this.prisma.operationalLossReason.findFirst({
      where: { id, ...this.tenantWhere(ctx), deletedAt: null },
      include: reasonInclude,
    });
    if (!reason) throw this.notFound();
    const [segmentCount, eventCount, childCount] = await Promise.all([
      this.prisma.downtimeSegment.count({ where: { reasonId: id, companyId: ctx.companyId, branchId: ctx.branchId } }),
      this.prisma.productionLossQuantityEvent.count({ where: { reasonId: id, companyId: ctx.companyId, branchId: ctx.branchId } }),
      this.prisma.operationalLossReason.count({ where: { parentId: id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } }),
    ]);
    return { ...reason, usage: { segmentCount, eventCount, childCount } };
  }

  async update(id: string, dto: UpdateLossReasonDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findExisting(id, ctx);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw this.badRequest('productionLossReason.parentCycle');
      if (dto.parentId) {
        const parent = await this.prisma.operationalLossReason.findFirst({
          where: { id: dto.parentId, ...this.tenantWhere(ctx), deletedAt: null },
        });
        if (!parent) throw this.badRequest('productionLossReason.parentNotFound');
        await this.assertNoParentCycle(id, dto.parentId, ctx);
      }
    }

    const data: Prisma.OperationalLossReasonUncheckedUpdateInput = {
      nameAr: dto.nameAr,
      nameEn: dto.nameEn,
      description: dto.description,
      parentId: dto.parentId === null ? null : dto.parentId,
      lossCategory: dto.lossCategory,
      plannedDefault: dto.plannedDefault,
      severityDefault: dto.severityDefault === null ? null : dto.severityDefault,
      maintenanceRequestPolicy: dto.maintenanceRequestPolicy,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      effectiveTo: dto.effectiveTo === null ? null : dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      status: dto.status,
      updatedById: userId,
    };

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo === null ? null : dto.effectiveTo ? new Date(dto.effectiveTo) : existing.effectiveTo;
    if (effectiveTo && effectiveFrom && effectiveTo <= effectiveFrom) {
      throw this.badRequest('productionLossReason.effectiveRangeInvalid');
    }

    const updated = await this.prisma.operationalLossReason.update({ where: { id }, data, include: reasonInclude });
    await this.audit.log(userId, 'UPDATE', LOSS_REASON_AUDIT_ENTITY, id, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      changes: dto,
    });
    return updated;
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.setStatus(id, 'ACTIVE', userId, ctx);
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.setStatus(id, 'INACTIVE', userId, ctx);
  }

  private async setStatus(id: string, status: string, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findExisting(id, ctx);
    if (existing.status === status) {
      throw this.badRequest('productionLossReason.alreadyStatus');
    }
    if (status === 'ACTIVE') {
      const now = new Date();
      if (existing.effectiveFrom && existing.effectiveFrom > now) {
        throw this.badRequest('productionLossReason.cannotActivate');
      }
      if (existing.effectiveTo && existing.effectiveTo <= now) {
        throw this.badRequest('productionLossReason.cannotActivate');
      }
      if (existing.parentId) {
        const parent = await this.prisma.operationalLossReason.findFirst({
          where: { id: existing.parentId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        });
        if (!parent || parent.status !== LOSS_REASON_ACTIVE_STATUS) {
          throw this.badRequest('productionLossReason.inactiveParent');
        }
      }
    }
    const updated = await this.prisma.operationalLossReason.update({
      where: { id },
      data: { status, updatedById: userId },
      include: reasonInclude,
    });
    await this.audit.log(userId, status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE', LOSS_REASON_AUDIT_ENTITY, id, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fromStatus: existing.status,
      toStatus: status,
    });
    return updated;
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    const existing = await this.findExisting(id, ctx);
    const [segmentCount, eventCount, childCount] = await Promise.all([
      this.prisma.downtimeSegment.count({ where: { reasonId: id, companyId: ctx.companyId, branchId: ctx.branchId } }),
      this.prisma.productionLossQuantityEvent.count({ where: { reasonId: id, companyId: ctx.companyId, branchId: ctx.branchId } }),
      this.prisma.operationalLossReason.count({ where: { parentId: id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null } }),
    ]);
    if (segmentCount > 0 || eventCount > 0 || childCount > 0) {
      throw this.badRequest('productionLossReason.referencedInUse');
    }
    const removed = await this.prisma.operationalLossReason.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE', updatedById: userId },
      include: reasonInclude,
    });
    await this.audit.log(userId, 'DELETE', LOSS_REASON_AUDIT_ENTITY, id, {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      code: existing.code,
    });
    return { id: removed.id, code: removed.code, deletedAt: removed.deletedAt };
  }

  async listActive(ctx: ActiveOperationalContext, search?: string, category?: string) {
    const now = new Date();
    const where: any = {
      ...this.tenantWhere(ctx),
      status: LOSS_REASON_ACTIVE_STATUS,
      deletedAt: null,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    };
    if (category) where.lossCategory = category;
    if (search) {
      where.AND = [
        { OR: [
          { code: { contains: search } },
          { nameAr: { contains: search } },
          { nameEn: { contains: search } },
        ] },
      ];
    }
    return this.prisma.operationalLossReason.findMany({
      where,
      orderBy: [{ lossCategory: 'asc' }, { code: 'asc' }],
      select: {
        id: true, code: true, nameAr: true, nameEn: true, description: true,
        lossCategory: true, plannedDefault: true, severityDefault: true,
        maintenanceRequestPolicy: true, effectiveFrom: true, effectiveTo: true,
        status: true, parentId: true,
      },
    });
  }

  private async findExisting(id: string, ctx: ActiveOperationalContext) {
    const reason = await this.prisma.operationalLossReason.findFirst({
      where: { id, ...this.tenantWhere(ctx), deletedAt: null },
    });
    if (!reason) throw this.notFound();
    return reason;
  }

  private async assertNoParentCycle(id: string, parentId: string, ctx: ActiveOperationalContext): Promise<void> {
    let current: string | null = parentId;
    const seen = new Set<string>();
    while (current) {
      if (current === id) throw this.badRequest('productionLossReason.parentCycle');
      if (seen.has(current)) throw this.badRequest('productionLossReason.parentCycle');
      seen.add(current);
      const node: { parentId: string | null } | null = await this.prisma.operationalLossReason.findFirst({
        where: { id: current, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { parentId: true },
      });
      current = node?.parentId ?? null;
    }
  }
}
