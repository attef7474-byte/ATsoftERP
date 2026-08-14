import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BarcodeLabelsService } from './barcode-labels.service';
import { CreateBarcodeLabelDto } from './dto/create-barcode-label.dto';
import { UpdateBarcodeLabelDto } from './dto/update-barcode-label.dto';
import { BarcodeLabelQueryDto } from './dto/barcode-label-query.dto';
import { GenerateBarcodeLabelDto } from './dto/generate-barcode-label.dto';
import { GenerateQRDto } from './dto/generate-qr.dto';
import { ResolveBarcodeDto } from './dto/resolve-barcode.dto';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@ApiTags('Barcode Labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'barcodes', version: '1' })
export class BarcodeLabelsController {
  constructor(private service: BarcodeLabelsService) {}

  @Post('labels')
  @Permissions('barcode-label:create')
  @ApiOperation({ summary: 'Create a new barcode label' })
  create(@Body() dto: CreateBarcodeLabelDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, req.user?.id, ctx);
  }

  @Post('labels/generate')
  @Permissions('barcode-label:create')
  @ApiOperation({ summary: 'Generate a barcode label for an entity' })
  generate(@Body() dto: GenerateBarcodeLabelDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.generate(dto, req.user?.id, ctx);
  }

  @Get('labels')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'List barcode labels' })
  findAll(@Query() query: BarcodeLabelQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get('labels/:id')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'Get barcode label by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch('labels/:id')
  @Permissions('barcode-label:update')
  @ApiOperation({ summary: 'Update a barcode label' })
  update(@Param('id') id: string, @Body() dto: UpdateBarcodeLabelDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, req.user?.id, ctx);
  }

  @Patch('labels/:id/activate')
  @Permissions('barcode-label:activate')
  @ApiOperation({ summary: 'Activate a barcode label' })
  activate(@Param('id') id: string, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.activate(id, req.user?.id, ctx);
  }

  @Patch('labels/:id/deactivate')
  @Permissions('barcode-label:deactivate')
  @ApiOperation({ summary: 'Deactivate a barcode label' })
  deactivate(@Param('id') id: string, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivate(id, req.user?.id, ctx);
  }

  @Patch('labels/:id/retire')
  @Permissions('barcode-label:retire')
  @ApiOperation({ summary: 'Retire a barcode label' })
  retire(@Param('id') id: string, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.retire(id, req.user?.id, ctx);
  }

  @Patch('labels/:id/void')
  @Permissions('barcode-label:void')
  @ApiOperation({ summary: 'Void a barcode label' })
  void(@Param('id') id: string, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.void(id, req.user?.id, ctx);
  }

  @Post('labels/:id/mark-printed')
  @Permissions('barcode-label:print')
  @ApiOperation({ summary: 'Mark a barcode label as printed' })
  markPrinted(@Param('id') id: string, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.markPrinted(id, req.user?.id, ctx);
  }

  @Get('entities/:entityType/:entityId/labels')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'Get labels for an entity' })
  findByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findByEntity(entityType, entityId, ctx);
  }

  @Get('resolve')
  @Permissions('barcode-label:resolve')
  @ApiOperation({ summary: 'Resolve a barcode value' })
  resolveByQuery(@Query('value') value: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    if (!value) throw new Error('value query parameter is required');
    return this.service.resolve(value, ctx);
  }

  @Post('resolve')
  @Permissions('barcode-label:resolve')
  @ApiOperation({ summary: 'Resolve a barcode value' })
  resolve(@Body() dto: ResolveBarcodeDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.resolve(dto.value, ctx);
  }

  @Delete('labels/:id')
  @Permissions('barcode-label:delete')
  @ApiOperation({ summary: 'Soft delete a barcode label' })
  softDelete(@Param('id') id: string, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.softDelete(id, req.user?.id, ctx);
  }

  @Get('labels/:id/preview')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'Preview a barcode label with entity details' })
  preview(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.preview(id, ctx);
  }

  @Get('labels/:id/download')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'Download a barcode label as JSON' })
  download(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.download(id, ctx);
  }

  @Post('qr/generate')
  @Permissions('barcode-label:create')
  @ApiOperation({ summary: 'Generate a QR code label for an entity' })
  generateQR(@Body() dto: GenerateQRDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.generateQR(dto, req.user?.id, ctx);
  }

  @Get()
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'List barcode labels (alias for /barcodes/labels)' })
  findAllAlias(@Query() query: BarcodeLabelQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }
}
