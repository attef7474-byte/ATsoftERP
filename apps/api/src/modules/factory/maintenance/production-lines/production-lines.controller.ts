import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductionLinesService } from './production-lines.service';
import { CreateProductionLineDto } from './dto/create-production-line.dto';
import { UpdateProductionLineDto } from './dto/update-production-line.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Production Lines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/production-lines', version: '1' })
export class ProductionLinesController {
  constructor(private service: ProductionLinesService) {}

  @Post()
  @Permissions('productionLines:create')
  @ApiOperation({ summary: 'Create production line' })
  create(@Body() dto: CreateProductionLineDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('productionLines:read')
  @ApiOperation({ summary: 'List production lines' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    companyId?: string; branchId?: string; administrationId?: string;
    departmentId?: string; operationTypeId?: string; costCenterId?: string;
    status?: string;
  }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      companyId: query.companyId,
      branchId: query.branchId,
      administrationId: query.administrationId,
      departmentId: query.departmentId,
      operationTypeId: query.operationTypeId,
      costCenterId: query.costCenterId,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('productionLines:read')
  @ApiOperation({ summary: 'Get production line by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('productionLines:update')
  @ApiOperation({ summary: 'Update production line' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionLineDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('productionLines:delete')
  @ApiOperation({ summary: 'Soft delete production line' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }

  @Patch(':id/activate')
  @Permissions('productionLines:activate')
  @ApiOperation({ summary: 'Activate production line' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.activate(id, userId);
  }

  @Patch(':id/deactivate')
  @Permissions('productionLines:deactivate')
  @ApiOperation({ summary: 'Deactivate production line' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.deactivate(id, userId);
  }
}
