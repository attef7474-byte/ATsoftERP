import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionDowntimeService } from './production-downtime.service';
import { PRODUCTION_DOWNTIME_PERMISSION_KEYS } from './production-downtime.constants';
import {
  CancelDowntimeDto,
  CloseDowntimeDto,
  CorrectDowntimeDto,
  DowntimeQueryDto,
  LinkMaintenanceDto,
  OpenDowntimeDto,
} from './dto/production-downtime.dto';

@ApiTags('production-downtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/downtime')
export class ProductionDowntimeController {
  constructor(private readonly service: ProductionDowntimeService) {}

  @Post()
  @Permissions(PRODUCTION_DOWNTIME_PERMISSION_KEYS.record)
  @ApiOperation({ summary: 'Open (record) a production downtime segment' })
  open(@Body() dto: OpenDowntimeDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.open(dto, userId, ctx);
  }

  @Get()
  @Permissions(PRODUCTION_DOWNTIME_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List downtime segments' })
  findAll(@Query() query: DowntimeQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions(PRODUCTION_DOWNTIME_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get a downtime segment by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id/close')
  @Permissions(PRODUCTION_DOWNTIME_PERMISSION_KEYS.close)
  @ApiOperation({ summary: 'Close an open downtime segment' })
  close(@Param('id') id: string, @Body() dto: CloseDowntimeDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.close(id, dto, userId, ctx);
  }

  @Patch(':id/correct')
  @Permissions(PRODUCTION_DOWNTIME_PERMISSION_KEYS.correct)
  @ApiOperation({ summary: 'Correct a downtime segment (creates a superseding segment)' })
  correct(@Param('id') id: string, @Body() dto: CorrectDowntimeDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.correct(id, dto, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions(PRODUCTION_DOWNTIME_PERMISSION_KEYS.correct)
  @ApiOperation({ summary: 'Cancel an open downtime segment' })
  cancel(@Param('id') id: string, @Body() dto: CancelDowntimeDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Patch(':id/link-maintenance')
  @Permissions(PRODUCTION_DOWNTIME_PERMISSION_KEYS.linkMaintenance)
  @ApiOperation({ summary: 'Link a maintenance request/work order to a downtime segment' })
  linkMaintenance(@Param('id') id: string, @Body() dto: LinkMaintenanceDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.linkMaintenance(id, dto, userId, ctx);
  }
}
