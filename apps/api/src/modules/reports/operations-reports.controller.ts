import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { OperationsReportExportDto, OperationsReportPageDto, OperationsReportQueryDto } from './dto/operations-report-query.dto';
import { OPERATIONS_REPORT_PERMISSION_KEYS } from './operations-reports.constants';
import { OperationsReportsService } from './services/operations-reports.service';

@ApiTags('Operations Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'reports/operations', version: '1' })
export class OperationsReportsController {
  constructor(private readonly service: OperationsReportsService) {}

  @Get('overview')
  @Permissions(OPERATIONS_REPORT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Bounded cross-domain operations overview with OEE, reliability and atomic operational cost' })
  overview(@Query() query: OperationsReportQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.overview(query, ctx);
  }

  @Get('drilldown')
  @Permissions(OPERATIONS_REPORT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Paged authoritative production-run/OEE drilldown for the operations report' })
  drilldown(@Query() query: OperationsReportPageDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.drilldown(query, ctx);
  }

  @Post('export')
  @Permissions(OPERATIONS_REPORT_PERMISSION_KEYS.export)
  @ApiOperation({ summary: 'Bounded audited operations report CSV export' })
  export(@Body() dto: OperationsReportExportDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.export(dto, userId, ctx);
  }
}
