import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PreventiveSparePartPlanService } from './preventive-spare-part-plan.service';
import {
  QueryPreventiveSparePartPlanDto, CreatePreventiveSparePartPlanDto, UpdatePreventiveSparePartPlanDto,
  CreatePlanItemDto, UpdatePlanItemDto, GeneratePlanFromScheduleDto, CopyToRequestDto,
} from './dto/preventive-spare-part-plan.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Preventive Spare Part Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/spare-part-plans', version: '1' })
export class PreventiveSparePartPlanController {
  constructor(private service: PreventiveSparePartPlanService) {}

  @Post()
  @Permissions('preventive-spare-part-plan:create')
  @ApiOperation({ summary: 'Create a new spare part plan' })
  create(@Body() dto: CreatePreventiveSparePartPlanDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('preventive-spare-part-plan:read')
  @ApiOperation({ summary: 'List spare part plans with optional filters' })
  findAll(@Query() query: QueryPreventiveSparePartPlanDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('preventive-spare-part-plan:read')
  @ApiOperation({ summary: 'Get spare part plan by ID' })
  findById(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findById(id, ctx);
  }

  @Patch(':id')
  @Permissions('preventive-spare-part-plan:update')
  @ApiOperation({ summary: 'Update spare part plan' })
  update(@Param('id') id: string, @Body() dto: UpdatePreventiveSparePartPlanDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('preventive-spare-part-plan:delete')
  @ApiOperation({ summary: 'Delete spare part plan' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }

  // ── Status transitions ──
  @Post(':id/activate')
  @Permissions('preventive-spare-part-plan:update')
  @ApiOperation({ summary: 'Activate plan' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.transition(id, 'ACTIVE', userId, ctx);
  }

  @Post(':id/complete')
  @Permissions('preventive-spare-part-plan:update')
  @ApiOperation({ summary: 'Mark plan as completed' })
  complete(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.transition(id, 'COMPLETED', userId, ctx);
  }

  @Post(':id/cancel')
  @Permissions('preventive-spare-part-plan:update')
  @ApiOperation({ summary: 'Cancel plan' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.transition(id, 'CANCELLED', userId, ctx);
  }

  // ── Generate from schedule ──
  @Post('generate-from-schedule/:scheduleId')
  @Permissions('preventive-spare-part-plan:create')
  @ApiOperation({ summary: 'Generate a spare part plan from a PM schedule' })
  generateFromSchedule(@Param('scheduleId') scheduleId: string, @Body() dto: GeneratePlanFromScheduleDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.generateFromSchedule(scheduleId, dto, userId, ctx);
  }

  // ── Items ──
  @Get(':id/items')
  @Permissions('preventive-spare-part-plan:read')
  @ApiOperation({ summary: 'List items in a plan' })
  getItems(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getItems(id, ctx);
  }

  @Post(':id/items')
  @Permissions('preventive-spare-part-plan:create')
  @ApiOperation({ summary: 'Add item to plan' })
  addItem(@Param('id') id: string, @Body() dto: CreatePlanItemDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addItem(id, dto, userId, ctx);
  }

  @Patch(':id/items/:itemId')
  @Permissions('preventive-spare-part-plan:update')
  @ApiOperation({ summary: 'Update plan item' })
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdatePlanItemDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateItem(itemId, dto, userId, ctx);
  }

  @Delete(':id/items/:itemId')
  @Permissions('preventive-spare-part-plan:delete')
  @ApiOperation({ summary: 'Remove plan item' })
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.removeItem(itemId, userId, ctx);
  }

  @Post(':id/refresh-availability')
  @Permissions('preventive-spare-part-plan:update')
  @ApiOperation({ summary: 'Refresh stock availability for all items' })
  refreshAvailability(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.refreshAvailability(id, userId, ctx);
  }

  // ── Copy to request ──
  @Post(':id/copy-to-request')
  @Permissions('preventive-spare-part-plan:update')
  @ApiOperation({ summary: 'Copy plan items to a maintenance request' })
  copyToRequest(@Param('id') id: string, @Body() dto: CopyToRequestDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.copyToRequest(id, dto, userId, ctx);
  }
}
