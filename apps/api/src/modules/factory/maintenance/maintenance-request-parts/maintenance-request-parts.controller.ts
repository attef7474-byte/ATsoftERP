import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceRequestPartsService } from './maintenance-request-parts.service';
import { CreateMaintenanceRequestPartDto } from './dto/create-maintenance-request-part.dto';
import { UpdateMaintenanceRequestPartDto } from './dto/update-maintenance-request-part.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Request Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/request-parts', version: '1' })
export class MaintenanceRequestPartsController {
  constructor(private service: MaintenanceRequestPartsService) {}

  @Post()
  @Permissions('maintenance-request-part:create')
  @ApiOperation({ summary: 'Create part usage for maintenance request' })
  create(@Body() dto: CreateMaintenanceRequestPartDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('maintenance-request-part:read')
  @ApiOperation({ summary: 'List part usages' })
  findAll(@Query() query: { requestId?: string; productId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('maintenance-request-part:read')
  @ApiOperation({ summary: 'Get part usage by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('maintenance-request-part:update')
  @ApiOperation({ summary: 'Update part usage' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRequestPartDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('maintenance-request-part:delete')
  @ApiOperation({ summary: 'Delete part usage' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }
}
