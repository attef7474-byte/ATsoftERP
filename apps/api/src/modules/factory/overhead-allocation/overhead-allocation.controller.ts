import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { OVERHEAD_ALLOCATION_PERMISSION_KEYS as P } from '../../../../prisma/seed/seed-overhead-allocation-permission-keys';
import { AllocationActionDto, AllocationNotesDto, AllocationPageDto, AllocationQueryDto, CreateOverheadAllocationDto } from './overhead-allocation.dto';
import { OverheadAllocationService } from './overhead-allocation.service';

@ApiTags('Overhead Allocation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production/overhead-allocations', version: '1' })
export class OverheadAllocationController {
  constructor(private readonly service: OverheadAllocationService) {}
  @Get() @Permissions(P.read)
  list(@Query() query: AllocationQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findAll(query, ctx); }
  @Get('eligible-periods') @Permissions(P.read)
  periods(@Query() query: AllocationQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.periods(query, ctx); }
  @Post() @Permissions(P.create)
  create(@Body() dto: CreateOverheadAllocationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.create(dto, userId, ctx); }
  @Get(':id') @Permissions(P.read)
  detail(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }
  @Patch(':id') @Permissions(P.update)
  update(@Param('id') id: string, @Body() dto: AllocationNotesDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.update(id, dto, userId, ctx); }
  @Post(':id/calculate') @Permissions(P.calculate)
  calculate(@Param('id') id: string, @Body() dto: AllocationActionDto, @Query() query: AllocationPageDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.calculate(id, query, ctx); }
  @Patch(':id/finalize') @Permissions(P.finalize)
  finalize(@Param('id') id: string, @Body() dto: AllocationActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.finalize(id, userId, ctx); }
  @Get(':id/lines') @Permissions(P.read)
  lines(@Param('id') id: string, @Query() query: AllocationPageDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.lines(id, query, ctx); }
  @Get(':id/sources') @Permissions(P.read)
  sources(@Param('id') id: string, @Query() query: AllocationPageDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.sources(id, query, ctx); }
  @Get(':id/history') @Permissions(P.read)
  history(@Param('id') id: string, @Query() query: AllocationPageDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.history(id, query, ctx); }
}
