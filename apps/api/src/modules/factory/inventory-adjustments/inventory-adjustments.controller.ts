import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { InventoryAdjustmentQueryDto } from './dto/inventory-adjustment-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Inventory Adjustments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/adjustments', version: '1' })
export class InventoryAdjustmentsController {
  constructor(private service: InventoryAdjustmentsService) {}

  @Post()
  @Permissions('inventory-adjustment:create')
  @ApiOperation({ summary: 'Create inventory adjustment' })
  create(@Body() dto: CreateInventoryAdjustmentDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory-adjustment:read')
  @ApiOperation({ summary: 'List inventory adjustments' })
  findAll(@Query() query: InventoryAdjustmentQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('inventory-adjustment:read')
  @ApiOperation({ summary: 'Get inventory adjustment by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory-adjustment:update')
  @ApiOperation({ summary: 'Update inventory adjustment' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryAdjustmentDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/post')
  @Permissions('inventory-adjustment:post')
  @ApiOperation({ summary: 'Post inventory adjustment' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.post(id, userId); }

  @Patch(':id/cancel')
  @Permissions('inventory-adjustment:cancel')
  @ApiOperation({ summary: 'Cancel inventory adjustment' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }
}

@ApiTags('Inventory Counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/counts', version: '1' })
export class InventoryAdjustmentCountsController {
  constructor(private service: InventoryAdjustmentsService) {}

  @Post(':countId/generate-adjustment')
  @Permissions('inventory-count:generateAdjustment')
  @ApiOperation({ summary: 'Generate inventory adjustment from count' })
  generateFromCount(@Param('countId') countId: string, @CurrentUser('id') userId: string) {
    return this.service.generateFromCount(countId, userId);
  }
}
