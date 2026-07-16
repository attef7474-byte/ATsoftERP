import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { DashboardService } from './dashboard.service'
import { Permissions } from '../../common/decorators/permissions.decorator'

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get dashboard summary counts' })
  async getSummary() {
    return this.service.getSummary()
  }

  @Get('operations')
  @Permissions('dashboard.operations.view')
  @ApiOperation({ summary: 'Get operations dashboard data' })
  async getOperations() {
    return this.service.getOperations()
  }

  @Get('kpis')
  @Permissions('dashboard.view')
  @ApiOperation({ summary: 'Get KPI data' })
  async getKpis() {
    return this.service.getKpis()
  }
}
