import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { Response } from 'express'
import { AuditService } from './audit.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../auth/guards/permissions.guard'
import { Permissions } from '../auth/decorators/permissions.decorator'

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('userId') userId?: string, @Query('entity') entity?: string, @Query('action') action?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Query('search') search?: string) {
    return this.auditService.findAll({ page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined, userId, entity, action, startDate, endDate, search })
  }

  @Get('summary')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get audit summary' })
  async getSummary() {
    return this.auditService.getSummary()
  }

  @Get('export/csv')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportCsv(@Query('userId') userId?: string, @Query('entity') entity?: string, @Query('action') action?: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @Res() res?: Response) {
    const csv = await this.auditService.exportCsv({ userId, entity, action, startDate, endDate })
    if (res) { res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"'); return res.send(csv) }
    return csv
  }

  @Get('user-activity')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get user activity audit logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async getUserActivity(@Query('page') page?: string, @Query('limit') limit?: string, @Query('userId') userId?: string) {
    return this.auditService.findAll({ page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined, userId })
  }

  @Get('login-history')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get login history audit logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async getLoginHistory(@Query('page') page?: string, @Query('limit') limit?: string, @Query('userId') userId?: string) {
    const pageNum = page ? parseInt(page, 10) : 1
    const limitNum = limit ? parseInt(limit, 10) : 20
    if (userId) {
      return this.auditService.findLoginHistory(userId, pageNum, limitNum)
    }
    const { data, meta } = await this.auditService.findAll({ page: pageNum, limit: limitNum, action: 'LOGIN' })
    return { data, meta }
  }

  @Get(':id')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get audit log by ID' })
  async findOne(@Param('id') id: string) {
    return this.auditService.findOne(id)
  }
}
