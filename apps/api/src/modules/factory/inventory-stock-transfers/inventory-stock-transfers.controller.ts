import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryStockTransfersService } from './inventory-stock-transfers.service';
import { CreateStockTransferDto, CreateStockTransferLineDto } from './dto/create-stock-transfer.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { StockTransferQueryDto } from './dto/stock-transfer-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard';

@ApiTags('Inventory Stock Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, InventoryLockGuard)
@Controller({ path: 'inventory/transfers', version: '1' })
export class InventoryStockTransfersController {
  constructor(private service: InventoryStockTransfersService) {}

  @Post()
  @Permissions('inventory:stock-transfer:create')
  @ApiOperation({ summary: 'Create stock transfer' })
  create(@Body() dto: CreateStockTransferDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory:stock-transfer:read')
  @ApiOperation({ summary: 'List stock transfers' })
  findAll(@Query() query: StockTransferQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('inventory:stock-transfer:read')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory:stock-transfer:update')
  @ApiOperation({ summary: 'Update stock transfer' })
  update(@Param('id') id: string, @Body() dto: UpdateStockTransferDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Post(':id/submit')
  @Permissions('inventory:stock-transfer:submit')
  @ApiOperation({ summary: 'Submit stock transfer' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.submit(id, userId); }

  @Post(':id/approve')
  @Permissions('inventory:stock-transfer:approve')
  @ApiOperation({ summary: 'Approve stock transfer' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.approve(id, userId); }

  @Post(':id/reject')
  @Permissions('inventory:stock-transfer:reject')
  @ApiOperation({ summary: 'Reject stock transfer' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.reject(id, userId); }

  @Post(':id/post')
  @Permissions('inventory:stock-transfer:post')
  @ApiOperation({ summary: 'Post stock transfer' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.post(id, userId); }

  @Post(':id/cancel')
  @Permissions('inventory:stock-transfer:cancel')
  @ApiOperation({ summary: 'Cancel stock transfer' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Permissions('inventory:stock-transfer:delete-draft')
  @ApiOperation({ summary: 'Delete stock transfer (DRAFT only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.remove(id, userId); }

  @Post(':id/lines')
  @Permissions('inventory:stock-transfer:update')
  @ApiOperation({ summary: 'Add line to stock transfer' })
  addLine(@Param('id') id: string, @Body() dto: CreateStockTransferLineDto, @CurrentUser('id') userId: string) {
    return this.service.addLine(id, dto, userId);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory:stock-transfer:update')
  @ApiOperation({ summary: 'Update stock transfer line' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: Partial<CreateStockTransferLineDto>, @CurrentUser('id') userId: string) {
    return this.service.updateLine(id, lineId, dto, userId);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory:stock-transfer:update')
  @ApiOperation({ summary: 'Delete stock transfer line' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string) {
    return this.service.removeLine(id, lineId, userId);
  }

  @Get(':id/summary')
  @Permissions('inventory:stock-transfer:read')
  @ApiOperation({ summary: 'Get stock transfer summary' })
  summary(@Param('id') id: string) { return this.service.summary(id); }

  @Get('availability/:productId')
  @Permissions('inventory:stock-transfer:read')
  @ApiOperation({ summary: 'Get stock availability for product' })
  availability(@Param('productId') productId: string, @Query('warehouseId') warehouseId: string) {
    return this.service.getAvailability(productId, warehouseId);
  }
}
