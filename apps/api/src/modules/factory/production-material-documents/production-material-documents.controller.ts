import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductionMaterialDocumentsService } from './production-material-documents.service';
import { PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS } from './production-material-documents.constants';
import {
  CancelMaterialDocumentDto,
  CreateMaterialDocumentDto,
  MaterialDocumentQueryDto,
  ReverseMaterialDocumentDto,
  UpdateMaterialDocumentDto,
} from './dto/production-material-document.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Production Material Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production/material-documents', version: '1' })
export class ProductionMaterialDocumentsController {
  constructor(private readonly service: ProductionMaterialDocumentsService) {}

  @Post()
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.create)
  @ApiOperation({ summary: 'Create a DRAFT production material document linked to a DRAFT inventory movement' })
  create(@Body() dto: CreateMaterialDocumentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List production material documents scoped to the active context' })
  findAll(@Query() query: MaterialDocumentQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get('runs/:runId')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'List production material documents for a production run' })
  getRunDocuments(@Param('runId') runId: string, @Query() query: MaterialDocumentQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getRunDocuments(runId, query, ctx);
  }

  @Get(':id')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get production material document by ID (tenant-scoped)' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.update)
  @ApiOperation({ summary: 'Update a DRAFT production material document and its linked DRAFT movement' })
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDocumentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/post')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.post)
  @ApiOperation({ summary: 'Post the document and its inventory movement atomically (one ledger effect)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.post(id, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.cancel)
  @ApiOperation({ summary: 'Cancel a DRAFT production material document and its DRAFT movement' })
  cancel(@Param('id') id: string, @Body() dto: CancelMaterialDocumentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Post(':id/reverse')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.reverse)
  @ApiOperation({ summary: 'Create a DRAFT reversal document with the inverted ledger effect' })
  reverse(@Param('id') id: string, @Body() dto: ReverseMaterialDocumentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reverse(id, dto, userId, ctx);
  }
}
