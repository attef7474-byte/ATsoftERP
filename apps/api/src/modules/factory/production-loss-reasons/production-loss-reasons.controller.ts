import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionLossReasonsService } from './production-loss-reasons.service';
import { CreateLossReasonDto } from './dto/create-loss-reason.dto';
import { UpdateLossReasonDto } from './dto/update-loss-reason.dto';
import { LossReasonQueryDto } from './dto/loss-reason-query.dto';

@ApiTags('production-loss-reasons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/loss-reasons')
export class ProductionLossReasonsController {
  constructor(private readonly service: ProductionLossReasonsService) {}

  @Post()
  @Permissions('production-loss-reason:create')
  @ApiOperation({ summary: 'Create an operational loss reason' })
  create(@Body() dto: CreateLossReasonDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-loss-reason:read')
  @ApiOperation({ summary: 'List operational loss reasons' })
  findAll(@Query() query: LossReasonQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get('active')
  @Permissions('production-loss-reason:read')
  @ApiOperation({ summary: 'List active loss reasons for lookups' })
  listActive(@Query('search') search: string | undefined, @Query('lossCategory') lossCategory: string | undefined, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.listActive(ctx, search, lossCategory);
  }

  @Get(':id')
  @Permissions('production-loss-reason:read')
  @ApiOperation({ summary: 'Get a loss reason by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-loss-reason:update')
  @ApiOperation({ summary: 'Update a loss reason' })
  update(@Param('id') id: string, @Body() dto: UpdateLossReasonDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-loss-reason:activate')
  @ApiOperation({ summary: 'Activate a loss reason' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-loss-reason:deactivate')
  @ApiOperation({ summary: 'Deactivate a loss reason' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivate(id, userId, ctx);
  }

  @Delete(':id')
  @Permissions('production-loss-reason:delete')
  @ApiOperation({ summary: 'Soft-delete a loss reason' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }
}
