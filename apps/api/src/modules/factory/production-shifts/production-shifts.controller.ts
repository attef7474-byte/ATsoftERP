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
import { ProductionShiftsService } from './production-shifts.service';
import { CreateProductionShiftDto } from './dto/create-production-shift.dto';
import { UpdateProductionShiftDto } from './dto/update-production-shift.dto';
import { ProductionShiftQueryDto } from './dto/production-shift-query.dto';

@ApiTags('production-shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/shifts')
export class ProductionShiftsController {
  constructor(private readonly shiftsService: ProductionShiftsService) {}

  @Post()
  @Permissions('production-shift:create')
  @ApiOperation({ summary: 'Create a production shift' })
  create(@Body() dto: CreateProductionShiftDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.shiftsService.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-shift:read')
  @ApiOperation({ summary: 'List production shifts (tenant scoped)' })
  findAll(@Query() query: ProductionShiftQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.shiftsService.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('production-shift:read')
  @ApiOperation({ summary: 'Get one production shift' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.shiftsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-shift:update')
  @ApiOperation({ summary: 'Update a production shift' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionShiftDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.shiftsService.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-shift:delete')
  @ApiOperation({ summary: 'Soft delete a production shift' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.shiftsService.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-shift:update')
  @ApiOperation({ summary: 'Activate a production shift' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.shiftsService.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-shift:update')
  @ApiOperation({ summary: 'Deactivate a production shift' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.shiftsService.deactivate(id, userId, ctx);
  }
}
