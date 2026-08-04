import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionMeasurementPointsService } from './production-measurement-points.service';
import { CreateMeasurementPointDto } from './dto/create-measurement-point.dto';
import { UpdateMeasurementPointDto } from './dto/update-measurement-point.dto';
import { MeasurementPointQueryDto } from './dto/measurement-point-query.dto';

@ApiTags('production-measurement-points')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/measurement-points')
export class ProductionMeasurementPointsController {
  constructor(private readonly service: ProductionMeasurementPointsService) {}

  @Post()
  @Permissions('production-measurement-point:create')
  create(@Body() dto: CreateMeasurementPointDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-measurement-point:read')
  findAll(@Query() query: MeasurementPointQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('production-measurement-point:read')
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-measurement-point:update')
  update(@Param('id') id: string, @Body() dto: UpdateMeasurementPointDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('production-measurement-point:delete')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }

  @Post(':id/activate')
  @Permissions('production-measurement-point:activate')
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.activate(id, userId, ctx);
  }

  @Post(':id/deactivate')
  @Permissions('production-measurement-point:deactivate')
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivate(id, userId, ctx);
  }
}