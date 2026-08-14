import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BusinessPartnerBankAccountsService } from './bank-accounts.service';
import { CreateBusinessPartnerBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBusinessPartnerBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Business Partner Bank Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'business-partner-bank-accounts', version: '1' })
export class BusinessPartnerBankAccountsController {
  constructor(private service: BusinessPartnerBankAccountsService) {}

  @Post()
  @Permissions('business-partner-bank-account:create')
  @ApiOperation({ summary: 'Create a bank account' })
  create(@Body() dto: CreateBusinessPartnerBankAccountDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, ctx);
  }

  @Get()
  @Permissions('business-partner-bank-account:read')
  @ApiOperation({ summary: 'List bank accounts' })
  findAll(@Query() query: { page?: string; limit?: string; partnerId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      partnerId: query.partnerId,
    }, ctx);
  }

  @Get(':id')
  @Permissions('business-partner-bank-account:read')
  @ApiOperation({ summary: 'Get bank account by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('business-partner-bank-account:update')
  @ApiOperation({ summary: 'Update bank account' })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerBankAccountDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, ctx);
  }

  @Delete(':id')
  @Permissions('business-partner-bank-account:delete')
  @ApiOperation({ summary: 'Soft delete bank account' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, ctx);
  }
}
