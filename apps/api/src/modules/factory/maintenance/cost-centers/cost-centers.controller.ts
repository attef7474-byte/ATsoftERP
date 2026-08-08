import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CostCentersService } from './cost-centers.service';
import { COST_CENTER_PERMISSION_KEYS } from './cost-centers.constants';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { CreateOperationalCostCenterAssignmentDto } from './dto/create-operational-cost-center-assignment.dto';
import { UpdateOperationalCostCenterAssignmentDto } from './dto/update-operational-cost-center-assignment.dto';
import { OperationalCostCenterAssignmentQueryDto } from './dto/operational-cost-center-assignment-query.dto';
import { TransitionOperationalCostCenterAssignmentDto } from './dto/transition-operational-cost-center-assignment.dto';
import { ResolveCostCenterDto } from './dto/resolve-cost-center.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Cost Centers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/cost-centers', version: '1' })
export class CostCentersController {
  constructor(private service: CostCentersService) {}

  // ── Cost center master data (tenant scope derived from the active context) ──

  @Post()
  @Permissions(COST_CENTER_PERMISSION_KEYS.create)
  @ApiOperation({ summary: 'Create cost center' })
  create(@Body() dto: CreateCostCenterDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions(COST_CENTER_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List cost centers' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    type?: string; companyId?: string; branchId?: string;
    administrationId?: string; departmentId?: string; status?: string;
  }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
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
    }, ctx);
  }

  // ── Standalone resolution (D9) ──────────────────────────────────────────────

  @Post('resolve')
  @Permissions(COST_CENTER_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Resolve the operational cost center for a resource at a reference date' })
  resolve(@Body() dto: ResolveCostCenterDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.resolve(dto, ctx);
  }

  // ── Operational cost center assignments (before :id param routes) ───────────

  @Post('assignments')
  @Permissions(COST_CENTER_PERMISSION_KEYS.assign)
  @ApiOperation({ summary: 'Create an operational cost center assignment (DRAFT)' })
  createAssignment(@Body() dto: CreateOperationalCostCenterAssignmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createAssignment(dto, userId, ctx);
  }

  @Get('assignments')
  @Permissions(COST_CENTER_PERMISSION_KEYS.assign)
  @ApiOperation({ summary: 'List operational cost center assignments' })
  findAssignments(@Query() query: OperationalCostCenterAssignmentQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAssignments(query, ctx);
  }

  @Get('assignments/:id')
  @Permissions(COST_CENTER_PERMISSION_KEYS.assign)
  @ApiOperation({ summary: 'Get operational cost center assignment by ID' })
  findAssignment(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAssignment(id, ctx);
  }

  @Patch('assignments/:id')
  @Permissions(COST_CENTER_PERMISSION_KEYS.assign)
  @ApiOperation({ summary: 'Update a DRAFT (or ACTIVE, with reason) assignment' })
  updateAssignment(@Param('id') id: string, @Body() dto: UpdateOperationalCostCenterAssignmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateAssignment(id, dto, userId, ctx);
  }

  @Post('assignments/:id/transition')
  @Permissions(COST_CENTER_PERMISSION_KEYS.assign)
  @ApiOperation({ summary: 'Transition an assignment (DRAFT -> ACTIVE or ACTIVE -> ENDED) with reason' })
  transitionAssignment(@Param('id') id: string, @Body() dto: TransitionOperationalCostCenterAssignmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.transitionAssignment(id, dto, userId, ctx);
  }

  @Delete('assignments/:id')
  @Permissions(COST_CENTER_PERMISSION_KEYS.assign)
  @ApiOperation({ summary: 'Soft delete a DRAFT assignment' })
  removeAssignment(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeAssignment(id, userId, ctx);
  }

  // ── Cost center by id ───────────────────────────────────────────────────────

  @Get(':id')
  @Permissions(COST_CENTER_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get cost center by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions(COST_CENTER_PERMISSION_KEYS.update)
  @ApiOperation({ summary: 'Update cost center' })
  update(@Param('id') id: string, @Body() dto: UpdateCostCenterDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions(COST_CENTER_PERMISSION_KEYS.delete)
  @ApiOperation({ summary: 'Soft delete cost center' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions(COST_CENTER_PERMISSION_KEYS.activate)
  @ApiOperation({ summary: 'Activate cost center' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions(COST_CENTER_PERMISSION_KEYS.deactivate)
  @ApiOperation({ summary: 'Deactivate cost center' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivate(id, userId, ctx);
  }
}
