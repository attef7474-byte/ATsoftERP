import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ArchiveReadable } from '../../../common/decorators/archive-readable.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionPlanningService } from './production-planning.service';
import { ApplyPlanningScheduleDto, PreviewPlanningScheduleDto } from './dto/planning-schedule.dto';

@ApiTags('production-planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/planning')
export class ProductionPlanningController {
  constructor(private readonly service: ProductionPlanningService) {}

  @Post('preview')
  @ArchiveReadable()
  @Permissions('production-order:readiness')
  @ApiOperation({ summary: 'Deterministic finite-capacity schedule draft (read-only, persists nothing)' })
  preview(@Body() dto: PreviewPlanningScheduleDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.preview(dto, ctx);
  }

  @Post('apply')
  @Permissions('production-order:plan')
  @ApiOperation({ summary: 'Apply a reviewed schedule draft to editable orders (tenant + lockVersion guarded, atomic)' })
  apply(@Body() dto: ApplyPlanningScheduleDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.apply(dto, userId, ctx);
  }
}
