import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryBalancesService } from './inventory-balances.service';
import { InventoryBalanceQueryDto } from './dto/inventory-balance-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Inventory Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventorySummaryController {
  constructor(private service: InventoryBalancesService) {}

  @Get('summary/balances')
  @Permissions('inventory-balance:read')
  @ApiOperation({ summary: 'Get inventory balance summary' })
  getBalanceSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getBalanceSummary(ctx); }

  @Get('summary/counts')
  @Permissions('inventory-count:read')
  @ApiOperation({ summary: 'Get inventory count summary' })
  getCountSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getCountSummary(ctx); }

  @Get('summary/movements')
  @Permissions('inventory-movement:read')
  @ApiOperation({ summary: 'Get inventory movement summary' })
  getMovementSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMovementSummary(ctx); }

  @Get('summary/adjustments')
  @Permissions('inventory-adjustment:read')
  @ApiOperation({ summary: 'Get inventory adjustment summary' })
  getAdjustmentSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getAdjustmentSummary(ctx); }
}

@ApiTags('Inventory Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/balances', version: '1' })
export class InventoryBalancesController {
  constructor(private service: InventoryBalancesService) {}

  @Get()
  @Permissions('inventory-balance:read')
  @ApiOperation({ summary: 'List inventory balances' })
  findAll(@Query() query: InventoryBalanceQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('inventory-balance:read')
  @ApiOperation({ summary: 'Get balance by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Get('product/:productId')
  @Permissions('inventory-balance:read')
  @ApiOperation({ summary: 'Get balance for a product across warehouses' })
  findByProduct(@Param('productId') productId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findByProduct(productId, ctx);
  }

  @Get('by-location/:locationId')
  @Permissions('inventory-balance:read')
  @ApiOperation({ summary: 'Get balances by location' })
  findByLocation(@Param('locationId') locationId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findByLocation(locationId, ctx);
  }

  @Post('recalculate')
  @Permissions('inventory-balance:recalculate')
  @ApiOperation({ summary: 'Recalculate all inventory balances from movements and adjustments' })
  recalculate(@CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.recalculate(userId, ctx);
  }
}
