import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionShiftCalendarsService } from './production-shift-calendars.service';
import {
  CreateProductionShiftCalendarDto,
  UpdateProductionShiftCalendarDto,
  AddCalendarEntryDto,
  UpdateCalendarEntryDto,
  ProductionShiftCalendarQueryDto,
} from './dto/create-production-shift-calendar.dto';

@ApiTags('production-shift-calendars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/shift-calendars')
export class ProductionShiftCalendarsController {
  constructor(private readonly calendarsService: ProductionShiftCalendarsService) {}

  @Post()
  @Permissions('production-shift-calendar:create')
  @ApiOperation({ summary: 'Create a production shift calendar' })
  create(@Body() dto: CreateProductionShiftCalendarDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-shift-calendar:read')
  @ApiOperation({ summary: 'List production shift calendars (tenant scoped)' })
  findAll(@Query() query: ProductionShiftCalendarQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('production-shift-calendar:read')
  @ApiOperation({ summary: 'Get one production shift calendar' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.findOne(id, ctx);
  }

  @Get(':id/resolve')
  @Permissions('production-shift-calendar:read')
  @ApiOperation({ summary: 'Resolve the shift for a date on a calendar' })
  resolve(@Param('id') id: string, @Query('date') date: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.resolveDay(id, date, userId, ctx);
  }

  @Patch(':id')
  @Permissions('production-shift-calendar:update')
  @ApiOperation({ summary: 'Update a production shift calendar' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionShiftCalendarDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-shift-calendar:delete')
  @ApiOperation({ summary: 'Soft delete a production shift calendar' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.remove(id, userId, ctx);
  }

  @Post(':id/entries')
  @Permissions('production-shift-calendar:update')
  @ApiOperation({ summary: 'Add a calendar entry (date override)' })
  addEntry(@Param('id') id: string, @Body() dto: AddCalendarEntryDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.addEntry(id, dto, userId, ctx);
  }

  @Patch(':id/entries/:entryId')
  @Permissions('production-shift-calendar:update')
  @ApiOperation({ summary: 'Update a calendar entry' })
  updateEntry(@Param('id') id: string, @Param('entryId') entryId: string, @Body() dto: UpdateCalendarEntryDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.updateEntry(id, entryId, dto, userId, ctx);
  }

  @Delete(':id/entries/:entryId')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-shift-calendar:update')
  @ApiOperation({ summary: 'Delete a calendar entry' })
  removeEntry(@Param('id') id: string, @Param('entryId') entryId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.removeEntry(id, entryId, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-shift-calendar:update')
  @ApiOperation({ summary: 'Activate a production shift calendar' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-shift-calendar:update')
  @ApiOperation({ summary: 'Deactivate a production shift calendar' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.calendarsService.deactivate(id, userId, ctx);
  }
}