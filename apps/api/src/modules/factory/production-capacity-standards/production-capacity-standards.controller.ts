import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionCapacityStandardsService } from './production-capacity-standards.service';
import { CreateProductionCapacityStandardDto } from './dto/create-production-capacity-standard.dto';
import { UpdateProductionCapacityStandardDto } from './dto/update-production-capacity-standard.dto';
import { ProductionCapacityStandardQueryDto } from './dto/production-capacity-standard-query.dto';
import { ResolveProductionCapacityStandardDto } from './dto/resolve-production-capacity-standard.dto';
import { CapacityStandardReasonDto } from './dto/capacity-standard-reason.dto';

@ApiTags('production-capacity-standards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/capacity-standards')
export class ProductionCapacityStandardsController {
  constructor(private readonly service: ProductionCapacityStandardsService) {}

  @Post()
  @Permissions('production-capacity-standard:create')
  @ApiOperation({ summary: 'Create a draft product capacity standard' })
  create(@Body() dto: CreateProductionCapacityStandardDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-capacity-standard:read')
  findAll(@Query() query: ProductionCapacityStandardQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get('resolve')
  @Permissions('production-capacity-standard:resolve')
  @ApiOperation({ summary: 'Resolve the effective approved capacity standard' })
  resolve(@Query() query: ResolveProductionCapacityStandardDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.resolve(query, ctx);
  }

  @Get(':id/history')
  @Permissions('production-capacity-standard:read')
  history(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.history(id, ctx);
  }

  @Get(':id')
  @Permissions('production-capacity-standard:read')
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-capacity-standard:update')
  update(@Param('id') id: string, @Body() dto: UpdateProductionCapacityStandardDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Post(':id/revise')
  @Permissions('production-capacity-standard:update')
  revise(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.revise(id, userId, ctx);
  }

  @Post(':id/approve')
  @Permissions('production-capacity-standard:approve')
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approve(id, userId, ctx);
  }

  @Post(':id/suspend')
  @Permissions('production-capacity-standard:suspend')
  suspend(@Param('id') id: string, @Body() dto: CapacityStandardReasonDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.suspend(id, dto.reason, userId, ctx);
  }

  @Post(':id/reactivate')
  @Permissions('production-capacity-standard:reactivate')
  reactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reactivate(id, userId, ctx);
  }

  @Post(':id/archive')
  @Permissions('production-capacity-standard:archive')
  archive(@Param('id') id: string, @Body() dto: CapacityStandardReasonDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.archive(id, dto.reason, userId, ctx);
  }
}
