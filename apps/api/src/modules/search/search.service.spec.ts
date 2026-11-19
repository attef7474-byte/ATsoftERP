import { BadRequestException } from '@nestjs/common';
import { EntityType } from './dto/search-query.dto';
import { SearchService } from './search.service';

/** Phase 1: F9 / unified-search backend item-type filtering. */
describe('SearchService product itemType filter', () => {
  const ctx = { companyId: 'c1', branchId: 'b1' } as any;
  let prisma: any;
  let service: SearchService;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new SearchService(prisma);
  });

  it('filters product lookups by a single item type', async () => {
    await service.searchEntity(EntityType.PRODUCT, 'steel', ctx, 1, 20, { itemType: 'RAW_MATERIAL' } as any);
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"itemType":"RAW_MATERIAL"');
  });

  it('filters product lookups by multiple item types', async () => {
    await service.searchEntity(EntityType.PRODUCT, 'pack', ctx, 1, 20, {
      itemTypes: 'RAW_MATERIAL,PACKAGING_MATERIAL',
    } as any);
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"in":["RAW_MATERIAL","PACKAGING_MATERIAL"]');
  });

  it('does not constrain itemType when no filter is supplied', async () => {
    await service.searchEntity(EntityType.PRODUCT, 'steel', ctx, 1, 20, {});
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain('itemType');
  });

  it('rejects an unsupported item type with a stable error key', async () => {
    await expect(
      service.searchEntity(EntityType.PRODUCT, 'x', ctx, 1, 20, { itemType: 'NOPE' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });
});
