import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RepairOrdersService } from './repair-orders.service';
import {
  QueryRepairOrderDto, CreateRepairOrderDto, CreateRepairOrderFromReplacementDto,
  CompleteServiceableDto, CompletePartialDto, ScrapRepairOrderDto,
  CancelRepairOrderDto, CreateRepairActionDto, QueryRepairablePartsDto, UpdateRepairStatusDto,
} from './dto/repair-order.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Repair Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/repair-orders', version: '1' })
export class RepairOrdersController {
  constructor(private service: RepairOrdersService) {}

  @Get()
  @Permissions('repair-orders:read')
  @ApiOperation({ summary: 'List repair orders with optional filters' })
  findAll(@Query() query: QueryRepairOrderDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get('queue')
  @Permissions('repair-orders:read')
  @ApiOperation({ summary: 'List repairable returned parts queue' })
  findRepairableQueue(@Query() query: QueryRepairablePartsDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findRepairableQueue(query, ctx);
  }

  @Get(':id')
  @Permissions('repair-orders:read')
  @ApiOperation({ summary: 'Get repair order by ID' })
  findById(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findById(id, ctx);
  }

  @Post()
  @Permissions('repair-orders:create')
  @ApiOperation({ summary: 'Create a new repair order' })
  create(@Body() dto: CreateRepairOrderDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Post('from-replacement-history')
  @Permissions('repair-orders:create')
  @ApiOperation({ summary: 'Create repair order from replacement history' })
  createFromReplacement(@Body() dto: CreateRepairOrderFromReplacementDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createFromReplacementHistory(dto, userId, ctx);
  }

  @Post(':id/start-inspection')
  @Permissions('repair-orders:manage')
  @ApiOperation({ summary: 'Start inspection' })
  startInspection(@Param('id') id: string, @Body() dto: UpdateRepairStatusDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.startInspection(id, dto, userId, ctx);
  }

  @Post(':id/approve-repair')
  @Permissions('repair-orders:manage')
  @ApiOperation({ summary: 'Approve for repair' })
  approveRepair(@Param('id') id: string, @Body() dto: UpdateRepairStatusDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approveRepair(id, dto, userId, ctx);
  }

  @Post(':id/start-repair')
  @Permissions('repair-orders:manage')
  @ApiOperation({ summary: 'Start repair' })
  startRepair(@Param('id') id: string, @Body() dto: UpdateRepairStatusDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.startRepair(id, dto, userId, ctx);
  }

  @Post(':id/start-test')
  @Permissions('repair-orders:manage')
  @ApiOperation({ summary: 'Start test' })
  startTest(@Param('id') id: string, @Body() dto: UpdateRepairStatusDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.startTest(id, dto, userId, ctx);
  }

  @Post(':id/complete-serviceable')
  @Permissions('repair-orders:complete')
  @ApiOperation({ summary: 'Complete repair as serviceable' })
  completeServiceable(@Param('id') id: string, @Body() dto: CompleteServiceableDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.completeServiceable(id, dto, userId, ctx);
  }

  @Post(':id/complete-partial')
  @Permissions('repair-orders:complete')
  @ApiOperation({ summary: 'Complete repair as partial' })
  completePartial(@Param('id') id: string, @Body() dto: CompletePartialDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.completePartial(id, dto, userId, ctx);
  }

  @Post(':id/scrap')
  @Permissions('repair-orders:scrap')
  @ApiOperation({ summary: 'Scrap repair order' })
  scrap(@Param('id') id: string, @Body() dto: ScrapRepairOrderDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.scrap(id, dto, userId, ctx);
  }

  @Post(':id/cancel')
  @Permissions('repair-orders:manage')
  @ApiOperation({ summary: 'Cancel repair order' })
  cancel(@Param('id') id: string, @Body() dto: CancelRepairOrderDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Get(':id/actions')
  @Permissions('repair-orders:read')
  @ApiOperation({ summary: 'Get actions for a repair order' })
  getActions(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getActions(id, ctx);
  }

  @Post(':id/actions')
  @Permissions('repair-actions:create')
  @ApiOperation({ summary: 'Add action to repair order' })
  addAction(@Param('id') id: string, @Body() dto: CreateRepairActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.addAction(id, dto, userId, ctx);
  }
}
