import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceContextService } from './performance-context.service';

@ApiTags('performance-context')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance', version: '1' })
export class PerformanceContextController {
  constructor(private service: PerformanceContextService) {}

  @Get('employees/:operationalPersonId/context')
  @Permissions('performance-context:read')
  @ApiOperation({ summary: 'Resolve employee performance context for an effective date' })
  resolve(@Param('operationalPersonId') operationalPersonId: string, @Query('effectiveAt') effectiveAt: string | undefined, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.resolve(operationalPersonId, ctx, effectiveAt);
  }
}
