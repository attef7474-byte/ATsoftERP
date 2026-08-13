import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Post('warehouses')
  @Permissions('inventory:create')
  @ApiOperation({ summary: 'Create warehouse' })
  createWarehouse(@Body() dto: CreateWarehouseDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.createWarehouse(dto, ctx); }

  @Get('warehouses')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'List warehouses' })
  findAllWarehouses(@Query() query: { page?: string; limit?: string; search?: string; companyId?: string; warehouseType?: string }) {
    return this.service.findAllWarehouses({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      companyId: query.companyId,
      warehouseType: query.warehouseType,
    });
  }

  @Get('warehouses/:id')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get warehouse by ID' })
  findOneWarehouse(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOneWarehouse(id, ctx); }

  @Patch('warehouses/:id')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Update warehouse' })
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateWarehouse(id, dto, ctx); }

  @Delete('warehouses/:id')
  @Permissions('inventory:delete')
  @ApiOperation({ summary: 'Soft delete warehouse' })
  removeWarehouse(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.removeWarehouse(id, ctx); }

  @Patch('warehouses/:id/activate')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Activate warehouse' })
  activateWarehouse(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.activateWarehouse(id, ctx); }

  @Patch('warehouses/:id/deactivate')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Deactivate warehouse' })
  deactivateWarehouse(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.deactivateWarehouse(id, ctx); }

  @Get('warehouses/:id/summary')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get warehouse summary' })
  warehouseSummary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.warehouseSummary(id, ctx); }

  @Get('locations/:id/balances')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get balances for a location' })
  locationBalances(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.locationBalances(id, ctx); }

  @Post('locations')
  @Permissions('inventory:create')
  @ApiOperation({ summary: 'Create warehouse location' })
  createLocation(@Body() dto: CreateWarehouseLocationDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.createLocation(dto, ctx); }

  @Get('locations')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'List all warehouse locations' })
  findAllLocations(@Query() query: { page?: string; limit?: string; search?: string; warehouseId?: string; status?: string }) {
    return this.service.findAllLocations({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      warehouseId: query.warehouseId,
      status: query.status,
    });
  }

  @Get('locations/:id')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get warehouse location by ID' })
  findOneLocation(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOneLocation(id, ctx); }

  @Get('warehouses/:warehouseId/locations')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get warehouse locations by warehouse' })
  findLocations(@Param('warehouseId') warehouseId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findLocations(warehouseId, ctx); }

  @Patch('locations/:id')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Update warehouse location' })
  updateLocation(@Param('id') id: string, @Body() dto: UpdateWarehouseLocationDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateLocation(id, dto, ctx); }

  @Delete('locations/:id')
  @Permissions('inventory:delete')
  @ApiOperation({ summary: 'Deactivate location' })
  removeLocation(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.removeLocation(id, ctx); }

  @Patch('locations/:id/activate')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Activate warehouse location' })
  activateLocation(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.activateLocation(id, ctx); }
}
