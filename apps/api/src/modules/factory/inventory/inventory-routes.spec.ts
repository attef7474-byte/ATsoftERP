import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryCountsController } from '../inventory-counts/inventory-counts.controller';
import { InventoryCountsService } from '../inventory-counts/inventory-counts.service';
import { InventoryAdjustmentsController, InventoryAdjustmentCountsController } from '../inventory-adjustments/inventory-adjustments.controller';
import { InventoryAdjustmentsService } from '../inventory-adjustments/inventory-adjustments.service';
import { InventoryBalancesController } from '../inventory-balances/inventory-balances.controller';
import { InventoryBalancesService } from '../inventory-balances/inventory-balances.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard';

describe('Inventory route registration (collision regression)', () => {
  let app: INestApplication;

  const collectRoutes = () => {
    const adapter: any = app.getHttpAdapter();
    const expressApp: any = adapter.getInstance();
    const stack: any[] | undefined = expressApp?.router?.stack ?? expressApp?._router?.stack;
    if (!stack) {
      throw new Error(
        `Router stack not found. Adapter=${adapter.constructor.name} instanceKeys=${expressApp ? Object.keys(expressApp).slice(0, 15).join(',') : 'null'}`,
      );
    }
    return stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: String(layer.route.path).replace(/\/+$/, ''),
        methods: Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]),
      }));
  };

  const routesFor = (path: string, method: string) =>
    collectRoutes().filter((r) => r.path === path && r.methods.includes(method));

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        InventoryController,
        InventoryCountsController,
        InventoryAdjustmentsController,
        InventoryAdjustmentCountsController,
        InventoryBalancesController,
      ],
      providers: [
        { provide: InventoryService, useValue: {} },
        { provide: InventoryCountsService, useValue: {} },
        { provide: InventoryAdjustmentsService, useValue: {} },
        { provide: InventoryBalancesService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InventoryLockGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers exactly one POST /inventory/adjustments handler (modern adjustment create)', () => {
    expect(routesFor('/inventory/adjustments', 'post')).toHaveLength(1);
  });

  it('registers exactly one GET /inventory/balances handler (modern balances list)', () => {
    expect(routesFor('/inventory/balances', 'get')).toHaveLength(1);
  });

  it('registers no legacy POST /inventory/adjustments/from-count/:countId handler', () => {
    expect(routesFor('/inventory/adjustments/from-count/:countId', 'post')).toHaveLength(0);
  });

  it('keeps the canonical generate-adjustment handler on inventory/counts', () => {
    expect(routesFor('/inventory/counts/:countId/generate-adjustment', 'post')).toHaveLength(1);
  });

  it('does not resolve inventory/counts routes to adjustment handlers', () => {
    expect(routesFor('/inventory/counts', 'get')).toHaveLength(1);
    expect(routesFor('/inventory/counts', 'post')).toHaveLength(1);
  });

  it('keeps the adjustment line routes unique under the adjustments prefix', () => {
    expect(routesFor('/inventory/adjustments/:id/lines', 'post')).toHaveLength(1);
    expect(routesFor('/inventory/adjustments/:id/summary', 'get')).toHaveLength(1);
  });

  it('keeps balances sub-routes unique under the balances prefix', () => {
    expect(routesFor('/inventory/balances/product/:productId', 'get')).toHaveLength(1);
    expect(routesFor('/inventory/balances/recalculate', 'post')).toHaveLength(1);
  });
});
