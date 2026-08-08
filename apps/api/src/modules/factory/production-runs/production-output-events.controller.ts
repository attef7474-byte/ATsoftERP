import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionRunsService } from './production-runs.service';
import { CorrectOutputDto } from './dto/correct-output.dto';

@ApiTags('production-output-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/output-events')
export class ProductionOutputEventsController {
  constructor(private readonly service: ProductionRunsService) {}

  @Post(':id/correct')
  @Permissions('production-output:correct')
  @ApiOperation({ summary: 'Immutable compensation event against an existing output event' })
  correct(@Param('id') id: string, @Body() dto: CorrectOutputDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.correctOutput(id, dto, userId, ctx);
  }
}