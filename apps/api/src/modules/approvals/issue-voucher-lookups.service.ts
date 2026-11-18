import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { IssueCandidateQueryDto, IssueWarehouseQueryDto } from './dto/issue-voucher-query.dto';
import { issueProductScope, issueSelectionError, issueWarehouseScope } from './issue-selection.policy';
const PERMISSIONS = {
  SPARE_PART: ['maintenance-request-parts:read', 'maintenance-request-parts:create', 'maintenance-request-parts:update'],
  RAW_MATERIAL: ['production-material-document:read', 'production-material-document:create', 'production-material-document:update'],
  FINISHED_GOODS: ['finished-goods-issue:read', 'finished-goods-issue:create', 'finished-goods-issue:update']
};
@Injectable()
export class IssueVoucherLookupsService {
  constructor(private readonly prisma: PrismaService) {}
  private async authorize(type: IssueWarehouseQueryDto['type'], userId: string) {
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
    const allowed = roles.some(({
      role
    }) => role.status === 'ACTIVE' && (role.code === 'SUPER_ADMIN' || role.permissions.some(({
      permission
    }) => permission.status === 'ACTIVE' && (type ? PERMISSIONS[type] : Object.values(PERMISSIONS).flat()).includes(permission.key))));
    if (!allowed) throw new ForbiddenException({
      messageKey: 'auth.insufficientPermissions'
    });
  }
  private async context(query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    await this.authorize(query.type, userId);
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id: query.warehouseId,
        ...issueWarehouseScope(ctx)
      }
    });
    if (!warehouse || query.type === 'SPARE_PART' && ['PRODUCT', 'RAW_MATERIAL'].includes(warehouse.warehouseType ?? '')) throw issueSelectionError();
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
    await this.authorize(query.type, userId);
    const where: any = {
      ...issueWarehouseScope(ctx),
      ...(id ? {
        id
      } : {})
    };
    if (query.type === 'SPARE_PART') where.AND = [{
      OR: [{
        warehouseType: null
      }, {
        warehouseType: {
          notIn: ['PRODUCT', 'RAW_MATERIAL']
        }
      }]
    }];
    if (query.search) where.AND = [...(where.AND || []), {
      OR: [{
        code: {
          contains: query.search
        }
      }, {
        name: {
          contains: query.search
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
      take: query.limit,
      skip: (query.page - 1) * query.limit
    }), this.prisma.warehouse.count({
      where
    })]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }
  async locations(query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext, id?: string) {
    await this.context(query, userId, ctx);
    const where = {
      warehouseId: query.warehouseId,
      status: 'ACTIVE',
      ...(id ? {
        id
      } : {}),
      ...(query.search ? {
        OR: [{
          code: {
            contains: query.search
          }
        }, {
          name: {
            contains: query.search
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
      take: query.limit,
      skip: (query.page - 1) * query.limit
    }), this.prisma.warehouseLocation.count({
      where
    })]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }
  async candidates(query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    await this.context(query, userId, ctx);
    const productWhere = issueProductScope(query.type, query.warehouseId, ctx, query.productionOrderId);
    const search = query.search?.trim();
    const model = query.type === 'SPARE_PART' ? this.prisma.sparePart : this.prisma.product;
    const where: any = query.type === 'SPARE_PART' ? {
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
        ...(query.type === 'SPARE_PART' ? {
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
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }), (model as any).count({
      where
    })]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }
  async candidate(id: string, query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    await this.context(query, userId, ctx);
    const productScope = issueProductScope(query.type, query.warehouseId, ctx, query.productionOrderId);
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
    const item = query.type === 'SPARE_PART' ? await this.prisma.sparePart.findFirst({
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
    await this.context(query, userId, ctx);
    if (!query.productId) throw issueSelectionError();
    const product = await this.prisma.product.findFirst({
      where: {
        id: query.productId,
        ...issueProductScope(query.type, query.warehouseId, ctx, query.productionOrderId)
      },
      select: {
        id: true,
        unit: true
      }
    });
    if (!product) throw issueSelectionError();
    const where: any = {
      productId: product.id,
      warehouseId: query.warehouseId,
      warehouse: issueWarehouseScope(ctx)
    };
    if (query.locationId) where.locationId = query.locationId;
    if (query.batchNumber) where.batchNumber = query.batchNumber;
    if (query.serialNumber) where.serialNumber = query.serialNumber;
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
    if (query.search) where.AND.push({
      OR: [{
        batchNumber: {
          contains: query.search
        }
      }, {
        serialNumber: {
          contains: query.search
        }
      }, {
        location: {
          name: {
            contains: query.search
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
      skip: (query.page - 1) * query.limit,
      take: query.limit
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
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }
  async stockIdentity(id: string, query: IssueCandidateQueryDto, userId: string, ctx: ActiveOperationalContext) {
    await this.context(query, userId, ctx);
    if (!query.productId) throw issueSelectionError();
    const item = await this.prisma.inventoryBalance.findFirst({
      where: {
        id,
        warehouseId: query.warehouseId,
        productId: query.productId,
        warehouse: issueWarehouseScope(ctx),
        product: issueProductScope(query.type, query.warehouseId, ctx, query.productionOrderId),
        ...(query.locationId ? {
          locationId: query.locationId
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
