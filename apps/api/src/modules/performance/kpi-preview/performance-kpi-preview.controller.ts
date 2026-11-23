import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceKpiPreviewService } from './performance-kpi-preview.service';
import { PreviewPerformanceKpiDto } from '../dto/preview-performance-kpi.dto';

@ApiTags('performance-kpi-preview')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance/kpis/preview', version: '1' })
export class PerformanceKpiPreviewController {
  constructor(private readonly service: PerformanceKpiPreviewService) {}

  @Post()
  @Permissions('performance-kpi-preview:read')
  @ApiOperation({ summary: 'Preview raw KPI metric for an employee over a bounded period' })
  preview(@Body() dto: PreviewPerformanceKpiDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.preview(dto, ctx);
  }
}
