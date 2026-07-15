import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessPartnerBankAccountsService } from './bank-accounts.service';
import { CreateBusinessPartnerBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBusinessPartnerBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Business Partner Bank Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'business-partner-bank-accounts', version: '1' })
export class BusinessPartnerBankAccountsController {
  constructor(private service: BusinessPartnerBankAccountsService) {}

  @Post()
  @Permissions('business-partner-bank-account:create')
  @ApiOperation({ summary: 'Create a bank account' })
  create(@Body() dto: CreateBusinessPartnerBankAccountDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('business-partner-bank-account:read')
  @ApiOperation({ summary: 'List bank accounts' })
  findAll(@Query() query: { page?: string; limit?: string; partnerId?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      partnerId: query.partnerId,
    });
  }

  @Get(':id')
  @Permissions('business-partner-bank-account:read')
  @ApiOperation({ summary: 'Get bank account by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('business-partner-bank-account:update')
  @ApiOperation({ summary: 'Update bank account' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerBankAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('business-partner-bank-account:delete')
  @ApiOperation({ summary: 'Soft delete bank account' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
