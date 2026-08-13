import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryOperationalReceiptsService } from './inventory-operational-receipts.service';
import { CreateOperationalReceiptDto } from './dto/create-operational-receipt.dto';
import { UpdateOperationalReceiptDto } from './dto/update-operational-receipt.dto';
import { OperationalReceiptQueryDto } from './dto/operational-receipt-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard';

@ApiTags('Inventory Operational Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, InventoryLockGuard)
@Controller({ path: 'inventory/operational-receipts', version: '1' })
export class InventoryOperationalReceiptsController {
  constructor(private service: InventoryOperationalReceiptsService) {}

  @Post()
  @Permissions('inventory:operational-receipt:create')
  @ApiOperation({ summary: 'Create operational receipt' })
  create(@Body() dto: CreateOperationalReceiptDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('inventory:operational-receipt:read')
  @ApiOperation({ summary: 'List operational receipts' })
  findAll(@Query() query: OperationalReceiptQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('inventory:operational-receipt:read')
  @ApiOperation({ summary: 'Get operational receipt by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Update operational receipt' })
  update(@Param('id') id: string, @Body() dto: UpdateOperationalReceiptDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Post(':id/submit')
  @Permissions('inventory:operational-receipt:submit')
  @ApiOperation({ summary: 'Submit operational receipt' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.submit(id, userId, ctx); }

  @Post(':id/approve')
  @Permissions('inventory:operational-receipt:approve')
  @ApiOperation({ summary: 'Approve operational receipt' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.approve(id, userId, ctx); }

  @Post(':id/reject')
  @Permissions('inventory:operational-receipt:reject')
  @ApiOperation({ summary: 'Reject operational receipt' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.reject(id, userId, ctx); }

  @Post(':id/post')
  @Permissions('inventory:operational-receipt:post')
  @ApiOperation({ summary: 'Post operational receipt' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.post(id, userId, ctx); }

  @Post(':id/cancel')
  @Permissions('inventory:operational-receipt:cancel')
  @ApiOperation({ summary: 'Cancel operational receipt' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.cancel(id, userId, ctx); }

  @Delete(':id')
  @Permissions('inventory:operational-receipt:delete-draft')
  @ApiOperation({ summary: 'Delete operational receipt (DRAFT only)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.remove(id, userId, ctx); }

  @Post(':id/lines')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Add line to operational receipt' })
  addLine(@Param('id') id: string, @Body() dto: any, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addLine(id, dto, userId, ctx);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Update operational receipt line' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: any, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateLine(id, lineId, dto, userId, ctx);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory:operational-receipt:update')
  @ApiOperation({ summary: 'Delete operational receipt line' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeLine(id, lineId, userId, ctx);
  }

  @Get(':id/summary')
  @Permissions('inventory:operational-receipt:read')
  @ApiOperation({ summary: 'Get operational receipt summary' })
  summary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.summary(id, ctx); }
}
