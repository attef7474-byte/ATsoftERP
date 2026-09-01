import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryValuationService } from './inventory-valuation.service';
import { INVENTORY_VALUATION_PERMISSION_KEYS } from './inventory-valuation.constants';
import { CreateInventoryValuationPolicyDto } from './dto/create-policy.dto';
import { UpdateInventoryValuationPolicyDto } from './dto/update-policy.dto';
import { InventoryValuationPolicyQueryDto } from './dto/policy-query.dto';
import { CostInputDto } from './dto/cost-input.dto';
import { InitializeProductDto } from './dto/initialize.dto';
import { InitializationQueryDto } from './dto/initialization-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Inventory Valuation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory-valuation', version: '1' })
export class InventoryValuationController {
  constructor(private readonly service: InventoryValuationService) {}

  @Post('policies')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.costInput)
  @ApiOperation({ summary: 'Create a DRAFT inventory valuation policy (one per company + warehouse)' })
  createPolicy(
    @Body() dto: CreateInventoryValuationPolicyDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.createPolicy(dto, userId, ctx);
  }

  @Get('policies')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List inventory valuation policies scoped to the active context' })
  findPolicies(@Query() query: InventoryValuationPolicyQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findPolicies(query, ctx);
  }

  @Get('policies/:id')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get inventory valuation policy by ID (tenant-scoped)' })
  findPolicy(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findPolicy(id, ctx);
  }

  @Patch('policies/:id')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.costInput)
  @ApiOperation({ summary: 'Update a DRAFT/INITIALIZING valuation policy (currency frozen once initialization begins)' })
  updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryValuationPolicyDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.updatePolicy(id, dto, userId, ctx);
  }

  @Patch('policies/:id/begin-initialization')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.costInput)
  @ApiOperation({ summary: 'Begin legacy-stock initialization (DRAFT → INITIALIZING)' })
  beginInitialization(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.beginInitialization(id, userId, ctx);
  }

  @Post('policies/:id/activate')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.activate)
  @ApiOperation({ summary: 'Activate the weighted moving-average engine (INITIALIZING → ACTIVE)' })
  activate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.activate(id, userId, ctx);
  }

  @Get('policies/:id/readiness')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Derived legacy-initialization readiness for the policy warehouse' })
  getReadiness(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getReadiness(id, ctx);
  }

  @Post('policies/:id/opening-cost')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.costInput)
  @ApiOperation({ summary: 'Input explicit opening-balance unit cost against the policy currency' })
  inputOpeningCost(
    @Param('id') id: string,
    @Body() dto: CostInputDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.inputOpeningCost(id, dto, userId, ctx);
  }

  @Post('policies/:id/receipt-cost')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.costInput)
  @ApiOperation({ summary: 'Input explicit operational-receipt unit cost against the policy currency' })
  inputReceiptCost(
    @Param('id') id: string,
    @Body() dto: CostInputDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.inputReceiptCost(id, dto, userId, ctx);
  }

  @Post('policies/:id/initialize')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.initialize)
  @ApiOperation({ summary: 'Initialize legacy stock value for one product (idempotent per company+warehouse+product)' })
  initializeProduct(
    @Param('id') id: string,
    @Body() dto: InitializeProductDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.initializeProduct(id, dto, userId, ctx);
  }

  @Get('initializations')
  @Permissions(INVENTORY_VALUATION_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List legacy-stock initialization evidence scoped to the active context' })
  findInitializations(@Query() query: InitializationQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findInitializations(query, ctx);
  }
}
