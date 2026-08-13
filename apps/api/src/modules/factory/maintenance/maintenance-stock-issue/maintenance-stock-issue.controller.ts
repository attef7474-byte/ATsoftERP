import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { IssueStockDto, ReturnStockDto } from './dto/issue-stock.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Stock Issue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/requests/:requestId/parts/:lineId/stock-issue', version: '1' })
export class MaintenanceStockIssueController {
  constructor(private service: MaintenanceStockIssueService) {}

  @Post('issue')
  @Permissions('maintenance-stock-issue:create')
  @ApiOperation({ summary: 'Issue stock from warehouse for a spare part line' })
  issue(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @Body() dto: IssueStockDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.issue(requestId, lineId, dto, userId, ctx);
  }

  @Post('return')
  @Permissions('maintenance-stock-issue:create')
  @ApiOperation({ summary: 'Return unused stock to warehouse for a spare part line' })
  returnStock(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @Body() dto: ReturnStockDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.returnStock(requestId, lineId, dto, userId, ctx);
  }

  @Get()
  @Permissions('maintenance-stock-issue:read')
  @ApiOperation({ summary: 'List stock issue movements for a spare part line' })
  getIssues(
    @Param('requestId') requestId: string,
    @Param('lineId') lineId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.getIssues(lineId, requestId, ctx);
  }
}
