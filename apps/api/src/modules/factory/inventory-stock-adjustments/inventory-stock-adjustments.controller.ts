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

@ApiTags('Inventory Stock Adjustments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, InventoryLockGuard)
@Controller({ path: 'inventory/stock-adjustments', version: '1' })
export class InventoryStockAdjustmentsController {
  constructor(private service: InventoryStockAdjustmentsService) {}

  @Post()
  @Permissions('inventory:stock-adjustment:create')
  @ApiOperation({ summary: 'Create stock adjustment' })
  create(@Body() dto: CreateStockAdjustmentDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory:stock-adjustment:read')
  @ApiOperation({ summary: 'List stock adjustments' })
  findAll(@Query() query: StockAdjustmentQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('inventory:stock-adjustment:read')
  @ApiOperation({ summary: 'Get stock adjustment by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Update stock adjustment' })
  update(@Param('id') id: string, @Body() dto: UpdateStockAdjustmentDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Post(':id/submit')
  @Permissions('inventory:stock-adjustment:submit')
  @ApiOperation({ summary: 'Submit stock adjustment' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.submit(id, userId); }

  @Post(':id/approve')
  @Permissions('inventory:stock-adjustment:approve')
  @ApiOperation({ summary: 'Approve stock adjustment' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.approve(id, userId); }

  @Post(':id/reject')
  @Permissions('inventory:stock-adjustment:reject')
  @ApiOperation({ summary: 'Reject stock adjustment' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.reject(id, userId); }

  @Post(':id/post')
  @Permissions('inventory:stock-adjustment:post')
  @ApiOperation({ summary: 'Post stock adjustment' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.post(id, userId); }

  @Post(':id/cancel')
  @Permissions('inventory:stock-adjustment:cancel')
  @ApiOperation({ summary: 'Cancel stock adjustment' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Permissions('inventory:stock-adjustment:delete-draft')
  @ApiOperation({ summary: 'Delete stock adjustment (DRAFT only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.remove(id, userId); }

  @Post(':id/lines')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Add line to stock adjustment' })
  addLine(@Param('id') id: string, @Body() dto: CreateStockAdjustmentLineDto, @CurrentUser('id') userId: string) {
    return this.service.addLine(id, dto, userId);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Update stock adjustment line' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: Partial<CreateStockAdjustmentLineDto>, @CurrentUser('id') userId: string) {
    return this.service.updateLine(id, lineId, dto, userId);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory:stock-adjustment:update')
  @ApiOperation({ summary: 'Delete stock adjustment line' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string) {
    return this.service.removeLine(id, lineId, userId);
  }

  @Get(':id/summary')
  @Permissions('inventory:stock-adjustment:read')
  @ApiOperation({ summary: 'Get stock adjustment summary' })
  summary(@Param('id') id: string) { return this.service.summary(id); }
}
