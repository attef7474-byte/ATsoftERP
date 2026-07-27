import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryPhysicalCountsService } from './inventory-physical-counts.service';
import { CreatePhysicalCountDto } from './dto/create-physical-count.dto';
import { UpdatePhysicalCountDto } from './dto/update-physical-count.dto';
import { PhysicalCountQueryDto } from './dto/physical-count-query.dto';
import { EnterCountLineDto } from './dto/enter-count-line.dto';
import { RejectPhysicalCountDto } from './dto/reject-physical-count.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Physical Counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/physical-counts', version: '1' })
export class InventoryPhysicalCountsController {
  constructor(private service: InventoryPhysicalCountsService) {}

  @Post()
  @Permissions('inventory:physical-count:create')
  @ApiOperation({ summary: 'Create physical count' })
  create(@Body() dto: CreatePhysicalCountDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('inventory:physical-count:read')
  @ApiOperation({ summary: 'List physical counts' })
  findAll(@Query() query: PhysicalCountQueryDto) {
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
  @Permissions('inventory:physical-count:read')
  @ApiOperation({ summary: 'Get physical count by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('inventory:physical-count:update')
  @ApiOperation({ summary: 'Update physical count' })
  update(@Param('id') id: string, @Body() dto: UpdatePhysicalCountDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('inventory:physical-count:delete')
  @ApiOperation({ summary: 'Soft delete physical count' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId);
  }

  @Post(':id/lines')
  @Permissions('inventory:physical-count:update')
  @ApiOperation({ summary: 'Add line to physical count' })
  addLine(
    @Param('id') id: string,
    @Body('productId') productId: string,
    @Body('warehouseLocationId') warehouseLocationId: string | null,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.addLine(id, productId, warehouseLocationId, userId);
  }

  @Patch(':id/lines/:lineId/enter')
  @Permissions('inventory:physical-count:enter-line')
  @ApiOperation({ summary: 'Enter counted quantity for a line' })
  enterCount(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: EnterCountLineDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.enterCount(id, lineId, dto, userId);
  }

  @Patch(':id/submit')
  @Permissions('inventory:physical-count:submit')
  @ApiOperation({ summary: 'Submit physical count' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.submit(id, userId);
  }

  @Patch(':id/approve')
  @Permissions('inventory:physical-count:approve')
  @ApiOperation({ summary: 'Approve physical count' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.approve(id, userId);
  }

  @Patch(':id/reject')
  @Permissions('inventory:physical-count:reject')
  @ApiOperation({ summary: 'Reject physical count (back to DRAFT)' })
  reject(@Param('id') id: string, @Body() dto: RejectPhysicalCountDto, @CurrentUser('id') userId: string) {
    return this.service.reject(id, dto, userId);
  }

  @Patch(':id/post')
  @Permissions('inventory:physical-count:post')
  @ApiOperation({ summary: 'Post physical count (create variance movements and update stock)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.post(id, userId);
  }

  @Patch(':id/cancel')
  @Permissions('inventory:physical-count:cancel')
  @ApiOperation({ summary: 'Cancel physical count' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.cancel(id, userId);
  }

  @Get(':id/results')
  @Permissions('inventory:physical-count:read')
  @ApiOperation({ summary: 'Get physical count results with variance summary' })
  results(@Param('id') id: string) { return this.service.results(id); }

  @Get(':id/history')
  @Permissions('inventory:physical-count:read')
  @ApiOperation({ summary: 'Get physical count audit history' })
  history(@Param('id') id: string) { return this.service.history(id); }
}
