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
import { ProductionShiftAssignmentsService } from './production-shift-assignments.service';
import { CreateProductionShiftAssignmentDto, UpdateProductionShiftAssignmentDto, ProductionShiftAssignmentQueryDto } from './dto/create-production-shift-assignment.dto';

@ApiTags('production-shift-assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/shift-assignments')
export class ProductionShiftAssignmentsController {
  constructor(private readonly assignmentsService: ProductionShiftAssignmentsService) {}

  @Post()
  @Permissions('production-shift-assignment:create')
  @ApiOperation({ summary: 'Create a person->shift assignment' })
  create(@Body() dto: CreateProductionShiftAssignmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-shift-assignment:read')
  @ApiOperation({ summary: 'List shift assignments (tenant scoped)' })
  findAll(@Query() query: ProductionShiftAssignmentQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.findAll(query, ctx);
  }

  @Get('current/:operationalPersonId')
  @Permissions('production-shift-assignment:read')
  @ApiOperation({ summary: 'Resolve current active shift assignment(s) for a person on a date' })
  findCurrent(@Param('operationalPersonId') operationalPersonId: string, @CurrentActiveContext() ctx: ActiveOperationalContext, @Query('on') on?: string) {
    return this.assignmentsService.findCurrent(operationalPersonId, on, ctx);
  }

  @Get(':id')
  @Permissions('production-shift-assignment:read')
  @ApiOperation({ summary: 'Get one shift assignment' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-shift-assignment:update')
  @ApiOperation({ summary: 'Update a shift assignment' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionShiftAssignmentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-shift-assignment:delete')
  @ApiOperation({ summary: 'Soft delete a shift assignment' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-shift-assignment:update')
  @ApiOperation({ summary: 'Activate a shift assignment' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-shift-assignment:update')
  @ApiOperation({ summary: 'Deactivate a shift assignment' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.assignmentsService.deactivate(id, userId, ctx);
  }
}