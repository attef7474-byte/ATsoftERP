import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InstalledPartsReplacementService } from './installed-parts-replacement.service';
import { QueryInstalledPartDto, QueryReplacementHistoryDto, SetExpectedLifeDto, RecordInstalledPartReadingDto } from './dto/installed-parts-replacement.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Installed Parts & Replacement History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'installed-parts', version: '1' })
export class InstalledPartsReplacementController {
  constructor(private service: InstalledPartsReplacementService) {}

  @Get()
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'List installed parts with optional filters' })
  getInstalledParts(@Query() query: QueryInstalledPartDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInstalledParts(query, ctx);
  }

  @Get('by-machine/:machineId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get installed parts for a machine' })
  getInstalledPartsByMachine(@Param('machineId') machineId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInstalledPartsByMachine(machineId, ctx);
  }

  @Get('by-machine/:machineId/count')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get count of active installed parts for a machine' })
  getActiveCount(@Param('machineId') machineId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getActiveInstalledPartsCount(machineId, ctx);
  }

  @Get('by-request/:maintenanceRequestId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get installed parts for a maintenance request' })
  getInstalledPartsByRequest(@Param('maintenanceRequestId') maintenanceRequestId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInstalledPartsByRequest(maintenanceRequestId, ctx);
  }

  @Get('replacement-history')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'List replacement history with optional filters' })
  getReplacementHistory(@Query() query: QueryReplacementHistoryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getReplacementHistory(query, ctx);
  }

  @Get('replacement-history/by-machine/:machineId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get replacement history for a machine' })
  getReplacementHistoryByMachine(@Param('machineId') machineId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getReplacementHistoryByMachine(machineId, ctx);
  }

  @Get('replacement-history/by-machine/:machineId/count')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get count of replacements for a machine' })
  getReplacementCount(@Param('machineId') machineId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getReplacementCount(machineId, ctx);
  }

  @Get('replacement-history/by-request/:maintenanceRequestId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get replacement history for a maintenance request' })
  getReplacementHistoryByRequest(@Param('maintenanceRequestId') maintenanceRequestId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getReplacementHistoryByRequest(maintenanceRequestId, ctx);
  }

  @Post('evaluate-expected-life')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Evaluate expected life for all scoped active installed parts' })
  evaluateAll(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.evaluateAll(ctx);
  }

  @Patch(':id/expected-life')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Configure expected life for an installed part' })
  setExpectedLife(@Param('id') id: string, @Body() dto: SetExpectedLifeDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.setExpectedLife(id, dto, userId, ctx);
  }

  @Get(':id/readings')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get readings for an installed part' })
  getReadings(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getReadings(id, ctx);
  }

  @Post(':id/readings')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Record a reading for an installed part' })
  recordReading(@Param('id') id: string, @Body() dto: RecordInstalledPartReadingDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.recordReading(id, dto, userId, ctx);
  }

  @Get(':id')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get installed part by ID' })
  getInstalledPartById(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getInstalledPartById(id, ctx);
  }
}
