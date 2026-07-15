import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BarcodeLabelsService } from './barcode-labels.service';
import { CreateBarcodeLabelDto } from './dto/create-barcode-label.dto';
import { UpdateBarcodeLabelDto } from './dto/update-barcode-label.dto';
import { BarcodeLabelQueryDto } from './dto/barcode-label-query.dto';
import { GenerateBarcodeLabelDto } from './dto/generate-barcode-label.dto';
import { ResolveBarcodeDto } from './dto/resolve-barcode.dto';

@ApiTags('Barcode Labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'barcodes', version: '1' })
export class BarcodeLabelsController {
  constructor(private service: BarcodeLabelsService) {}

  @Post('labels')
  @Permissions('barcode-label:create')
  @ApiOperation({ summary: 'Create a new barcode label' })
  create(@Body() dto: CreateBarcodeLabelDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Post('labels/generate')
  @Permissions('barcode-label:create')
  @ApiOperation({ summary: 'Generate a barcode label for an entity' })
  generate(@Body() dto: GenerateBarcodeLabelDto, @Req() req: any) {
    return this.service.generate(dto, req.user?.id);
  }

  @Get('labels')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'List barcode labels' })
  findAll(@Query() query: BarcodeLabelQueryDto) {
    return this.service.findAll(query);
  }

  @Get('labels/:id')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'Get barcode label by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('labels/:id')
  @Permissions('barcode-label:update')
  @ApiOperation({ summary: 'Update a barcode label' })
  update(@Param('id') id: string, @Body() dto: UpdateBarcodeLabelDto, @Req() req: any) {
    return this.service.update(id, dto, req.user?.id);
  }

  @Patch('labels/:id/activate')
  @Permissions('barcode-label:activate')
  @ApiOperation({ summary: 'Activate a barcode label' })
  activate(@Param('id') id: string, @Req() req: any) {
    return this.service.activate(id, req.user?.id);
  }

  @Patch('labels/:id/deactivate')
  @Permissions('barcode-label:deactivate')
  @ApiOperation({ summary: 'Deactivate a barcode label' })
  deactivate(@Param('id') id: string, @Req() req: any) {
    return this.service.deactivate(id, req.user?.id);
  }

  @Patch('labels/:id/retire')
  @Permissions('barcode-label:retire')
  @ApiOperation({ summary: 'Retire a barcode label' })
  retire(@Param('id') id: string, @Req() req: any) {
    return this.service.retire(id, req.user?.id);
  }

  @Patch('labels/:id/void')
  @Permissions('barcode-label:void')
  @ApiOperation({ summary: 'Void a barcode label' })
  void(@Param('id') id: string, @Req() req: any) {
    return this.service.void(id, req.user?.id);
  }

  @Post('labels/:id/mark-printed')
  @Permissions('barcode-label:print')
  @ApiOperation({ summary: 'Mark a barcode label as printed' })
  markPrinted(@Param('id') id: string, @Req() req: any) {
    return this.service.markPrinted(id, req.user?.id);
  }

  @Get('entities/:entityType/:entityId/labels')
  @Permissions('barcode-label:read')
  @ApiOperation({ summary: 'Get labels for an entity' })
  findByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.service.findByEntity(entityType, entityId);
  }

  @Get('resolve')
  @Permissions('barcode-label:resolve')
  @ApiOperation({ summary: 'Resolve a barcode value' })
  resolveByQuery(@Query('value') value: string) {
    if (!value) throw new Error('value query parameter is required');
    return this.service.resolve(value);
  }

  @Post('resolve')
  @Permissions('barcode-label:resolve')
  @ApiOperation({ summary: 'Resolve a barcode value' })
  resolve(@Body() dto: ResolveBarcodeDto) {
    return this.service.resolve(dto.value);
  }
}
