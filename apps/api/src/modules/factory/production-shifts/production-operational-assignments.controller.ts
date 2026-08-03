import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionOperationalAssignmentsService } from './production-operational-assignments.service';
import { CreateProductionOperationalAssignmentDto, UpdateProductionOperationalAssignmentDto, ProductionOperationalAssignmentQueryDto } from './dto/create-production-operational-assignment.dto';

@ApiTags('production-operational-assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/operational-assignments')
export class ProductionOperationalAssignmentsController {
  constructor(private readonly assignmentsService: ProductionOperationalAssignmentsService) {}

  @Post()
  @Permissions('production-operational-assignment:create')
  @ApiOperation({ summary: 'Create a resource (machine/line/unit) -> shift assignment' })
  create(@Body() dto: CreateProductionOperationalAssignmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-operational-assignment:read')
  @ApiOperation({ summary: 'List operational assignments (tenant scoped)' })
  findAll(@Query() query: ProductionOperationalAssignmentQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.findAll(query, ctx);
  }

  @Get('current')
  @Permissions('production-operational-assignment:read')
  @ApiOperation({ summary: 'Resolve current active assignment(s) for a resource on a date' })
  findCurrent(
    @Query('resourceType') resourceType: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @Query('machineId') machineId?: string,
    @Query('productionLineId') productionLineId?: string,
    @Query('productionUnitId') productionUnitId?: string,
    @Query('on') on?: string,
  ) {
    return this.assignmentsService.findCurrent(resourceType, { machineId, productionLineId, productionUnitId, on }, ctx);
  }

  @Get(':id')
  @Permissions('production-operational-assignment:read')
  @ApiOperation({ summary: 'Get one operational assignment' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-operational-assignment:update')
  @ApiOperation({ summary: 'Update an operational assignment' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionOperationalAssignmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-operational-assignment:delete')
  @ApiOperation({ summary: 'Soft delete an operational assignment' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-operational-assignment:update')
  @ApiOperation({ summary: 'Activate an operational assignment' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-operational-assignment:update')
  @ApiOperation({ summary: 'Deactivate an operational assignment' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.deactivate(id, userId, ctx);
  }
}