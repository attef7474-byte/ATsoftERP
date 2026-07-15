import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryBalancesService } from './inventory-balances.service';
import { InventoryBalanceQueryDto } from './dto/inventory-balance-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Inventory Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventorySummaryController {
  constructor(private service: InventoryBalancesService) {}

  @Get('summary/balances')
  @Permissions('inventory-balance:read')
  @ApiOperation({ summary: 'Get inventory balance summary' })
  getBalanceSummary() { return this.service.getBalanceSummary(); }

  @Get('summary/counts')
  @Permissions('inventory-count:read')
  @ApiOperation({ summary: 'Get inventory count summary' })
  getCountSummary() { return this.service.getCountSummary(); }

  @Get('summary/movements')
  @Permissions('inventory-movement:read')
  @ApiOperation({ summary: 'Get inventory movement summary' })
  getMovementSummary() { return this.service.getMovementSummary(); }

  @Get('summary/adjustments')
  @Permissions('inventory-adjustment:read')
  @ApiOperation({ summary: 'Get inventory adjustment summary' })
  getAdjustmentSummary() { return this.service.getAdjustmentSummary(); }
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
  findAll(@Query() query: InventoryBalanceQueryDto) {
    return this.service.findAll(query);
  }

  @Get('product/:productId')
  @Permissions('inventory-balance:read')
  @ApiOperation({ summary: 'Get balance for a product across warehouses' })
  findByProduct(@Param('productId') productId: string) {
    return this.service.findByProduct(productId);
  }

  @Post('recalculate')
  @Permissions('inventory-balance:recalculate')
  @ApiOperation({ summary: 'Recalculate all inventory balances from movements and adjustments' })
  recalculate(@CurrentUser('id') userId: string) {
    return this.service.recalculate(userId);
  }
}
