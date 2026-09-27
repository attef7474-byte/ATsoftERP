import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { MaintenanceCostSummaryService } from './maintenance-cost-summary.service';

@ApiTags('Maintenance Cost')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance-cost', version: '1' })
export class MaintenanceCostSummaryController {
  constructor(private readonly summaries: MaintenanceCostSummaryService) {}

  @Get('requests/:id/cost-summary')
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'Canonical ledger-backed cost summary for a maintenance request' })
  requestSummary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.summaries.requestSummary(id, ctx);
  }

  @Get('work-orders/:id/cost-summary')
  @Permissions('maintenance-work-order:read')
  @ApiOperation({ summary: 'Canonical ledger-backed cost summary for a maintenance work order' })
  workOrderSummary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.summaries.workOrderSummary(id, ctx);
  }
}
