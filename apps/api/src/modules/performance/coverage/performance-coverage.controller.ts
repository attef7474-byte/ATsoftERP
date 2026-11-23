import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceCoverageService } from './performance-coverage.service';

@ApiTags('performance-coverage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance/coverage', version: '1' })
export class PerformanceCoverageController {
  constructor(private service: PerformanceCoverageService) {}

  @Get()
  @Permissions('performance-coverage:read')
  summary(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.summary(ctx);
  }

  @Get('employees')
  @Permissions('performance-coverage:read')
  employees(@Query() query: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.employees({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      departmentId: query.departmentId,
      jobTitleId: query.jobTitleId,
      performanceProfileId: query.performanceProfileId,
      hasProfile: query.hasProfile,
      hasJobTitle: query.hasJobTitle,
      hasSupervisor: query.hasSupervisor,
    }, ctx);
  }
}
