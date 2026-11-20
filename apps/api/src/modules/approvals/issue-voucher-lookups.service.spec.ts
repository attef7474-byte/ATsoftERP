import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { IssueVoucherLookupsService } from './issue-voucher-lookups.service';
import { IssueCandidateQueryDto, IssueVoucherQueryDto } from './dto/issue-voucher-query.dto';
import { assertIssueStockSelection, IssueType, issueProductScope, ISSUE_TYPES, issueWarehouseScopeForType, normalizeIssueTypeInput } from './issue-selection.policy';
const ctx: any = {
  companyId: 'company-a',
  branchId: 'branch-a'
};
const permissions: Record<IssueType, string> = {
  SPARE_PART: 'maintenance-request-parts',
  RAW_MATERIAL: 'production-material-document',
  FINISHED_GOOD: 'finished-goods-issue',
  PACKAGING_MATERIAL: 'general-inventory-issue',
  CONSUMABLE: 'general-inventory-issue',
  GENERAL: 'general-inventory-issue'
};
function fixture(type: IssueType = 'FINISHED_GOOD') {
  const prisma: any = {
    userRole: {
      findMany: jest.fn().mockResolvedValue([{
        role: {
          status: 'ACTIVE',
          code: 'OPERATOR',
          permissions: [{
            permission: {
              status: 'ACTIVE',
              key: `${permissions[type]}:create`
            }
          }]
        }
      }])
    },
    warehouse: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'warehouse-a',
        warehouseType: null
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    warehouseLocation: {
      findFirst: jest.fn().mockResolvedValue(null)
    },
    productionOrder: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'order-a'
      })
    },
    productionRun: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'run-a'
      })
    },
    product: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'product-a',
        unit: 'KG'
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    sparePart: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    inventoryBalance: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'balance-a'
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          quantity: null,
          quantityBase: null
        }
      })
    }
  };
  return {
    prisma,
    service: new IssueVoucherLookupsService(prisma),
    query: {
      type,
      warehouseId: 'warehouse-a',
      productionOrderId: 'order-a',
      productionRunId: 'run-a',
      page: 1,
      limit: 10
    } as IssueCandidateQueryDto
  };
}
describe('issue voucher scoped lookups', () => {
  it.each(ISSUE_TYPES)('%s requires a selected warehouse without requiring a balance row', async type => {
    const {
      prisma,
      service,
      query
    } = fixture(type);
    await service.candidates(query, 'operator', ctx);
    const model = type === 'SPARE_PART' ? prisma.sparePart : prisma.product;
    const where = model.findMany.mock.calls[0][0].where;
    const product = type === 'SPARE_PART' ? where.product : where;
    // Catalog eligibility is no longer an EXISTS-over-balances predicate.
    expect(product.balances).toBeUndefined();
    expect(prisma.inventoryBalance.findMany).not.toHaveBeenCalled();
    expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'warehouse-a',
        companyId: 'company-a',
        OR: [{
          branchId: 'branch-a'
        }, {
          branchId: null
        }]
      })
    });
    expect(model.findMany.mock.calls[0][0]).toMatchObject({
      take: 10,
      skip: 0
    });
    expect(product.status).toBe('ACTIVE');
    expect(product.deletedAt).toBeNull();
  });
  it('uses canonical spare-part / finished-product / order requirement relationships', () => {
    expect(issueProductScope('SPARE_PART', 'w', ctx)).toMatchObject({
      spareParts: {
        some: {
          status: 'ACTIVE',
          deletedAt: null
        }
      }
    });
    expect(issueProductScope('FINISHED_GOOD', 'w', ctx)).toMatchObject({
      productionDefinitions: {
        some: {
          companyId: 'company-a',
          branchId: 'branch-a',
          status: 'ACTIVE',
          deletedAt: null
        }
      }
    });
    expect(issueProductScope('RAW_MATERIAL', 'w', ctx, 'order-a')).toMatchObject({
      requirementLines: {
        some: {
          OR: [{
            warehouseId: 'w'
          }, {
            warehouseId: null
          }],
          requirement: {
            productionOrderId: 'order-a'
          }
        }
      }
    });
  });
  it.each(['PACKAGING_MATERIAL', 'CONSUMABLE', 'GENERAL'] as IssueType[])('enforces the exact %s item type for general issue candidates', type => {
    expect(issueProductScope(type, 'w', ctx, 'order-a')).toMatchObject({
      status: 'ACTIVE',
      deletedAt: null,
      itemType: type
    });
    expect(issueProductScope(type, 'w', ctx, 'order-a').requirementLines).toBeUndefined();
  });
  it('filters warehouses by the exact issue-type item classification and tenant', () => {
    for (const type of ISSUE_TYPES) {
      const scope: any = issueWarehouseScopeForType(type, ctx);
      expect(scope).toMatchObject({ companyId: 'company-a', status: 'ACTIVE', deletedAt: null });
      const eligibility: any = scope.AND[0];
      const balanceProduct = eligibility.balances?.some?.product ?? eligibility.OR?.[0]?.balances?.some?.product;
      expect(balanceProduct).toMatchObject({ itemType: type, status: 'ACTIVE', deletedAt: null });
    }
  });
  it('accepts the legacy plural input alias but always emits the canonical singular type', async () => {
    expect(normalizeIssueTypeInput('FINISHED_GOODS')).toBe('FINISHED_GOOD');
    expect(normalizeIssueTypeInput('FINISHED_GOOD')).toBe('FINISHED_GOOD');
    expect(normalizeIssueTypeInput('UNKNOWN')).toBeUndefined();
    const { service, query } = fixture();
    await expect(service.warehouses({ ...query, type: 'FINISHED_GOODS' } as any, 'operator', ctx)).resolves.toBeDefined();
  });
  it('supports the all-types warehouse F9 with only the user-authorized eligibility union', async () => {
    const { prisma, service, query } = fixture('FINISHED_GOOD');
    await service.warehouses({ ...query, type: undefined } as any, 'operator', ctx);
    const where: any = prisma.warehouse.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ companyId: 'company-a', status: 'ACTIVE', deletedAt: null });
    expect(where.AND).toHaveLength(1);
    expect(where.AND[0].OR).toHaveLength(1);
    expect(where.AND[0].OR[0].OR[0].balances.some.product).toMatchObject({
      status: 'ACTIVE',
      deletedAt: null,
      itemType: 'FINISHED_GOOD'
    });
  });
  it('denies the all-types warehouse F9 when the user has no issue authority', async () => {
    const { prisma, service, query } = fixture('FINISHED_GOOD');
    prisma.userRole.findMany.mockResolvedValue([{
      role: {
        status: 'ACTIVE',
        code: 'OTHER',
        permissions: [{ permission: { status: 'ACTIVE', key: 'inventory:read' } }]
      }
    }]);
    await expect(service.warehouses({ ...query, type: undefined } as any, 'operator', ctx)).rejects.toThrow(ForbiddenException);
    expect(prisma.warehouse.findMany).not.toHaveBeenCalled();
  });
  it('returns a spare-part catalog candidate even when no inventory balance row exists', async () => {
    const {
      prisma,
      service,
      query
    } = fixture('SPARE_PART');
    const candidate = { id: 'sp1', code: 'SP001', name: 'Bearing', unit: 'PCS', productId: 'product-a', product: { unit: 'PCS' } };
    prisma.sparePart.findMany.mockResolvedValue([candidate]);
    prisma.sparePart.count.mockResolvedValue(1);
    prisma.inventoryBalance.findMany.mockResolvedValue([]);
    prisma.inventoryBalance.count.mockResolvedValue(0);

    const result = await service.candidates(query, 'operator', ctx);

    expect(result.data).toEqual([candidate]);
    expect(result.meta.total).toBe(1);
    const where = prisma.sparePart.findMany.mock.calls[0][0].where;
    expect(where.product.balances).toBeUndefined();
    expect(where.product.spareParts).toMatchObject({ some: { status: 'ACTIVE', deletedAt: null } });
  });
  it('returns a finished-goods catalog candidate even when no inventory balance row exists', async () => {
    const {
      prisma,
      service,
      query
    } = fixture('FINISHED_GOOD');
    const candidate = { id: 'product-a', code: 'FG001', name: 'Carton', unit: 'PCS', uoms: [] };
    prisma.product.findMany.mockResolvedValue([candidate]);
    prisma.product.count.mockResolvedValue(1);
    prisma.inventoryBalance.findMany.mockResolvedValue([]);
    prisma.inventoryBalance.count.mockResolvedValue(0);

    const result = await service.candidates(query, 'operator', ctx);

    expect(result.data).toEqual([candidate]);
    expect(result.meta.total).toBe(1);
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.balances).toBeUndefined();
    expect(where.productionDefinitions).toMatchObject({
      some: { companyId: 'company-a', branchId: 'branch-a', status: 'ACTIVE', deletedAt: null }
    });
  });
  it('excludes cross-tenant and cross-branch candidates from the catalog scope', async () => {
    const {
      prisma,
      service,
      query
    } = fixture('FINISHED_GOOD');
    await service.candidates(query, 'operator', ctx);
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.productionDefinitions.some).toMatchObject({ companyId: 'company-a', branchId: 'branch-a' });
    expect(JSON.stringify(where)).not.toContain('company-b');
    expect(JSON.stringify(where)).not.toContain('branch-b');
    expect(prisma.warehouse.findFirst.mock.calls[0][0].where).toMatchObject({ companyId: 'company-a' });
  });
  it('still requires a production order for raw materials', async () => {
    expect(() => issueProductScope('RAW_MATERIAL', 'w', ctx)).toThrow(BadRequestException);
    const {
      prisma,
      service,
      query
    } = fixture('RAW_MATERIAL');
    prisma.productionOrder.findFirst.mockResolvedValue(null);
    await expect(service.candidates(query, 'operator', ctx)).rejects.toThrow(BadRequestException);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });
  it('accepts spare-part-issue permissions for spare-part lookups', async () => {
    const {
      prisma,
      service,
      query
    } = fixture('SPARE_PART');
    prisma.userRole.findMany.mockResolvedValue([{
      role: {
        status: 'ACTIVE',
        code: 'WAREHOUSE',
        permissions: [{ permission: { status: 'ACTIVE', key: 'spare-part-issue:read' } }]
      }
    }]);
    await expect(service.candidates(query, 'operator', ctx)).resolves.toBeDefined();
    expect(prisma.sparePart.findMany).toHaveBeenCalled();
  });
  it.each(ISSUE_TYPES)('%s denies another domain permission', async type => {
    const {
      prisma,
      service,
      query
    } = fixture(type);
    prisma.userRole.findMany.mockResolvedValue([{
      role: {
        status: 'ACTIVE',
        code: 'OTHER',
        permissions: [{
          permission: {
            status: 'ACTIVE',
            key: 'inventory:read'
          }
        }]
      }
    }]);
    await expect(service.candidates(query, 'operator', ctx)).rejects.toThrow(ForbiddenException);
    expect(prisma.warehouse.findFirst).not.toHaveBeenCalled();
  });
  it.each(['company-b', 'branch-b'])('rejects an out-of-context warehouse %s before any products are queried', async () => {
    const {
      prisma,
      service,
      query
    } = fixture();
    prisma.warehouse.findFirst.mockResolvedValue(null);
    await expect(service.candidates(query, 'operator', ctx)).rejects.toThrow(BadRequestException);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });
  it('rejects a run from a different order', async () => {
    const {
      prisma,
      service,
      query
    } = fixture('RAW_MATERIAL');
    prisma.productionRun.findFirst.mockResolvedValue(null);
    await expect(service.candidates(query, 'operator', ctx)).rejects.toThrow(BadRequestException);
    expect(prisma.productionRun.findFirst.mock.calls[0][0].where).toEqual({
      id: 'run-a',
      productionOrderId: 'order-a',
      companyId: 'company-a',
      branchId: 'branch-a',
      deletedAt: null
    });
  });
  it('rejects location B under warehouse A on the backend', async () => {
    const {
      prisma,
      service,
      query
    } = fixture();
    await expect(service.stock({
      ...query,
      productId: 'product-a',
      locationId: 'location-b'
    }, 'operator', ctx)).rejects.toThrow(BadRequestException);
    expect(prisma.warehouseLocation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'location-b',
        warehouseId: 'warehouse-a',
        status: 'ACTIVE'
      }
    });
    expect(prisma.inventoryBalance.findMany).not.toHaveBeenCalled();
  });
  it('sums base and legacy balances without losing either representation', async () => {
    const {
      prisma,
      service,
      query
    } = fixture();
    prisma.inventoryBalance.aggregate.mockResolvedValueOnce({
      _sum: {
        quantityBase: '12.25'
      }
    }).mockResolvedValueOnce({
      _sum: {
        quantity: 3.5
      }
    });
    const result = await service.stock({
      ...query,
      productId: 'product-a'
    }, 'operator', ctx);
    expect(result.available).toBe('15.75');
  });
  it('reports available 0 with no balance rows while still enforcing active catalog eligibility', async () => {
    const {
      prisma,
      service,
      query
    } = fixture();
    prisma.inventoryBalance.findMany.mockResolvedValue([]);
    prisma.inventoryBalance.count.mockResolvedValue(0);

    const result = await service.stock({ ...query, productId: 'product-a' }, 'operator', ctx);
    expect(result.available).toBe('0');
    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);

    prisma.product.findFirst.mockResolvedValue(null);
    await expect(service.stock({ ...query, productId: 'product-a' }, 'operator', ctx)).rejects.toThrow(BadRequestException);
  });
  it('queries stock identities by warehouse, product, location and batch and excludes consumed serials', async () => {
    const {
      prisma,
      service,
      query
    } = fixture();
    prisma.warehouseLocation.findFirst.mockResolvedValue({
      id: 'location-a'
    });
    await service.stock({
      ...query,
      productId: 'product-a',
      locationId: 'location-a',
      batchNumber: 'lot-a'
    }, 'operator', ctx);
    expect(prisma.inventoryBalance.findMany.mock.calls[0][0].where).toMatchObject({
      warehouseId: 'warehouse-a',
      productId: 'product-a',
      locationId: 'location-a',
      batchNumber: 'lot-a',
      AND: [{
        OR: [{
          serialNumber: null
        }, {
          serialNumber: ''
        }, {
          quantity: {
            gt: 0
          }
        }]
      }]
    });
  });
  it('rejects manipulated stock identity detail IDs', async () => {
    const {
      prisma,
      service,
      query
    } = fixture();
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);
    await expect(service.stockIdentity('balance-b', {
      ...query,
      productId: 'product-a'
    }, 'operator', ctx)).rejects.toThrow(BadRequestException);
    expect(prisma.inventoryBalance.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'balance-b',
      warehouseId: 'warehouse-a',
      productId: 'product-a',
      warehouse: {
        companyId: 'company-a'
      }
    });
  });
  it('rejects an issued serial balance but accepts an available serial balance', async () => {
    const {
      prisma,
      service,
      query
    } = fixture();
    prisma.inventoryBalance.findFirst.mockResolvedValue({
      id: 'balance-a',
      serialNumber: 'serial-a',
      quantity: 0
    });
    await expect(service.stockIdentity('balance-a', {
      ...query,
      productId: 'product-a',
      serialNumber: 'serial-a'
    }, 'operator', ctx)).rejects.toThrow(BadRequestException);
    prisma.inventoryBalance.findFirst.mockResolvedValue({
      id: 'balance-a',
      serialNumber: 'serial-a',
      quantity: 1
    });
    await expect(service.stockIdentity('balance-a', {
      ...query,
      productId: 'product-a',
      serialNumber: 'serial-a'
    }, 'operator', ctx)).resolves.toMatchObject({
      id: 'balance-a'
    });
  });
  it('accepts a missing balance row and still rejects an issued serial', async () => {
    const {
      prisma
    } = fixture();
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);
    await expect(assertIssueStockSelection(prisma, 'warehouse-a', 'product-a', ctx, {
      serialNumber: 'unseen-serial'
    })).resolves.toBeUndefined();
    expect(prisma.inventoryBalance.findFirst.mock.calls[0][0].where).toMatchObject({
      warehouseId: 'warehouse-a',
      productId: 'product-a',
      serialNumber: 'unseen-serial'
    });
    expect(prisma.inventoryBalance.findFirst.mock.calls[0][0].where.quantity).toBeUndefined();
    prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'balance-a', serialNumber: 'issued-serial', quantity: 0 });
    await expect(assertIssueStockSelection(prisma, 'warehouse-a', 'product-a', ctx, {
      serialNumber: 'issued-serial'
    })).rejects.toThrow(BadRequestException);
    prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'balance-a', serialNumber: 'available-serial', quantity: 1 });
    await expect(assertIssueStockSelection(prisma, 'warehouse-a', 'product-a', ctx, {
      serialNumber: 'available-serial'
    })).resolves.toBeUndefined();
  });
  it('fails closed without active tenant context', async () => {
    const {
      service,
      query
    } = fixture();
    await expect(service.candidates(query, 'operator', {} as any)).rejects.toThrow(BadRequestException);
  });
  it('validates page bounds, required warehouse/type and rejects unknown query fields', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    });
    for (const value of [{
      type: 'UNKNOWN_TYPE'
    }, {
      type: 'OTHER',
      warehouseId: 'a'
    }, {
      type: 'SPARE_PART',
      warehouseId: 'a',
      companyId: 'other'
    }]) {
      await expect(pipe.transform(value, {
        type: 'query',
        metatype: IssueCandidateQueryDto
      })).rejects.toThrow(BadRequestException);
    }
    await expect(pipe.transform({
      page: '-1'
    }, {
      type: 'query',
      metatype: IssueVoucherQueryDto
    })).rejects.toThrow(BadRequestException);
  });
});
