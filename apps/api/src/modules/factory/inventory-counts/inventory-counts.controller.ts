import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryCountsService } from './inventory-counts.service';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { UpdateInventoryCountDto } from './dto/update-inventory-count.dto';
import { InventoryCountQueryDto } from './dto/inventory-count-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Inventory Counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/counts', version: '1' })
export class InventoryCountsController {
  constructor(private service: InventoryCountsService) {}

  @Post()
  @Permissions('inventory-count:create')
  @ApiOperation({ summary: 'Create inventory count' })
  create(@Body() dto: CreateInventoryCountDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory-count:read')
  @ApiOperation({ summary: 'List inventory counts' })
  findAll(@Query() query: InventoryCountQueryDto) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      companyId: query.companyId,
      branchId: query.branchId,
      warehouseId: query.warehouseId,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get(':id')
  @Permissions('inventory-count:read')
  @ApiOperation({ summary: 'Get inventory count by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory-count:update')
  @ApiOperation({ summary: 'Update inventory count' })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryCountDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/start')
  @Permissions('inventory-count:start')
  @ApiOperation({ summary: 'Start inventory count' })
  start(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.start(id, userId); }

  @Patch(':id/complete')
  @Permissions('inventory-count:complete')
  @ApiOperation({ summary: 'Complete inventory count' })
  complete(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.complete(id, userId); }

  @Patch(':id/cancel')
  @Permissions('inventory-count:cancel')
  @ApiOperation({ summary: 'Cancel inventory count' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Permissions('inventory-count:delete')
  @ApiOperation({ summary: 'Soft delete inventory count' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.remove(id, userId); }
}
