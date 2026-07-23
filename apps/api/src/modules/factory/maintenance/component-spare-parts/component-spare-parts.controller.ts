import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ComponentSparePartsService } from './component-spare-parts.service';
import { CreateComponentSparePartDto, UpdateComponentSparePartDto } from './dto/create-component-spare-part.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Component Spare Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/component-spare-parts', version: '1' })
export class ComponentSparePartsController {
  constructor(private service: ComponentSparePartsService) {}

  @Post()
  @Permissions('component-spare-part:create')
  @ApiOperation({ summary: 'Link spare part to component' })
  create(@Body() dto: CreateComponentSparePartDto, @CurrentUser('sub') userId: string) { return this.service.create(dto, userId); }

  @Get()
  @Permissions('component-spare-part:read')
  @ApiOperation({ summary: 'List component spare part links' })
  findAll(@Query() query: { page?: string; limit?: string; componentId?: string; sparePartId?: string; isPrimary?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      componentId: query.componentId, sparePartId: query.sparePartId,
      isPrimary: query.isPrimary, status: query.status,
    });
  }

  @Get(':id')
  @Permissions('component-spare-part:read')
  @ApiOperation({ summary: 'Get component spare part link by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('component-spare-part:update')
  @ApiOperation({ summary: 'Update component spare part link' })
  update(@Param('id') id: string, @Body() dto: UpdateComponentSparePartDto, @CurrentUser('sub') userId: string) { return this.service.update(id, dto, userId); }

  @Patch(':id/deactivate')
  @Permissions('component-spare-part:deactivate')
  @ApiOperation({ summary: 'Deactivate component spare part link' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) { return this.service.deactivate(id, userId); }
}
