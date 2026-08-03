import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionProductDefinitionsService } from './production-product-definitions.service';
import { CreateProductionProductDefinitionDto } from './dto/create-production-product-definition.dto';
import { UpdateProductionProductDefinitionDto } from './dto/update-production-product-definition.dto';
import { ProductionProductDefinitionQueryDto } from './dto/production-product-definition-query.dto';
import {
  CreateSpecificationDto,
  CreateVersionDto,
  CreatePackagingDto,
  CreateEligibilityDto,
} from './dto/create-production-child.dto';

@ApiTags('production-product-definitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/product-definitions')
export class ProductionProductDefinitionsController {
  constructor(private readonly definitionsService: ProductionProductDefinitionsService) {}

  @Post()
  @Permissions('production-product:create')
  @ApiOperation({ summary: 'Create a production product definition' })
  create(@Body() dto: CreateProductionProductDefinitionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-product:read')
  @ApiOperation({ summary: 'List production product definitions (tenant scoped)' })
  findAll(@Query() query: ProductionProductDefinitionQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.findAll(query, ctx);
  }

  @Get(':id')
  @Permissions('production-product:read')
  @ApiOperation({ summary: 'Get one production product definition with children' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Update a production product definition' })
  update(@Param('id') id: string, @Body() dto: UpdateProductionProductDefinitionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-product:delete')
  @ApiOperation({ summary: 'Soft delete a production product definition' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.remove(id, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Activate a production product definition' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Deactivate a production product definition' })
  deactivate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.deactivate(id, userId, ctx);
  }

  @Post(':id/specifications')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Add a specification to a definition' })
  addSpecification(@Param('id') id: string, @Body() dto: CreateSpecificationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.addSpecification(id, dto, userId, ctx);
  }

  @Patch(':id/specifications/:childId')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Update a specification' })
  updateSpecification(@Param('id') id: string, @Param('childId') childId: string, @Body() dto: Partial<CreateSpecificationDto>, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.updateSpecification(id, childId, dto, userId, ctx);
  }

  @Delete(':id/specifications/:childId')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Remove a specification' })
  removeSpecification(@Param('id') id: string, @Param('childId') childId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.removeSpecification(id, childId, userId, ctx);
  }

  @Post(':id/versions')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Add a version to a definition' })
  addVersion(@Param('id') id: string, @Body() dto: CreateVersionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.addVersion(id, dto, userId, ctx);
  }

  @Patch(':id/versions/:childId')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Update a version' })
  updateVersion(@Param('id') id: string, @Param('childId') childId: string, @Body() dto: Partial<CreateVersionDto>, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.updateVersion(id, childId, dto, userId, ctx);
  }

  @Patch(':id/versions/:childId/set-current')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Set a version as the current version' })
  setCurrentVersion(@Param('id') id: string, @Param('childId') childId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.setCurrentVersion(id, childId, userId, ctx);
  }

  @Delete(':id/versions/:childId')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Remove a version (current version is locked)' })
  removeVersion(@Param('id') id: string, @Param('childId') childId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.removeVersion(id, childId, userId, ctx);
  }

  @Post(':id/packagings')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Add packaging to a definition' })
  addPackaging(@Param('id') id: string, @Body() dto: CreatePackagingDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.addPackaging(id, dto, userId, ctx);
  }

  @Patch(':id/packagings/:childId')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Update packaging' })
  updatePackaging(@Param('id') id: string, @Param('childId') childId: string, @Body() dto: Partial<CreatePackagingDto>, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.updatePackaging(id, childId, dto, userId, ctx);
  }

  @Patch(':id/packagings/:childId/set-default')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Set packaging as default' })
  setDefaultPackaging(@Param('id') id: string, @Param('childId') childId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.setDefaultPackaging(id, childId, userId, ctx);
  }

  @Delete(':id/packagings/:childId')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Remove packaging' })
  removePackaging(@Param('id') id: string, @Param('childId') childId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.removePackaging(id, childId, userId, ctx);
  }

  @Post(':id/eligibilities')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Add a production eligibility (MACHINE or LINE)' })
  addEligibility(@Param('id') id: string, @Body() dto: CreateEligibilityDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.addEligibility(id, dto, userId, ctx);
  }

  @Patch(':id/eligibilities/:childId')
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Update a production eligibility' })
  updateEligibility(@Param('id') id: string, @Param('childId') childId: string, @Body() dto: Partial<CreateEligibilityDto>, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.updateEligibility(id, childId, dto, userId, ctx);
  }

  @Delete(':id/eligibilities/:childId')
  @HttpCode(HttpStatus.OK)
  @Permissions('production-product:update')
  @ApiOperation({ summary: 'Remove a production eligibility' })
  removeEligibility(@Param('id') id: string, @Param('childId') childId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.definitionsService.removeEligibility(id, childId, userId, ctx);
  }
}
