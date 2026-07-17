import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductCategoriesService } from './product-categories.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Product Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'product-categories', version: '1' })
export class ProductCategoriesController {
  constructor(private service: ProductCategoriesService) {}

  @Post()
  @Permissions('products:create')
  @ApiOperation({ summary: 'Create product category' })
  create(@Body() dto: CreateProductCategoryDto) { return this.service.create(dto); }

  @Get()
  @Permissions('products:read')
  @ApiOperation({ summary: 'List product categories' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
    });
  }

  @Get('tree')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get category tree' })
  getTree() { return this.service.getTree(); }

  @Get(':id')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Get category by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Update category' })
  update(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @Permissions('products:delete')
  @ApiOperation({ summary: 'Soft delete category' })
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Patch(':id/activate')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Activate category' })
  activate(@Param('id') id: string) { return this.service.activate(id); }

  @Patch(':id/deactivate')
  @Permissions('products:update')
  @ApiOperation({ summary: 'Deactivate category' })
  deactivate(@Param('id') id: string) { return this.service.deactivate(id); }
}
