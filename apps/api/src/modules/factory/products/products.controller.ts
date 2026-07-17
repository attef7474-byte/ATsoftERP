import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Post()
  @Permissions('products:create')
  @ApiOperation({ summary: 'Create a product' })
  create(@Body() dto: CreateProductDto) { return this.service.create(dto); }

  @Get()
  @Permissions('products:read')
  @ApiOperation({ summary: 'List products' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; categoryId?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      categoryId: query.categoryId,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Update product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @Permissions('products:delete')
  @ApiOperation({ summary: 'Soft delete product' })
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Patch(':id/activate')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Activate product' })
  activate(@Param('id') id: string) { return this.service.activate(id); }

  @Patch(':id/deactivate')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Deactivate product' })
  deactivate(@Param('id') id: string) { return this.service.deactivate(id); }

  @Get(':id/balances')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get product balances' })
  balances(@Param('id') id: string) { return this.service.balances(id); }

  @Get(':id/movements')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get product movements' })
  movements(@Param('id') id: string) { return this.service.movements(id); }

  @Get(':id/count-history')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get product count history' })
  countHistory(@Param('id') id: string) { return this.service.countHistory(id); }
}
