import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InventoryLedgerReconciliationService } from './inventory-ledger-reconciliation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Inventory Ledger & Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryLedgerReconciliationController {
  constructor(private service: InventoryLedgerReconciliationService) {}

  // ── Ledger ──────────────────────────────────────────────────────

  @Get('ledger/movements')
  @Permissions('inventory-ledger:read')
  @ApiOperation({ summary: 'List ledger movements with all filters' })
  findAllLedgerMovements(
    @Query() query: any,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findAllLedgerMovements(query, ctx);
  }

  @Get('ledger/movements/:id')
  @Permissions('inventory-ledger:read')
  @ApiOperation({ summary: 'Get ledger movement detail' })
  findLedgerMovement(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findLedgerMovement(id, ctx);
  }

  @Get('ledger/by-product')
  @Permissions('inventory-ledger:read')
  @ApiOperation({ summary: 'Get ledger movements by product' })
  @ApiQuery({ name: 'productId', required: true, type: String })
  findByProduct(
    @Query() query: { productId: string; page?: number; limit?: number },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    if (!query.productId) {
      throw new BadRequestException('productId query parameter is required');
    }
    return this.service.findByProduct(query.productId, query, ctx);
  }

  @Get('ledger/by-warehouse')
  @Permissions('inventory-ledger:read')
  @ApiOperation({ summary: 'Get ledger movements by warehouse' })
  @ApiQuery({ name: 'warehouseId', required: true, type: String })
  findByWarehouse(
    @Query() query: { warehouseId: string; page?: number; limit?: number },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    if (!query.warehouseId) {
      throw new BadRequestException('warehouseId query parameter is required');
    }
    return this.service.findByWarehouse(query.warehouseId, query, ctx);
  }

  @Get('ledger/by-location/:locationId')
  @Permissions('inventory-ledger:read')
  @ApiOperation({ summary: 'Get ledger movements by location' })
  findByLocation(
    @Param('locationId') locationId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findByLocation(locationId, ctx);
  }

  @Get('ledger/by-source')
  @Permissions('inventory-ledger:read')
  @ApiOperation({ summary: 'Get ledger movements by source type and ID' })
  @ApiQuery({ name: 'sourceType', required: true, type: String })
  @ApiQuery({ name: 'sourceId', required: true, type: String })
  findBySource(
    @Query() query: { sourceType: string; sourceId: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    if (!query.sourceType || !query.sourceId) {
      throw new BadRequestException(
        'sourceType and sourceId query parameters are required',
      );
    }
    return this.service.findBySource(query.sourceType, query.sourceId, ctx);
  }

  // ── Reconciliation ──────────────────────────────────────────────

  @Get('reconciliation/summary')
  @Permissions('inventory-reconciliation:read')
  @ApiOperation({ summary: 'Get reconciliation summary' })
  reconciliationSummary(
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reconciliationSummary(ctx);
  }

  @Get('reconciliation/details')
  @Permissions('inventory-reconciliation:read')
  @ApiOperation({ summary: 'Get reconciliation detail lines' })
  reconciliationDetails(
    @Query() query: any,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reconciliationDetails(query, ctx);
  }

  @Get('reconciliation/by-product/:productId')
  @Permissions('inventory-reconciliation:read')
  @ApiOperation({ summary: 'Get reconciliation for a product' })
  reconciliationByProduct(
    @Param('productId') productId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reconciliationByProduct(productId, ctx);
  }

  @Get('reconciliation/by-warehouse/:warehouseId')
  @Permissions('inventory-reconciliation:read')
  @ApiOperation({ summary: 'Get reconciliation for a warehouse' })
  reconciliationByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reconciliationByWarehouse(warehouseId, ctx);
  }

  @Get('reconciliation/differences')
  @Permissions('inventory-reconciliation:read')
  @ApiOperation({ summary: 'Get reconciliation differences only' })
  reconciliationDifferences(
    @Query() query: any,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reconciliationDifferences(query, ctx);
  }

  @Get('reconciliation/orphans')
  @Permissions('inventory-reconciliation:read')
  @ApiOperation({ summary: 'Get orphan movements and balances' })
  reconciliationOrphans(
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reconciliationOrphans(ctx);
  }

  @Get('reconciliation/negative-balances')
  @Permissions('inventory-reconciliation:read')
  @ApiOperation({ summary: 'Get negative balances' })
  reconciliationNegativeBalances(
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.reconciliationNegativeBalances(ctx);
  }
}
