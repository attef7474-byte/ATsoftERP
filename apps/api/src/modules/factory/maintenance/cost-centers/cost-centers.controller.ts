import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Cost Centers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/cost-centers', version: '1' })
export class CostCentersController {
  constructor(private service: CostCentersService) {}

  @Post()
  @Permissions('costCenters:create')
  @ApiOperation({ summary: 'Create cost center' })
  create(@Body() dto: CreateCostCenterDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('costCenters:read')
  @ApiOperation({ summary: 'List cost centers' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    type?: string; companyId?: string; branchId?: string;
    administrationId?: string; departmentId?: string; status?: string;
  }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      type: query.type,
      companyId: query.companyId,
      branchId: query.branchId,
      administrationId: query.administrationId,
      departmentId: query.departmentId,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('costCenters:read')
  @ApiOperation({ summary: 'Get cost center by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('costCenters:update')
  @ApiOperation({ summary: 'Update cost center' })
  update(@Param('id') id: string, @Body() dto: UpdateCostCenterDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('costCenters:delete')
  @ApiOperation({ summary: 'Soft delete cost center' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }

  @Patch(':id/activate')
  @Permissions('costCenters:activate')
  @ApiOperation({ summary: 'Activate cost center' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.activate(id, userId);
  }

  @Patch(':id/deactivate')
  @Permissions('costCenters:deactivate')
  @ApiOperation({ summary: 'Deactivate cost center' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.deactivate(id, userId);
  }
}
