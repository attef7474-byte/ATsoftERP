import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenancePersonnelService } from './maintenance-personnel.service';
import { CreateMaintenancePersonnelDto, UpdateMaintenancePersonnelDto } from './dto/create-maintenance-personnel.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Maintenance Personnel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/personnel', version: '1' })
export class MaintenancePersonnelController {
  constructor(private service: MaintenancePersonnelService) {}

  @Post()
  @Permissions('maintenance-personnel:create', 'operational-person:create', 'person-assignment:create')
  @ApiOperation({ summary: 'Create maintenance personnel' })
  create(@Body() dto: CreateMaintenancePersonnelDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') actorId: string) {
    return this.service.create(dto, ctx, actorId);
  }

  @Get()
  @Permissions('maintenance-personnel:read')
  @ApiOperation({ summary: 'List maintenance personnel' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; role?: string; specialty?: string; isActive?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      role: query.role,
      specialty: query.specialty,
      isActive: query.isActive,
    }, ctx);
  }

  @Get(':id')
  @Permissions('maintenance-personnel:read')
  @ApiOperation({ summary: 'Get maintenance personnel by id' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('maintenance-personnel:update')
  @ApiOperation({ summary: 'Update maintenance personnel' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenancePersonnelDto, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') actorId: string) {
    return this.service.update(id, dto, ctx, actorId);
  }

  @Patch(':id/activate')
  @Permissions('maintenance-personnel:activate')
  @ApiOperation({ summary: 'Activate maintenance personnel' })
  activate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') actorId: string) {
    return this.service.activate(id, ctx, actorId);
  }

  @Patch(':id/deactivate')
  @Permissions('maintenance-personnel:deactivate')
  @ApiOperation({ summary: 'Deactivate maintenance personnel' })
  deactivate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') actorId: string) {
    return this.service.deactivate(id, ctx, actorId);
  }

  @Delete(':id')
  @Permissions('maintenance-personnel:delete')
  @ApiOperation({ summary: 'Delete maintenance personnel' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @CurrentUser('id') actorId: string) {
    return this.service.remove(id, ctx, actorId);
  }
}
