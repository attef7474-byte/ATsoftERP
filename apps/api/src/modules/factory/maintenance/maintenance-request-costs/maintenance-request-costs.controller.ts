import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceRequestCostsService } from './maintenance-request-costs.service';
import { CreateMaintenanceRequestCostDto } from './dto/create-maintenance-request-cost.dto';
import { UpdateMaintenanceRequestCostDto } from './dto/update-maintenance-request-cost.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Maintenance Request Costs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/request-costs', version: '1' })
export class MaintenanceRequestCostsController {
  constructor(private service: MaintenanceRequestCostsService) {}

  @Post()
  @Permissions('maintenance-request-cost:create')
  @ApiOperation({ summary: 'Create cost entry for maintenance request' })
  create(@Body() dto: CreateMaintenanceRequestCostDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('maintenance-request-cost:read')
  @ApiOperation({ summary: 'List cost entries' })
  findAll(@Query() query: { requestId?: string; type?: string }) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('maintenance-request-cost:read')
  @ApiOperation({ summary: 'Get cost entry by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('maintenance-request-cost:update')
  @ApiOperation({ summary: 'Update cost entry' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRequestCostDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('maintenance-request-cost:delete')
  @ApiOperation({ summary: 'Delete cost entry' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId);
  }
}
