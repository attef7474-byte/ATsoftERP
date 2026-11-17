import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductionMaterialDocumentsService } from './production-material-documents.service';
import { PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS } from './production-material-documents.constants';
import {
  CancelMaterialDocumentApprovalDto,
  CancelMaterialDocumentDto,
  CreateMaterialDocumentDto,
  MaterialDocumentQueryDto,
  RejectMaterialDocumentDto,
  ReverseMaterialDocumentDto,
  UpdateMaterialDocumentDto,
  WithdrawMaterialDocumentDto,
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
  @ApiOperation({ summary: 'Post an APPROVED document and its inventory movement atomically (one ledger effect)' })
  post(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.post(id, userId, ctx);
  }

  @Patch(':id/submit')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.submit)
  @ApiOperation({ summary: 'Requester submits a DRAFT raw-material issue request to the warehouse' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.submit(id, userId, ctx);
  }

  @Patch(':id/withdraw')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.withdraw)
  @ApiOperation({ summary: 'Requester withdraws a SUBMITTED request back to DRAFT before the warehouse decides' })
  withdraw(@Param('id') id: string, @Body() dto: WithdrawMaterialDocumentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.withdraw(id, dto, userId, ctx);
  }

  @Patch(':id/approve')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.approve)
  @ApiOperation({ summary: 'Warehouse approves a SUBMITTED request (separate actor from the requester)' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approve(id, userId, ctx);
  }

  @Patch(':id/reject')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.reject)
  @ApiOperation({ summary: 'Warehouse rejects a SUBMITTED request with a mandatory reason' })
  reject(@Param('id') id: string, @Body() dto: RejectMaterialDocumentDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reject(id, dto, userId, ctx);
  }

  @Patch(':id/cancel-approval')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.cancelApproval)
  @ApiOperation({ summary: 'Warehouse cancels a prior approval before posting and returns the request to SUBMITTED' })
  cancelApproval(@Param('id') id: string, @Body() dto: CancelMaterialDocumentApprovalDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancelApproval(id, dto, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions(PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS.cancel)
  @ApiOperation({ summary: 'Cancel a DRAFT, SUBMITTED or REJECTED production material document and its DRAFT movement' })
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
