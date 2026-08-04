import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionLossQuantityEventsService } from './production-loss-quantity-events.service';
import { PRODUCTION_LOSS_PERMISSION_KEYS } from './production-loss-quantity-events.constants';
import { CorrectLossDto, LossQueryDto, RecordLossDto } from './dto/production-loss-quantity-event.dto';

@ApiTags('production-loss-quantity-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/loss-quantity-events')
export class ProductionLossQuantityEventsController {
  constructor(private readonly service: ProductionLossQuantityEventsService) {}

  @Post()
  @Permissions(PRODUCTION_LOSS_PERMISSION_KEYS.record)
  @ApiOperation({ summary: 'Record a waste/scrap/rework quantity event' })
  record(@Body() dto: RecordLossDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.record(dto, userId, ctx);
  }

  @Get()
  @Permissions(PRODUCTION_LOSS_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List loss quantity events' })
  findAll(@Query() query: LossQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions(PRODUCTION_LOSS_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get a loss quantity event by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id/correct')
  @Permissions(PRODUCTION_LOSS_PERMISSION_KEYS.correct)
  @ApiOperation({ summary: 'Correct a loss quantity event (immutable compensating correction)' })
  correct(@Param('id') id: string, @Body() dto: CorrectLossDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.correct(id, dto, userId, ctx);
  }
}
