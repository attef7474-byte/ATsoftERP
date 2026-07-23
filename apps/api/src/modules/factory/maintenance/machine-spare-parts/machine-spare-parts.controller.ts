import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MachineSparePartsService } from './machine-spare-parts.service';
import { CreateMachineSparePartDto, UpdateMachineSparePartDto } from './dto/create-machine-spare-part.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Machine Spare Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/machine-spare-parts', version: '1' })
export class MachineSparePartsController {
  constructor(private service: MachineSparePartsService) {}

  @Post()
  @Permissions('machine-spare-part:create')
  @ApiOperation({ summary: 'Link spare part to machine' })
  create(@Body() dto: CreateMachineSparePartDto, @CurrentUser('sub') userId: string) { return this.service.create(dto, userId); }

  @Get()
  @Permissions('machine-spare-part:read')
  @ApiOperation({ summary: 'List machine spare part links' })
  findAll(@Query() query: { page?: string; limit?: string; machineId?: string; sparePartId?: string; isPrimary?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      machineId: query.machineId, sparePartId: query.sparePartId,
      isPrimary: query.isPrimary, status: query.status,
    });
  }

  @Get(':id')
  @Permissions('machine-spare-part:read')
  @ApiOperation({ summary: 'Get machine spare part link by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('machine-spare-part:update')
  @ApiOperation({ summary: 'Update machine spare part link' })
  update(@Param('id') id: string, @Body() dto: UpdateMachineSparePartDto, @CurrentUser('sub') userId: string) { return this.service.update(id, dto, userId); }

  @Patch(':id/deactivate')
  @Permissions('machine-spare-part:deactivate')
  @ApiOperation({ summary: 'Deactivate machine spare part link' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) { return this.service.deactivate(id, userId); }
}
