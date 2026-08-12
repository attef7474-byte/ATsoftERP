import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryStockAdjustmentsService } from './inventory-stock-adjustments.service';
import { CreateStockAdjustmentDto, CreateStockAdjustmentLineDto } from './dto/create-stock-adjustment.dto';
import { UpdateStockAdjustmentDto } from './dto/update-stock-adjustment.dto';
import { StockAdjustmentQueryDto } from './dto/stock-adjustment-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Inventory Stock Adjustments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, InventoryLockGuard)
@Controller({ path: 'inventory/stock-adjustments', version: '1' })
export class InventoryStockAdjustmentsController {
  constructor(private service: InventoryStockAdjustmentsService) {}

  @Post()
  @Permissions('inventory:stock-adjustment:create')
  @ApiOperation({ summary: 'Create stock adjustment in the active operational context' })
  create(@Body() dto: CreateStockAdjustmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('inventory:stock-adjustment:read')
  @ApiOperation({ summary: 'List stock adjustments scoped to the active context' })
  findAll(@Query() query: StockAdjustmentQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('inventory:stock-adjustment:read')
  @ApiOperation({ summary: 'Get stock adjustment by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Update stock adjustment (tenant-scoped)' })
  update(@Param('id') id: string, @Body() dto: UpdateStockAdjustmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Post(':id/submit')
  @Permissions('inventory:stock-adjustment:submit')
  @ApiOperation({ summary: 'Submit stock adjustment (tenant-scoped)' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.submit(id, userId, ctx); }

  @Post(':id/approve')
  @Permissions('inventory:stock-adjustment:approve')
  @ApiOperation({ summary: 'Approve stock adjustment (tenant-scoped)' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.approve(id, userId, ctx); }

  @Post(':id/reject')
  @Permissions('inventory:stock-adjustment:reject')
  @ApiOperation({ summary: 'Reject stock adjustment (tenant-scoped)' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.reject(id, userId, ctx); }

  @Post(':id/post')
  @Permissions('inventory:stock-adjustment:post')
  @ApiOperation({ summary: 'Post stock adjustment (tenant-scoped)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.post(id, userId, ctx); }

  @Post(':id/cancel')
  @Permissions('inventory:stock-adjustment:cancel')
  @ApiOperation({ summary: 'Cancel stock adjustment (tenant-scoped)' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.cancel(id, userId, ctx); }

  @Delete(':id')
  @Permissions('inventory:stock-adjustment:delete-draft')
  @ApiOperation({ summary: 'Delete stock adjustment (DRAFT only, tenant-scoped)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.remove(id, userId, ctx); }

  @Post(':id/lines')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Add line to stock adjustment (tenant-scoped)' })
  addLine(@Param('id') id: string, @Body() dto: CreateStockAdjustmentLineDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addLine(id, dto, userId, ctx);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Update stock adjustment line (tenant-scoped)' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: Partial<CreateStockAdjustmentLineDto>, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateLine(id, lineId, dto, userId, ctx);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Delete stock adjustment line (tenant-scoped)' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeLine(id, lineId, userId, ctx);
  }

  @Get(':id/summary')
  @Permissions('inventory:stock-adjustment:read')
  @ApiOperation({ summary: 'Get stock adjustment summary (tenant-scoped)' })
  summary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.summary(id, ctx); }
}
