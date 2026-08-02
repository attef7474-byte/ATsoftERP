import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger'
import { AlertsService } from './alerts.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { Permissions } from '../../common/decorators/permissions.decorator'
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator'
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types'

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @Permissions('alerts.view')
  @ApiOperation({ summary: 'List all derived alerts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(@CurrentActiveContext() ctx: ActiveOperationalContext, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('severity') severity?: string, @Query('status') status?: string) {
    return this.service.findAll(Number(page) || 1, Number(pageSize) || 20, severity, status, ctx)
  }

  @Get('summary')
  @Permissions('alerts.view')
  @ApiOperation({ summary: 'Get alert summary counts' })
  async getSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getSummary(ctx)
  }

  @Get(':id')
  @Permissions('alerts.view')
  @ApiOperation({ summary: 'Get alert by ID' })
  async findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx)
  }
}
