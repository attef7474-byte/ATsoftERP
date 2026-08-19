import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ShiftHandoversService } from './shift-handovers.service';
import { CreateShiftHandoverDto, UpdateShiftHandoverDto, CreateShiftHandoverItemDto } from './dto/create-shift-handover.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Shift Handovers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production/shift-handovers', version: '1' })
export class ShiftHandoversController {
  constructor(private service: ShiftHandoversService) {}

  @Post()
  @Permissions('shift-handover:create')
  @ApiOperation({ summary: 'Create shift handover' })
  create(
    @Body() dto: CreateShiftHandoverDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('shift-handover:read')
  @ApiOperation({ summary: 'List shift handovers' })
  findAll(
    @Query() query: { page?: string; limit?: string; status?: string; departmentId?: string; handoverDateFrom?: string; handoverDateTo?: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      status: query.status,
      departmentId: query.departmentId,
      handoverDateFrom: query.handoverDateFrom,
      handoverDateTo: query.handoverDateTo,
    }, ctx);
  }

  @Get(':id')
  @Permissions('shift-handover:read')
  @ApiOperation({ summary: 'Get shift handover by id' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('shift-handover:create')
  @ApiOperation({ summary: 'Update shift handover (DRAFT only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShiftHandoverDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('shift-handover:create')
  @ApiOperation({ summary: 'Delete shift handover (DRAFT only)' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.remove(id, userId, ctx);
  }

  @Post(':id/submit')
  @Permissions('shift-handover:submit')
  @ApiOperation({ summary: 'Submit shift handover (DRAFT -> SUBMITTED)' })
  submit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.submit(id, userId, ctx);
  }

  @Post(':id/acknowledge')
  @Permissions('shift-handover:acknowledge')
  @ApiOperation({ summary: 'Acknowledge shift handover (SUBMITTED -> ACKNOWLEDGED)' })
  acknowledge(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.acknowledge(id, userId, ctx);
  }

  @Get(':id/items')
  @Permissions('shift-handover:read')
  @ApiOperation({ summary: 'List shift handover items' })
  listItems(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.listItems(id, ctx);
  }

  @Post(':id/items')
  @Permissions('shift-handover:create')
  @ApiOperation({ summary: 'Add item to shift handover (DRAFT only)' })
  addItem(
    @Param('id') id: string,
    @Body() dto: CreateShiftHandoverItemDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.addItem(id, { ...dto, shiftHandoverId: id }, userId, ctx);
  }

  @Delete('items/:itemId')
  @Permissions('shift-handover:create')
  @ApiOperation({ summary: 'Remove item from shift handover (DRAFT only)' })
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.removeItem(itemId, userId, ctx);
  }
}
