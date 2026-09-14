import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperationalOverheadService } from './operational-overhead.service';
import { OVERHEAD_PERMISSION_KEYS } from './operational-overhead.constants';
import {
  CloseOverheadPeriodDto,
  CreateOverheadPeriodDto,
  OpenOverheadPeriodDto,
  OverheadPeriodQueryDto,
  UpdateOverheadPeriodDto,
} from './dto/overhead-period.dto';
import {
  CreateOverheadEntryDto,
  FinalizeOverheadEntryDto,
  OverheadEntryQueryDto,
  UpdateOverheadEntryDto,
} from './dto/overhead-entry.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Operational Overhead')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production', version: '1' })
export class OperationalOverheadController {
  constructor(private readonly service: OperationalOverheadService) {}

  // ── Periods ──────────────────────────────────────────────────────────────────

  @Post('overhead-periods')
  @Permissions(OVERHEAD_PERMISSION_KEYS.periodCreate)
  @ApiOperation({ summary: 'Create a DRAFT overhead period (half-open [periodFrom, periodTo), no overlap)' })
  createPeriod(@Body() dto: CreateOverheadPeriodDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createPeriod(dto, userId, ctx);
  }

  @Get('overhead-periods')
  @Permissions(OVERHEAD_PERMISSION_KEYS.periodRead)
  @ApiOperation({ summary: 'List overhead periods scoped to the active context' })
  findPeriods(@Query() query: OverheadPeriodQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findPeriods(query, ctx);
  }

  @Get('overhead-periods/:id')
  @Permissions(OVERHEAD_PERMISSION_KEYS.periodRead)
  @ApiOperation({ summary: 'Get overhead period by ID (tenant-scoped, includes its entries)' })
  findOnePeriod(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOnePeriod(id, ctx);
  }

  @Patch('overhead-periods/:id')
  @Permissions(OVERHEAD_PERMISSION_KEYS.periodUpdate)
  @ApiOperation({ summary: 'Update a DRAFT/OPEN overhead period' })
  updatePeriod(@Param('id') id: string, @Body() dto: UpdateOverheadPeriodDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updatePeriod(id, dto, userId, ctx);
  }

  @Patch('overhead-periods/:id/open')
  @Permissions(OVERHEAD_PERMISSION_KEYS.periodUpdate)
  @ApiOperation({ summary: 'Open a DRAFT period to receive source entries' })
  openPeriod(@Param('id') id: string, @Body() dto: OpenOverheadPeriodDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.openPeriod(id, dto, userId, ctx);
  }

  @Patch('overhead-periods/:id/close')
  @Permissions(OVERHEAD_PERMISSION_KEYS.periodClose)
  @ApiOperation({ summary: 'Close an OPEN period (requires all entries FINALIZED; CLOSED is immutable)' })
  closePeriod(@Param('id') id: string, @Body() dto: CloseOverheadPeriodDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.closePeriod(id, dto, userId, ctx);
  }

  @Delete('overhead-periods/:id')
  @Permissions(OVERHEAD_PERMISSION_KEYS.periodDelete)
  @ApiOperation({ summary: 'Cancel an empty DRAFT period' })
  cancelPeriod(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancelPeriod(id, userId, ctx);
  }

  // ── Entries ──────────────────────────────────────────────────────────────────

  @Post('overhead-entries')
  @Permissions(OVERHEAD_PERMISSION_KEYS.entryCreate)
  @ApiOperation({ summary: 'Create a DRAFT overhead source entry in an OPEN period' })
  createEntry(@Body() dto: CreateOverheadEntryDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createEntry(dto, userId, ctx);
  }

  @Get('overhead-entries')
  @Permissions(OVERHEAD_PERMISSION_KEYS.entryRead)
  @ApiOperation({ summary: 'List overhead source entries scoped to the active context' })
  findEntries(@Query() query: OverheadEntryQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findEntries(query, ctx);
  }

  @Get('overhead-entries/:id')
  @Permissions(OVERHEAD_PERMISSION_KEYS.entryRead)
  @ApiOperation({ summary: 'Get overhead source entry by ID (tenant-scoped)' })
  findOneEntry(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOneEntry(id, ctx);
  }

  @Patch('overhead-entries/:id')
  @Permissions(OVERHEAD_PERMISSION_KEYS.entryUpdate)
  @ApiOperation({ summary: 'Update a DRAFT overhead source entry' })
  updateEntry(@Param('id') id: string, @Body() dto: UpdateOverheadEntryDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateEntry(id, dto, userId, ctx);
  }

  @Patch('overhead-entries/:id/finalize')
  @Permissions(OVERHEAD_PERMISSION_KEYS.entryFinalize)
  @ApiOperation({ summary: 'Finalize a DRAFT source entry (FINALIZED is immutable)' })
  finalizeEntry(@Param('id') id: string, @Body() dto: FinalizeOverheadEntryDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.finalizeEntry(id, dto, userId, ctx);
  }

  @Delete('overhead-entries/:id')
  @Permissions(OVERHEAD_PERMISSION_KEYS.entryDelete)
  @ApiOperation({ summary: 'Delete (soft) a DRAFT overhead source entry' })
  deleteEntry(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deleteEntry(id, userId, ctx);
  }
}
