import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessPartnerGroupsService } from './groups.service';
import { CreateBusinessPartnerGroupDto } from './dto/create-group.dto';
import { UpdateBusinessPartnerGroupDto } from './dto/update-group.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Business Partner Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'business-partner-groups', version: '1' })
export class BusinessPartnerGroupsController {
  constructor(private service: BusinessPartnerGroupsService) {}

  @Post()
  @Permissions('business-partner-group:create')
  @ApiOperation({ summary: 'Create a business partner group' })
  create(@Body() dto: CreateBusinessPartnerGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('business-partner-group:read')
  @ApiOperation({ summary: 'List business partner groups' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('business-partner-group:read')
  @ApiOperation({ summary: 'Get group by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('business-partner-group:update')
  @ApiOperation({ summary: 'Update group' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('business-partner-group:delete')
  @ApiOperation({ summary: 'Soft delete group' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
