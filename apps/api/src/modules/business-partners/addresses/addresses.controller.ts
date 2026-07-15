import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessPartnerAddressesService } from './addresses.service';
import { CreateBusinessPartnerAddressDto } from './dto/create-address.dto';
import { UpdateBusinessPartnerAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Business Partner Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'business-partner-addresses', version: '1' })
export class BusinessPartnerAddressesController {
  constructor(private service: BusinessPartnerAddressesService) {}

  @Post()
  @Permissions('business-partner-address:create')
  @ApiOperation({ summary: 'Create an address' })
  create(@Body() dto: CreateBusinessPartnerAddressDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('business-partner-address:read')
  @ApiOperation({ summary: 'List addresses' })
  findAll(@Query() query: { page?: string; limit?: string; partnerId?: string; type?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      partnerId: query.partnerId,
      type: query.type,
    });
  }

  @Get(':id')
  @Permissions('business-partner-address:read')
  @ApiOperation({ summary: 'Get address by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('business-partner-address:update')
  @ApiOperation({ summary: 'Update address' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerAddressDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('business-partner-address:delete')
  @ApiOperation({ summary: 'Soft delete address' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
