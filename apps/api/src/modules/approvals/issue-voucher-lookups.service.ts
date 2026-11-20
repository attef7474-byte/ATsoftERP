import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { IssueCandidateQueryDto, IssueWarehouseQueryDto } from './dto/issue-voucher-query.dto';
import {
  ISSUE_TYPES,
  IssueType,
  issueProductScope,
  issueSelectionError,
  issueWarehouseScope,
  issueWarehouseScopeForType,
  issueWarehouseScopeForTypes,
  LegacyIssueTypeInput,
  normalizeIssueTypeInput,
} from './issue-selection.policy';

const PERMISSIONS: Record<IssueType, string[]> = {
  SPARE_PART: [
    'maintenance-request-parts:read',
    'maintenance-request-parts:create',
    'maintenance-request-parts:update',
    'spare-part-issue:read',
    'spare-part-issue:create',
    'spare-part-issue:update'
  ],
  RAW_MATERIAL: ['production-material-document:read', 'production-material-document:create', 'production-material-document:update'],
  FINISHED_GOOD: ['finished-goods-issue:read', 'finished-goods-issue:create', 'finished-goods-issue:update'],
  PACKAGING_MATERIAL: ['general-inventory-issue:read', 'general-inventory-issue:create', 'general-inventory-issue:update'],
  CONSUMABLE: ['general-inventory-issue:read', 'general-inventory-issue:create', 'general-inventory-issue:update'],
  GENERAL: ['general-inventory-issue:read', 'general-inventory-issue:create', 'general-inventory-issue:update']
};

interface ResolvedIssueQuery<T extends { type?: LegacyIssueTypeInput }> {
  query: T & { type?: IssueType };
  type?: IssueType;
}

