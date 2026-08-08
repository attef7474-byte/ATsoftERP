import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionPerformanceTargetsService } from './production-performance-targets.service';
import { PerformanceTargetQueryDto } from './dto/analytics-query.dto';
import {
  ApprovePerformanceTargetDto,
  CreatePerformanceTargetDto,
  DeactivatePerformanceTargetDto,
  DeletePerformanceTargetDto,
  SubmitPerformanceTargetDto,
  UpdatePerformanceTargetDto,
} from './dto/performance-target.dto';

@ApiTags('production-performance-targets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/performance-targets')
export class ProductionPerformanceTargetsController {
  constructor(private readonly service: ProductionPerformanceTargetsService) {}

  @Post()
  @Permissions('production-performance-target:create')
  @ApiOperation({ summary: 'Create a draft OEE performance target' })
  create(@Body() dto: CreatePerformanceTargetDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-performance-target:read')
  findAll(@Query() query: PerformanceTargetQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id/history')
  @Permissions('production-performance-target:read')
  history(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.history(id, ctx);
  }

  @Get(':id')
  @Permissions('production-performance-target:read')
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-performance-target:update')
  update(@Param('id') id: string, @Body() dto: UpdatePerformanceTargetDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('production-performance-target:delete')
  remove(@Param('id') id: string, @Body() dto: DeletePerformanceTargetDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.delete(id, userId, ctx);
  }

  @Post(':id/submit')
  @Permissions('production-performance-target:submit')
  @ApiOperation({ summary: 'Submit a draft target for approval' })
  submit(@Param('id') id: string, @Body() dto: SubmitPerformanceTargetDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.submit(id, userId, ctx, dto.requestId);
  }

  @Post(':id/approve')
  @Permissions('production-performance-target:approve')
  @ApiOperation({ summary: 'Approve a pending target' })
  approve(@Param('id') id: string, @Body() dto: ApprovePerformanceTargetDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approve(id, userId, ctx, dto.approvalNote, dto.requestId);
  }

  @Post(':id/revise')
  @Permissions('production-performance-target:create')
  @ApiOperation({ summary: 'Create a new draft revision from an approved target' })
  revise(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.revise(id, userId, ctx);
  }

  @Post(':id/deactivate')
  @Permissions('production-performance-target:deactivate')
  @ApiOperation({ summary: 'Deactivate an approved target' })
  deactivate(@Param('id') id: string, @Body() dto: DeactivatePerformanceTargetDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivate(id, dto.reason, userId, ctx, dto.requestId);
  }
}
