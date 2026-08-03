import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryMovementsService } from './inventory-movements.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { UpdateInventoryMovementDto } from './dto/update-inventory-movement.dto';
import { InventoryMovementQueryDto } from './dto/inventory-movement-query.dto';
import { CreateInventoryMovementLineDto } from './dto/create-inventory-movement.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InventoryLockGuard } from '../../../common/guards/inventory-lock.guard';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Inventory Movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, InventoryLockGuard)
@Controller({ path: 'inventory/movements', version: '1' })
export class InventoryMovementsController {
  constructor(private service: InventoryMovementsService) {}

  @Post()
  @Permissions('inventory-movement:create')
  @ApiOperation({ summary: 'Create inventory movement in the active operational context' })
  create(@Body() dto: CreateInventoryMovementDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('inventory-movement:read')
  @ApiOperation({ summary: 'List inventory movements scoped to the active context' })
  findAll(@Query() query: InventoryMovementQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('inventory-movement:read')
  @ApiOperation({ summary: 'Get inventory movement by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('inventory-movement:update')
  @ApiOperation({ summary: 'Update inventory movement (tenant-scoped)' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryMovementDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/post')
  @Permissions('inventory-movement:post')
  @ApiOperation({ summary: 'Post inventory movement (tenant-scoped)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.post(id, userId, ctx); }

  @Patch(':id/cancel')
  @Permissions('inventory-movement:cancel')
  @ApiOperation({ summary: 'Cancel inventory movement (tenant-scoped)' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.cancel(id, userId, ctx); }

  @Post(':id/lines')
  @Permissions('inventory-movement:update')
  @ApiOperation({ summary: 'Add line to movement (tenant-scoped)' })
  addLine(@Param('id') id: string, @Body() dto: CreateInventoryMovementLineDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addLine(id, dto, userId, ctx);
  }

  @Patch(':id/lines/:lineId')
  @Permissions('inventory-movement:update')
  @ApiOperation({ summary: 'Update movement line (tenant-scoped)' })
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: Partial<CreateInventoryMovementLineDto>, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateLine(id, lineId, dto, userId, ctx);
  }

  @Delete(':id/lines/:lineId')
  @Permissions('inventory-movement:update')
  @ApiOperation({ summary: 'Delete movement line (tenant-scoped)' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeLine(id, lineId, userId, ctx);
  }

  @Get(':id/summary')
  @Permissions('inventory-movement:read')
  @ApiOperation({ summary: 'Get movement summary (tenant-scoped)' })
  summary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.summary(id, ctx); }
}
