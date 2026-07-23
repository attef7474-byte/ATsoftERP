import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SparePartsService } from './spare-parts.service';
import { CreateSparePartDto, UpdateSparePartDto } from './dto/create-spare-part.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Spare Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/spare-parts', version: '1' })
export class SparePartsController {
  constructor(private service: SparePartsService) {}

  @Post()
  @Permissions('spare-part:create')
  @ApiOperation({ summary: 'Create spare part' })
  create(@Body() dto: CreateSparePartDto, @CurrentUser('sub') userId: string) { return this.service.create(dto, userId); }

  @Get()
  @Permissions('spare-part:read')
  @ApiOperation({ summary: 'List spare parts' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; code?: string; name?: string; category?: string; partNumber?: string; barcode?: string; isCritical?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search, code: query.code, name: query.name, category: query.category,
      partNumber: query.partNumber, barcode: query.barcode, isCritical: query.isCritical, status: query.status,
    });
  }

  @Get(':id')
  @Permissions('spare-part:read')
  @ApiOperation({ summary: 'Get spare part by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('spare-part:update')
  @ApiOperation({ summary: 'Update spare part' })
  update(@Param('id') id: string, @Body() dto: UpdateSparePartDto, @CurrentUser('sub') userId: string) { return this.service.update(id, dto, userId); }

  @Patch(':id/activate')
  @Permissions('spare-part:activate')
  @ApiOperation({ summary: 'Activate spare part' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string) { return this.service.activate(id, userId); }

  @Patch(':id/deactivate')
  @Permissions('spare-part:deactivate')
  @ApiOperation({ summary: 'Deactivate spare part' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) { return this.service.deactivate(id, userId); }

  @Delete(':id')
  @Permissions('spare-part:delete')
  @ApiOperation({ summary: 'Soft delete spare part' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) { return this.service.remove(id, userId); }
}
