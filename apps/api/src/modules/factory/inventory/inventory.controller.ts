import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { CreateStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Post('warehouses')
  @Permissions('inventory:create')
  @ApiOperation({ summary: 'Create warehouse' })
  createWarehouse(@Body() dto: CreateWarehouseDto) { return this.service.createWarehouse(dto); }

  @Get('warehouses')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'List warehouses' })
  findAllWarehouses(@Query() query: { page?: string; limit?: string; search?: string; companyId?: string }) {
    return this.service.findAllWarehouses({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      companyId: query.companyId,
    });
  }

  @Get('warehouses/:id')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get warehouse by ID' })
  findOneWarehouse(@Param('id') id: string) { return this.service.findOneWarehouse(id); }

  @Patch('warehouses/:id')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Update warehouse' })
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) { return this.service.updateWarehouse(id, dto); }

  @Delete('warehouses/:id')
  @Permissions('inventory:delete')
  @ApiOperation({ summary: 'Soft delete warehouse' })
  removeWarehouse(@Param('id') id: string) { return this.service.removeWarehouse(id); }

  @Post('locations')
  @Permissions('inventory:create')
  @ApiOperation({ summary: 'Create warehouse location' })
  createLocation(@Body() dto: CreateWarehouseLocationDto) { return this.service.createLocation(dto); }

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
  findOneLocation(@Param('id') id: string) { return this.service.findOneLocation(id); }

  @Get('warehouses/:warehouseId/locations')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get warehouse locations by warehouse' })
  findLocations(@Param('warehouseId') warehouseId: string) { return this.service.findLocations(warehouseId); }

  @Patch('locations/:id')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Update warehouse location' })
  updateLocation(@Param('id') id: string, @Body() dto: UpdateWarehouseLocationDto) { return this.service.updateLocation(id, dto); }

  @Delete('locations/:id')
  @Permissions('inventory:delete')
  @ApiOperation({ summary: 'Deactivate location' })
  removeLocation(@Param('id') id: string) { return this.service.removeLocation(id); }

  @Patch('locations/:id/activate')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Activate warehouse location' })
  activateLocation(@Param('id') id: string) { return this.service.activateLocation(id); }

  @Post('adjustments')
  @Permissions('inventory:update')
  @ApiOperation({ summary: 'Adjust stock quantity' })
  adjustStock(@Body() dto: CreateStockAdjustmentDto) { return this.service.adjustStock(dto); }

  @Get('balances')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get inventory balances' })
  getBalances(@Query() query: { warehouseId?: string; productId?: string; page?: string; limit?: string }) {
    return this.service.getBalances({
      warehouseId: query.warehouseId,
      productId: query.productId,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }
}
