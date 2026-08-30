import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { CreateOrganizationalUnitDto } from './dto/create-organizational-unit.dto';
import { UpdateOrganizationalUnitDto } from './dto/update-organizational-unit.dto';
import { CurrentUserType } from '../../auth/types/current-user.type';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@Injectable()
export class OrganizationalUnitsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private numberingService: NumberingService,
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

  /** Scope predicate applied to every read/write path (tenant isolation). */
  private scope(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, branchId: ctx.branchId };
  }

  /** Verify an existing unit belongs to the active operational context. */
  private owns(unit: { companyId: string; branchId: string }, ctx: ActiveOperationalContext): boolean {
    return unit.companyId === ctx.companyId && unit.branchId === ctx.branchId;
  }

  private async findOwned(id: string, ctx: ActiveOperationalContext) {
    const unit = await this.prisma.organizationalUnit.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        children: { where: { deletedAt: null }, select: { id: true, name: true, code: true } },
        _count: { select: { children: true } },
      },
    });
    if (!unit || !this.owns(unit, ctx)) {
      throw this.notFound('organization.organizationalUnitNotFound', 'Organizational unit not found');
    }
    return unit;
  }

  private async validateParent(parentId: string | undefined, ctx: ActiveOperationalContext, selfId?: string) {
    if (!parentId) return;
    const parent = await this.prisma.organizationalUnit.findUnique({ where: { id: parentId } });
    if (!parent || !this.owns(parent, ctx)) {
      throw this.validationError('parentId', 'validation.invalidReference', 'Parent unit not found in the active context');
    }
    if (selfId && parentId === selfId) {
      throw this.validationError('parentId', 'validation.invalidReference', 'A unit cannot be its own parent');
    }
    if (selfId && (await this.isDescendant(selfId, parentId, ctx))) {
      throw this.validationError('parentId', 'validation.invalidReference', 'A unit cannot be moved under one of its own children');
    }
  }

  /** true when `candidateAncestorId` is an ancestor (any depth) of `nodeId`. */
  private async isDescendant(nodeId: string, candidateAncestorId: string, ctx: ActiveOperationalContext): Promise<boolean> {
    const all = await this.prisma.organizationalUnit.findMany({
      where: { ...this.scope(ctx), deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const u of all) {
      if (u.parentId) {
        const list = childrenOf.get(u.parentId) ?? [];
        list.push(u.id);
        childrenOf.set(u.parentId, list);
      }
    }
    const stack = [nodeId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = childrenOf.get(current) ?? [];
      for (const child of children) {
        if (child === candidateAncestorId) return true;
        stack.push(child);
      }
    }
    return false;
  }

  async create(dto: CreateOrganizationalUnitDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    await this.validateParent(dto.parentId, ctx);

    const code = dto.code?.trim() || (await this.numberingService.generateNumberAtomic('ORGANIZATIONAL_UNIT'));

    const existing = await this.prisma.organizationalUnit.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, code, deletedAt: null },
    });
    if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Organizational unit code already exists in this branch');

    const unit = await this.prisma.organizationalUnit.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        parentId: dto.parentId ?? null,
        code,
        name: dto.name,
        type: dto.type ?? 'DEPARTMENT',
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
      },
    });

    await this.audit.log(user.id, 'CREATE', 'OrganizationalUnit', unit.id, {
      code: unit.code,
      name: unit.name,
      type: unit.type,
      companyId: unit.companyId,
      branchId: unit.branchId,
      parentId: unit.parentId,
    });

    return unit;
  }

  async findAll(query: {
    page?: number; limit?: number; search?: string;
    type?: string; status?: string; parentId?: string;
  }, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { ...this.scope(ctx), deletedAt: null };
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
      ];
    }
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.parentId) where.parentId = query.parentId;

    const [data, total] = await Promise.all([
      this.prisma.organizationalUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true } },
        },
      }),
      this.prisma.organizationalUnit.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwned(id, ctx);
  }

  async update(id: string, dto: UpdateOrganizationalUnitDto, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const unit = await this.findOwned(id, ctx);

    const parentId = dto.parentId !== undefined ? dto.parentId : unit.parentId ?? undefined;
    await this.validateParent(parentId, ctx, id);

    let code = unit.code;
    if (dto.code?.trim()) {
      code = dto.code.trim();
      const existing = await this.prisma.organizationalUnit.findFirst({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, code, deletedAt: null, NOT: { id } },
      });
      if (existing) throw this.validationError('code', 'validation.duplicateValue', 'Organizational unit code already exists in this branch');
    }

    const updated = await this.prisma.organizationalUnit.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        code,
        parentId: dto.parentId !== undefined ? dto.parentId ?? null : undefined,
        status: dto.status,
      },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
      },
    });

    await this.audit.log(user.id, 'UPDATE', 'OrganizationalUnit', unit.id, {
      code: updated.code,
      name: updated.name,
      type: updated.type,
      status: updated.status,
      parentId: updated.parentId,
      companyId: updated.companyId,
      branchId: updated.branchId,
    });

    return updated;
  }

  async remove(id: string, user: CurrentUserType, ctx: ActiveOperationalContext) {
    const unit = await this.findOwned(id, ctx);

    const activeChildren = await this.prisma.organizationalUnit.count({
      where: { parentId: id, deletedAt: null },
    });
    if (activeChildren > 0) {
      throw this.validationError('parentId', 'validation.hasChildren', 'Cannot delete a unit that still has child units');
    }

    await this.prisma.organizationalUnit.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.log(user.id, 'DELETE', 'OrganizationalUnit', unit.id, {
      code: unit.code,
      name: unit.name,
      companyId: unit.companyId,
      branchId: unit.branchId,
    });

    return { message: 'Organizational unit deleted successfully' };
  }

  async getTree(ctx: ActiveOperationalContext) {
    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
    };
    const units = await this.prisma.organizationalUnit.findMany({
      where,
      include: { children: { where: { deletedAt: null }, select: { id: true, name: true, code: true } } },
    });
    return units.filter((u) => !u.parentId);
  }
}
