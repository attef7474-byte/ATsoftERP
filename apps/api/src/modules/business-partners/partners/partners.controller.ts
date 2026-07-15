import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessPartnersService } from './partners.service';
import { CreateBusinessPartnerDto } from './dto/create-partner.dto';
import { UpdateBusinessPartnerDto } from './dto/update-partner.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Business Partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'business-partners', version: '1' })
export class BusinessPartnersController {
  constructor(private service: BusinessPartnersService) {}

  @Post()
  @Permissions('business-partner:create')
  @ApiOperation({ summary: 'Create a business partner' })
  create(@Body() dto: CreateBusinessPartnerDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('business-partner:read')
  @ApiOperation({ summary: 'List business partners' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; status?: string; type?: string; isCustomer?: string; isSupplier?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
      type: query.type,
      isCustomer: query.isCustomer ? query.isCustomer === 'true' : undefined,
      isSupplier: query.isSupplier ? query.isSupplier === 'true' : undefined,
    });
  }

  @Get(':id')
  @Permissions('business-partner:read')
  @ApiOperation({ summary: 'Get business partner by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('business-partner:update')
  @ApiOperation({ summary: 'Update business partner' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('business-partner:delete')
  @ApiOperation({ summary: 'Soft delete business partner' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
