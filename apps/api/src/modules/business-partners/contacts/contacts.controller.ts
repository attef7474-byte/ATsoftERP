import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessPartnerContactsService } from './contacts.service';
import { CreateBusinessPartnerContactDto } from './dto/create-contact.dto';
import { UpdateBusinessPartnerContactDto } from './dto/update-contact.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Business Partner Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'business-partner-contacts', version: '1' })
export class BusinessPartnerContactsController {
  constructor(private service: BusinessPartnerContactsService) {}

  @Post()
  @Permissions('business-partner-contact:create')
  @ApiOperation({ summary: 'Create a contact' })
  create(@Body() dto: CreateBusinessPartnerContactDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('business-partner-contact:read')
  @ApiOperation({ summary: 'List contacts' })
  findAll(@Query() query: { page?: string; limit?: string; partnerId?: string; search?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      partnerId: query.partnerId,
      search: query.search,
    });
  }

  @Get(':id')
  @Permissions('business-partner-contact:read')
  @ApiOperation({ summary: 'Get contact by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('business-partner-contact:update')
  @ApiOperation({ summary: 'Update contact' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerContactDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('business-partner-contact:delete')
  @ApiOperation({ summary: 'Soft delete contact' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
