import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InstalledPartsReplacementService } from './installed-parts-replacement.service';
import { QueryInstalledPartDto, QueryReplacementHistoryDto } from './dto/installed-parts-replacement.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';

@ApiTags('Installed Parts & Replacement History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'installed-parts', version: '1' })
export class InstalledPartsReplacementController {
  constructor(private service: InstalledPartsReplacementService) {}

  @Get()
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'List installed parts with optional filters' })
  getInstalledParts(@Query() query: QueryInstalledPartDto) {
    return this.service.getInstalledParts(query);
  }

  @Get('by-machine/:machineId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get installed parts for a machine' })
  getInstalledPartsByMachine(@Param('machineId') machineId: string) {
    return this.service.getInstalledPartsByMachine(machineId);
  }

  @Get('by-machine/:machineId/count')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get count of active installed parts for a machine' })
  getActiveCount(@Param('machineId') machineId: string) {
    return this.service.getActiveInstalledPartsCount(machineId);
  }

  @Get('by-request/:maintenanceRequestId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get installed parts for a maintenance request' })
  getInstalledPartsByRequest(@Param('maintenanceRequestId') maintenanceRequestId: string) {
    return this.service.getInstalledPartsByRequest(maintenanceRequestId);
  }

  @Get('replacement-history')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'List replacement history with optional filters' })
  getReplacementHistory(@Query() query: QueryReplacementHistoryDto) {
    return this.service.getReplacementHistory(query);
  }

  @Get('replacement-history/by-machine/:machineId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get replacement history for a machine' })
  getReplacementHistoryByMachine(@Param('machineId') machineId: string) {
    return this.service.getReplacementHistoryByMachine(machineId);
  }

  @Get('replacement-history/by-machine/:machineId/count')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get count of replacements for a machine' })
  getReplacementCount(@Param('machineId') machineId: string) {
    return this.service.getReplacementCount(machineId);
  }

  @Get('replacement-history/by-request/:maintenanceRequestId')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get replacement history for a maintenance request' })
  getReplacementHistoryByRequest(@Param('maintenanceRequestId') maintenanceRequestId: string) {
    return this.service.getReplacementHistoryByRequest(maintenanceRequestId);
  }

  @Get(':id')
  @Permissions('installed-parts:read')
  @ApiOperation({ summary: 'Get installed part by ID' })
  getInstalledPartById(@Param('id') id: string) {
    return this.service.getInstalledPartById(id);
  }
}
