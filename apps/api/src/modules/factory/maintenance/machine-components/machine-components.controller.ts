import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MachineComponentsService } from './machine-components.service';
import { CreateMachineComponentDto, UpdateMachineComponentDto } from './dto/create-machine-component.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Machine Components')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/machine-components', version: '1' })
export class MachineComponentsController {
  constructor(private service: MachineComponentsService) {}

  @Post()
  @Permissions('machine-component:create')
  @ApiOperation({ summary: 'Create machine component' })
  create(@Body() dto: CreateMachineComponentDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('machine-component:read')
  @ApiOperation({ summary: 'List machine components' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    machineId?: string; parentComponentId?: string;
    componentType?: string; criticality?: string; status?: string;
  }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
      parentComponentId: query.parentComponentId,
      componentType: query.componentType,
      criticality: query.criticality,
      status: query.status,
    }, ctx);
  }

  @Get(':id')
  @Permissions('machine-component:read')
  @ApiOperation({ summary: 'Get machine component by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('machine-component:update')
  @ApiOperation({ summary: 'Update machine component' })
  update(@Param('id') id: string, @Body() dto: UpdateMachineComponentDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('machine-component:delete')
  @ApiOperation({ summary: 'Soft delete machine component' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('machine-component:activate')
  @ApiOperation({ summary: 'Activate machine component' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('machine-component:deactivate')
  @ApiOperation({ summary: 'Deactivate machine component' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivate(id, userId, ctx);
  }
}
