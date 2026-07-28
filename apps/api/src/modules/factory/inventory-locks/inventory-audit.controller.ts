import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AuditService } from '../../../common/audit/audit.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../auth/guards/permissions.guard'
import { Permissions } from '../../auth/decorators/permissions.decorator'

@ApiTags('Inventory Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'inventory/audit', version: '1' })
export class InventoryAuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @Permissions('inventory:audit:read')
  @ApiOperation({ summary: 'List inventory audit logs' })
  findAll(@Query() query: { page?: number; limit?: number; userId?: string; entity?: string; action?: string; startDate?: string; endDate?: string; search?: string }) {
    return this.audit.findAll({ ...query, entity: query.entity || undefined })
  }

  @Get('summary')
  @Permissions('inventory:audit:read')
  @ApiOperation({ summary: 'Get audit summary' })
  getSummary() {
    return this.audit.getSummary()
  }

  @Get('export')
  @Permissions('inventory:audit:export')
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  exportCsv(@Query() query: { userId?: string; entity?: string; action?: string; startDate?: string; endDate?: string }) {
    return this.audit.exportCsv(query)
  }

  @Get(':id')
  @Permissions('inventory:audit:read')
  @ApiOperation({ summary: 'Get audit log by id' })
  findOne(@Param('id') id: string) {
    return this.audit.findOne(id)
  }
}
