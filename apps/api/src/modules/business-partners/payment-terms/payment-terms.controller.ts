import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentTermsService } from './payment-terms.service';
import { CreatePaymentTermDto } from './dto/create-payment-term.dto';
import { UpdatePaymentTermDto } from './dto/update-payment-term.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Payment Terms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'payment-terms', version: '1' })
export class PaymentTermsController {
  constructor(private service: PaymentTermsService) {}

  @Post()
  @Permissions('payment-term:create')
  @ApiOperation({ summary: 'Create a payment term' })
  create(@Body() dto: CreatePaymentTermDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('payment-term:read')
  @ApiOperation({ summary: 'List payment terms' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('payment-term:read')
  @ApiOperation({ summary: 'Get payment term by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('payment-term:update')
  @ApiOperation({ summary: 'Update payment term' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentTermDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('payment-term:delete')
  @ApiOperation({ summary: 'Soft delete payment term' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
