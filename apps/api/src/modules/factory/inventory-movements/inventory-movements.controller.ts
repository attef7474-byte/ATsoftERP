import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryMovementsService } from './inventory-movements.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { UpdateInventoryMovementDto } from './dto/update-inventory-movement.dto';
import { InventoryMovementQueryDto } from './dto/inventory-movement-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Inventory Movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/movements', version: '1' })
export class InventoryMovementsController {
  constructor(private service: InventoryMovementsService) {}

  @Post()
  @Permissions('inventory-movement:create')
  @ApiOperation({ summary: 'Create inventory movement' })
  create(@Body() dto: CreateInventoryMovementDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory-movement:read')
  @ApiOperation({ summary: 'List inventory movements' })
  findAll(@Query() query: InventoryMovementQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('inventory-movement:read')
  @ApiOperation({ summary: 'Get inventory movement by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory-movement:update')
  @ApiOperation({ summary: 'Update inventory movement' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryMovementDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/post')
  @Permissions('inventory-movement:post')
  @ApiOperation({ summary: 'Post inventory movement' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.post(id, userId); }

  @Patch(':id/cancel')
  @Permissions('inventory-movement:cancel')
  @ApiOperation({ summary: 'Cancel inventory movement' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }
}
