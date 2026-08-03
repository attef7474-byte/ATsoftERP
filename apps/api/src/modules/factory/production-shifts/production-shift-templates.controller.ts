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
import { ProductionShiftTemplatesService } from './production-shift-templates.service';
import { CreateProductionShiftTemplateDto, UpdateProductionShiftTemplateDto } from './dto/create-production-shift-template.dto';
import { ProductionShiftTemplateQueryDto } from './dto/production-shift-template-query.dto';

@ApiTags('production-shift-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/shift-templates')
export class ProductionShiftTemplatesController {
  constructor(private readonly templatesService: ProductionShiftTemplatesService) {}

  @Post()
  @Permissions('production-shift-template:create')
  @ApiOperation({ summary: 'Create a production shift template' })
  create(@Body() dto: CreateProductionShiftTemplateDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.templatesService.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-shift-template:read')
  @ApiOperation({ summary: 'List production shift templates (tenant scoped)' })
  findAll(@Query() query: ProductionShiftTemplateQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.templatesService.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('production-shift-template:read')
  @ApiOperation({ summary: 'Get one production shift template' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.templatesService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-shift-template:update')
  @ApiOperation({ summary: 'Update a production shift template (replaces days)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionShiftTemplateDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.templatesService.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-shift-template:delete')
  @ApiOperation({ summary: 'Soft delete a production shift template' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.templatesService.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-shift-template:update')
  @ApiOperation({ summary: 'Activate a production shift template' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.templatesService.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-shift-template:update')
  @ApiOperation({ summary: 'Deactivate a production shift template' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.templatesService.deactivate(id, userId, ctx);
  }
}
