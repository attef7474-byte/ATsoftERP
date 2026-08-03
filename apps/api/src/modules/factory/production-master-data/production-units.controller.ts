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
import { ProductionUnitsService } from './production-units.service';
import { CreateProductionUnitDto } from './dto/create-production-unit.dto';
import { UpdateProductionUnitDto } from './dto/update-production-unit.dto';
import { ProductionUnitQueryDto } from './dto/production-unit-query.dto';

@ApiTags('production-units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/units')
export class ProductionUnitsController {
  constructor(private readonly unitsService: ProductionUnitsService) {}

  @Post()
  @Permissions('production-unit:create')
  @ApiOperation({ summary: 'Create a production unit' })
  create(@Body() dto: CreateProductionUnitDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.unitsService.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-unit:read')
  @ApiOperation({ summary: 'List production units (tenant scoped)' })
  findAll(@Query() query: ProductionUnitQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.unitsService.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('production-unit:read')
  @ApiOperation({ summary: 'Get one production unit' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.unitsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-unit:update')
  @ApiOperation({ summary: 'Update a production unit' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionUnitDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.unitsService.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-unit:delete')
  @ApiOperation({ summary: 'Soft delete a production unit' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.unitsService.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-unit:update')
  @ApiOperation({ summary: 'Activate a production unit' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.unitsService.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-unit:update')
  @ApiOperation({ summary: 'Deactivate a production unit' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.unitsService.deactivate(id, userId, ctx);
  }
}
