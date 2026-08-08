import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperationalReliabilityService } from './operational-reliability.service';
import { OPERATIONAL_RELIABILITY_PERMISSION_KEYS } from './operational-reliability.constants';
import { OperationalReliabilityDrilldownDto, OperationalReliabilityExportDto, OperationalReliabilityQueryDto } from './dto/operational-reliability-query.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Operational Reliability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'operational-analytics/reliability', version: '1' })
export class OperationalReliabilityController {
  constructor(private readonly service: OperationalReliabilityService) {}

  @Get()
  @Permissions(OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Operational reliability summary (maintenance reliability metrics + canonical OEE availability)' })
  summary(@Query() query: OperationalReliabilityQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.summary(query, ctx);
  }

  @Get('drilldown')
  @Permissions(OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Paged effective reliability event drilldown' })
  drilldown(@Query() query: OperationalReliabilityDrilldownDto, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.drilldown(query, ctx);
  }

  @Post('export')
  @Permissions(OPERATIONAL_RELIABILITY_PERMISSION_KEYS.export)
  @ApiOperation({ summary: 'Export operational reliability summary as CSV (audited)' })
  export(@Body() dto: OperationalReliabilityExportDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext): Promise<any> {
    return this.service.export(dto, userId, ctx);
  }
}
