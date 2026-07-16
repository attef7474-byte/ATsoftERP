import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../auth/guards/permissions.guard'
import { Permissions } from '../../auth/decorators/permissions.decorator'
import { AuditService } from '../../../modules/audit/audit.service'

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'users', version: '1' })
export class UserActivityController {
  constructor(private auditService: AuditService) {}

  @Get(':id/activity')
  @Permissions('users.loginHistory.view')
  @ApiOperation({ summary: 'Get user activity log' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findUserActivity(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auditService.findUserActivity(id, { page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined })
  }

  @Get(':id/login-history')
  @Permissions('users.loginHistory.view')
  @ApiOperation({ summary: 'Get user login history' })
  async findLoginHistory(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auditService.findLoginHistory(id, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20)
  }
}
