import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceWorkOrdersService } from './maintenance-work-orders.service';
import { CreateMaintenanceWorkOrderDto } from './dto/create-maintenance-work-order.dto';
import { UpdateMaintenanceWorkOrderDto } from './dto/update-maintenance-work-order.dto';
import { AddWorkOrderPartDto, UpdateWorkOrderPartDto, IssueWorkOrderPartsDto } from './dto/work-order-part.dto';
import { AddWorkOrderCostEntryDto, UpdateWorkOrderCostEntryDto } from './dto/work-order-cost-entry.dto';
import { WorkOrderStatusActionDto } from './dto/work-order-status-action.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentUserType } from '../../../../modules/auth/types/current-user.type';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Work Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance-work-orders', version: '1' })
export class MaintenanceWorkOrdersController {
  constructor(private service: MaintenanceWorkOrdersService) {}

  @Post()
  @Permissions('maintenance-work-order:create')
  @ApiOperation({ summary: 'Create a maintenance work order in the active operational context' })
  create(@Body() dto: CreateMaintenanceWorkOrderDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, user, ctx);
  }

  @Get()
  @Permissions('maintenance-work-order:read')
  @ApiOperation({ summary: 'List maintenance work orders scoped to the active context' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    status?: string; type?: string; priority?: string; machineId?: string; requestId?: string;
  }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
      type: query.type,
      priority: query.priority,
      machineId: query.machineId,
      requestId: query.requestId,
    }, ctx);
  }

  @Get(':id')
  @Permissions('maintenance-work-order:read')
  @ApiOperation({ summary: 'Get a maintenance work order by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('maintenance-work-order:update')
  @ApiOperation({ summary: 'Update a maintenance work order header (tenant-scoped)' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceWorkOrderDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, user, ctx);
  }

  @Patch(':id/status')
  @Permissions('maintenance-work-order:update')
  @ApiOperation({ summary: 'Transition a work order status (plan/start/complete/cancel)' })
  transition(@Param('id') id: string, @Body() dto: WorkOrderStatusActionDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.transition(id, dto, user, ctx);
  }

  @Post(':id/parts')
  @Permissions('maintenance-work-order-part:create')
  @ApiOperation({ summary: 'Add a part line to a work order' })
  addPart(@Param('id') id: string, @Body() dto: AddWorkOrderPartDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addPart(id, dto, user, ctx);
  }

  @Patch('parts/:partId')
  @Permissions('maintenance-work-order-part:update')
  @ApiOperation({ summary: 'Update a work order part line' })
  updatePart(@Param('partId') partId: string, @Body() dto: UpdateWorkOrderPartDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updatePart(partId, dto, user, ctx);
  }

  @Delete('parts/:partId')
  @Permissions('maintenance-work-order-part:delete')
  @ApiOperation({ summary: 'Remove a work order part line' })
  removePart(@Param('partId') partId: string, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removePart(partId, user, ctx);
  }

  @Post(':id/issue-parts')
  @Permissions('maintenance-work-order:issueParts')
  @ApiOperation({ summary: 'Atomically issue work order parts from inventory (decrements balances, creates movements)' })
  issueParts(@Param('id') id: string, @Body() dto: IssueWorkOrderPartsDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.issueParts(id, dto, user, ctx);
  }

  @Post(':id/cost-entries')
  @Permissions('maintenance-work-order-cost:create')
  @ApiOperation({ summary: 'Add a cost entry to a work order' })
  addCostEntry(@Param('id') id: string, @Body() dto: AddWorkOrderCostEntryDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addCostEntry(id, dto, user, ctx);
  }

  @Patch('cost-entries/:entryId')
  @Permissions('maintenance-work-order-cost:update')
  @ApiOperation({ summary: 'Update a work order cost entry' })
  updateCostEntry(@Param('entryId') entryId: string, @Body() dto: UpdateWorkOrderCostEntryDto, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateCostEntry(entryId, dto, user, ctx);
  }

  @Delete('cost-entries/:entryId')
  @Permissions('maintenance-work-order-cost:delete')
  @ApiOperation({ summary: 'Remove a work order cost entry' })
  removeCostEntry(@Param('entryId') entryId: string, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeCostEntry(entryId, user, ctx);
  }

  @Delete(':id')
  @Permissions('maintenance-work-order:delete')
  @ApiOperation({ summary: 'Soft delete a work order (DRAFT/PLANNED/CANCELLED only)' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, user, ctx);
  }
}