@Injectable()
export class IssueVoucherLookupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Legacy `FINISHED_GOODS` is accepted but never used downstream. */
  private resolve<T extends { type?: LegacyIssueTypeInput }>(query: T): ResolvedIssueQuery<T> {
    const type = normalizeIssueTypeInput(query.type);
    return { query: { ...query, type }, type };
  }

  /** Returns the exact issue families the user may use; empty means denied. */
  private async authorizedTypes(type: IssueType | undefined, userId: string): Promise<IssueType[]> {
    const roles = await this.prisma.userRole.findMany({
      where: {
        userId
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });
    const activeRoles = roles.filter(({ role }) => role.status === 'ACTIVE');
    const isSuperAdmin = activeRoles.some(({ role }) => role.code === 'SUPER_ADMIN');
    const keys = new Set(activeRoles.flatMap(({ role }) => role.permissions
      .filter(({ permission }) => permission.status === 'ACTIVE')
      .map(({ permission }) => permission.key)));
    const allowed = ISSUE_TYPES.filter(issueType => isSuperAdmin
      || PERMISSIONS[issueType].some(key => keys.has(key)));
    if (type && !allowed.includes(type)) {
      throw new ForbiddenException({
        messageKey: 'auth.insufficientPermissions'
      });
    }
    if (!type && !allowed.length) {
      throw new ForbiddenException({
        messageKey: 'auth.insufficientPermissions'
      });
    }
    return type ? [type] : allowed;
  }

  private async context(query: IssueCandidateQueryDto & { type?: IssueType }, userId: string, ctx: ActiveOperationalContext) {
    await this.authorizedTypes(query.type, userId);
    if (!query.type) throw issueSelectionError();
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: query.warehouseId,
        ...issueWarehouseScopeForType(query.type, ctx)
      }
    });
    if (!warehouse) throw issueSelectionError();

    if (query.type === 'RAW_MATERIAL') {
      const order = query.productionOrderId && (await this.prisma.productionOrder.findFirst({
        where: {
          id: query.productionOrderId,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          deletedAt: null
        }
      }));
      if (!order) throw issueSelectionError();
      if (query.productionRunId) {
        const run = await this.prisma.productionRun.findFirst({
          where: {
            id: query.productionRunId,
            productionOrderId: order.id,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            deletedAt: null
          }
        });
        if (!run) throw issueSelectionError();
      }
    } else if (query.productionOrderId) {
      // Optional domain context is allowed for other families, but it must
      // still pass tenant/branch validation and may never widen the scope.
      const order = await this.prisma.productionOrder.findFirst({
        where: {
          id: query.productionOrderId,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          deletedAt: null
        }
      });
      if (!order) throw issueSelectionError();
      if (query.productionRunId) {
        const run = await this.prisma.productionRun.findFirst({
          where: {
            id: query.productionRunId,
            productionOrderId: order.id,
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            deletedAt: null
          }
        });
        if (!run) throw issueSelectionError();
      }
    }

    if (query.locationId && !(await this.prisma.warehouseLocation.findFirst({
      where: {
        id: query.locationId,
        warehouseId: warehouse.id,
        status: 'ACTIVE'
      }
    }))) throw issueSelectionError();
    return warehouse;
  }

  async warehouses(query: IssueWarehouseQueryDto, userId: string, ctx: ActiveOperationalContext, id?: string) {
    const resolved = this.resolve(query);
    const allowedTypes = await this.authorizedTypes(resolved.type, userId);
    const where: any = {
      ...(resolved.type
        ? issueWarehouseScopeForType(resolved.type, ctx)
        : issueWarehouseScopeForTypes(allowedTypes, ctx)),
      ...(id ? { id } : {})
    };
    if (resolved.query.search) where.AND = [...(where.AND || []), {
      OR: [{
        code: {
          contains: resolved.query.search
        }
      }, {
        name: {
          contains: resolved.query.search
        }
      }]
    }];
    const select = {
      id: true,
      code: true,
      name: true
    };
    if (id) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where,
        select
      });
      if (!warehouse) throw issueSelectionError();
      return warehouse;
    }
    const [data, total] = await Promise.all([this.prisma.warehouse.findMany({
      where,
      select,
      orderBy: {
        code: 'asc'
      },
      take: resolved.query.limit,
      skip: (resolved.query.page - 1) * resolved.query.limit
    }), this.prisma.warehouse.count({
      where
    })]);
    return {
      data,
      meta: {
        page: resolved.query.page,
        limit: resolved.query.limit,
        total,
        totalPages: Math.ceil(total / resolved.query.limit)
      }
    };
  }

  async locations(query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext, id?: string) {
    const resolved = this.resolve(query);
    await this.context(resolved.query, userId, ctx);
    const where = {
      warehouseId: resolved.query.warehouseId,
      status: 'ACTIVE',
      ...(id ? { id } : {}),
      ...(resolved.query.search ? {
        OR: [{
          code: {
            contains: resolved.query.search
          }
        }, {
          name: {
            contains: resolved.query.search
          }
        }]
      } : {})
    };
    if (id) {
      const location = await this.prisma.warehouseLocation.findFirst({
        where
      });
      if (!location) throw issueSelectionError();
      return location;
    }
    const [data, total] = await Promise.all([this.prisma.warehouseLocation.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true
      },
      orderBy: {
        code: 'asc'
      },
      take: resolved.query.limit,
      skip: (resolved.query.page - 1) * resolved.query.limit
    }), this.prisma.warehouseLocation.count({
      where
    })]);
    return {
      data,
      meta: {
        page: resolved.query.page,
        limit: resolved.query.limit,
        total,
        totalPages: Math.ceil(total / resolved.query.limit)
      }
    };
  }

  async candidates(query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    const resolved = this.resolve(query);
    await this.context(resolved.query, userId, ctx);
    const type = resolved.type!;
    const productWhere = issueProductScope(type, resolved.query.warehouseId, ctx, resolved.query.productionOrderId);
    const search = resolved.query.search?.trim();
    const model = type === 'SPARE_PART' ? this.prisma.sparePart : this.prisma.product;
    const where: any = type === 'SPARE_PART' ? {
      status: 'ACTIVE',
      deletedAt: null,
      product: productWhere
    } : productWhere;
    if (search) where.OR = [{
      code: {
        contains: search
      }
    }, {
      name: {
        contains: search
      }
    }];
    const [data, total] = await Promise.all([(model as any).findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        ...(type === 'SPARE_PART' ? {
          productId: true,
          product: {
            select: {
              unit: true
            }
          }
        } : {
          uoms: {
            where: {
              isActive: true
            },
            include: {
              unit: true
            }
          }
        })
      },
      orderBy: [{
        code: 'asc'
      }, {
        id: 'asc'
      }],
      skip: (resolved.query.page - 1) * resolved.query.limit,
      take: resolved.query.limit
    }), (model as any).count({
      where
    })]);
    return {
      data,
      meta: {
        page: resolved.query.page,
        limit: resolved.query.limit,
        total,
        totalPages: Math.ceil(total / resolved.query.limit)
      }
    };
  }

  async candidate(id: string, query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    const resolved = this.resolve(query);
    await this.context(resolved.query, userId, ctx);
    const type = resolved.type!;
    const productScope = issueProductScope(type, resolved.query.warehouseId, ctx, resolved.query.productionOrderId);
    const include = {
      uoms: {
        where: {
          isActive: true
        },
        include: {
          unit: true
        }
      }
    };
    const item = type === 'SPARE_PART' ? await this.prisma.sparePart.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        deletedAt: null,
        product: productScope
      },
      include: {
        product: {
          include
        }
      }
    }) : await this.prisma.product.findFirst({
      where: {
        id,
        ...productScope
      },
      include
    });
    if (!item) throw issueSelectionError();
    return item;
  }

  async stock(query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    const resolved = this.resolve(query);
    await this.context(resolved.query, userId, ctx);
    if (!resolved.query.productId) throw issueSelectionError();
    const type = resolved.type!;
    const product = await this.prisma.product.findFirst({
      where: {
        id: resolved.query.productId,
        ...issueProductScope(type, resolved.query.warehouseId, ctx, resolved.query.productionOrderId)
      },
      select: {
        id: true,
        unit: true
      }
    });
    if (!product) throw issueSelectionError();
    const where: any = {
      productId: product.id,
      warehouseId: resolved.query.warehouseId,
      warehouse: issueWarehouseScope(ctx)
    };
    if (resolved.query.locationId) where.locationId = resolved.query.locationId;
    if (resolved.query.batchNumber) where.batchNumber = resolved.query.batchNumber;
    if (resolved.query.serialNumber) where.serialNumber = resolved.query.serialNumber;
    where.AND = [{
      OR: [{
        serialNumber: null
      }, {
        serialNumber: ''
      }, {
        quantity: {
          gt: 0
        }
      }]
    }];
    if (resolved.query.search) where.AND.push({
      OR: [{
        batchNumber: {
          contains: resolved.query.search
        }
      }, {
        serialNumber: {
          contains: resolved.query.search
        }
      }, {
        location: {
          name: {
            contains: resolved.query.search
          }
        }
      }]
    });
    const [data, total] = await Promise.all([this.prisma.inventoryBalance.findMany({
      where,
      include: {
        location: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      },
      skip: (resolved.query.page - 1) * resolved.query.limit,
      take: resolved.query.limit
    }), this.prisma.inventoryBalance.count({
      where
    })]);
    // Both shadows are summed separately. Coalescing after SUM would lose legacy rows.
    const [modern, legacy] = await Promise.all([this.prisma.inventoryBalance.aggregate({
      where: {
        ...where,
        quantityBase: {
          not: null
        }
      },
      _sum: {
        quantityBase: true
      }
    }), this.prisma.inventoryBalance.aggregate({
      where: {
        ...where,
        quantityBase: null
      },
      _sum: {
        quantity: true
      }
    })]);
    const available = new Prisma.Decimal(modern._sum.quantityBase ?? 0).plus(legacy._sum.quantity ?? 0).toString();
    return {
      data,
      available,
      unit: product.unit,
      meta: {
        page: resolved.query.page,
        limit: resolved.query.limit,
        total,
        totalPages: Math.ceil(total / resolved.query.limit)
      }
    };
  }

  async stockIdentity(id: string, query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    const resolved = this.resolve(query);
    await this.context(resolved.query, userId, ctx);
    if (!resolved.query.productId) throw issueSelectionError();
    const type = resolved.type!;
    const item = await this.prisma.inventoryBalance.findFirst({
      where: {
        id,
        warehouseId: resolved.query.warehouseId,
        productId: resolved.query.productId,
        warehouse: issueWarehouseScope(ctx),
        product: issueProductScope(type, resolved.query.warehouseId, ctx, resolved.query.productionOrderId),
        ...(resolved.query.locationId ? {
          locationId: resolved.query.locationId
        } : {})
      },
      include: {
        location: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });
    if (!item || item.serialNumber && item.quantity != null && new Prisma.Decimal(item.quantity).lte(0)) throw issueSelectionError();
    return item;
  }
}
