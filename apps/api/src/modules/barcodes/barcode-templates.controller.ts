import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BarcodeTemplatesService } from './barcode-templates.service';
import { CreateBarcodeTemplateDto } from './dto/create-barcode-template.dto';
import { UpdateBarcodeTemplateDto } from './dto/update-barcode-template.dto';

@ApiTags('Barcode Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'barcodes', version: '1' })
export class BarcodeTemplatesController {
  constructor(private service: BarcodeTemplatesService) {}

  @Post('templates')
  @Permissions('barcode-template:create')
  @ApiOperation({ summary: 'Create a barcode label template' })
  create(@Body() dto: CreateBarcodeTemplateDto, @Req() req: any) {
    return this.service.create(dto, req.user?.id);
  }

  @Get('templates')
  @Permissions('barcode-template:read')
  @ApiOperation({ summary: 'List barcode templates' })
  findAll() {
    return this.service.findAll();
  }

  @Get('templates/:id')
  @Permissions('barcode-template:read')
  @ApiOperation({ summary: 'Get barcode template by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('templates/:id')
  @Permissions('barcode-template:update')
  @ApiOperation({ summary: 'Update a barcode template' })
  update(@Param('id') id: string, @Body() dto: UpdateBarcodeTemplateDto, @Req() req: any) {
    return this.service.update(id, dto, req.user?.id);
  }

  @Patch('templates/:id/activate')
  @Permissions('barcode-template:activate')
  @ApiOperation({ summary: 'Activate a barcode template' })
  activate(@Param('id') id: string, @Req() req: any) {
    return this.service.activate(id, req.user?.id);
  }

  @Patch('templates/:id/deactivate')
  @Permissions('barcode-template:deactivate')
  @ApiOperation({ summary: 'Deactivate a barcode template' })
  deactivate(@Param('id') id: string, @Req() req: any) {
    return this.service.deactivate(id, req.user?.id);
  }
}
