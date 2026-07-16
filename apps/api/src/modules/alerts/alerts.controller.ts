import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { AlertsService } from './alerts.service'
import { Permissions } from '../../common/decorators/permissions.decorator'

@ApiTags('Alerts')
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
  async findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('severity') severity?: string, @Query('status') status?: string) {
    return this.service.findAll(Number(page) || 1, Number(pageSize) || 20, severity, status)
  }

  @Get('summary')
  @Permissions('alerts.view')
  @ApiOperation({ summary: 'Get alert summary counts' })
  async getSummary() {
    return this.service.getSummary()
  }

  @Get(':id')
  @Permissions('alerts.view')
  @ApiOperation({ summary: 'Get alert by ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }
}
