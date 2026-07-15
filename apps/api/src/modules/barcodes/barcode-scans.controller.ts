import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BarcodeScansService } from './barcode-scans.service';
import { ScanBarcodeDto } from './dto/scan-barcode.dto';
import { BarcodeScanQueryDto } from './dto/barcode-scan-query.dto';
import { InventoryCountScanDto } from './dto/inventory-count-scan.dto';
import { MaintenanceScanDto } from './dto/maintenance-scan.dto';
import { MachineCheckScanDto } from './dto/machine-check-scan.dto';
import { PartLookupScanDto } from './dto/part-lookup-scan.dto';

@ApiTags('Barcode Scans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'barcodes', version: '1' })
export class BarcodeScansController {
  constructor(private service: BarcodeScansService) {}

  @Post('scan')
  @Permissions('barcode-scan:create')
  @ApiOperation({ summary: 'Scan a barcode value (general lookup)' })
  scan(@Body() dto: ScanBarcodeDto, @Req() req: any) {
    return this.service.scan(dto, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Get('scans')
  @Permissions('barcode-scan:read')
  @ApiOperation({ summary: 'List scan events' })
  findAllScans(@Query() query: BarcodeScanQueryDto) {
    return this.service.findAllScans(query);
  }

  @Get('scans/:id')
  @Permissions('barcode-scan:read')
  @ApiOperation({ summary: 'Get a scan event by ID' })
  findScanById(@Param('id') id: string) {
    return this.service.findScanById(id);
  }

  @Post('scan/inventory-count')
  @Permissions('barcode-scan:inventory-count')
  @ApiOperation({ summary: 'Scan for inventory counting context' })
  scanInventoryCount(@Body() dto: InventoryCountScanDto, @Req() req: any) {
    return this.service.scanInventoryCount(dto, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Post('scan/maintenance')
  @Permissions('barcode-scan:maintenance')
  @ApiOperation({ summary: 'Scan for maintenance context' })
  scanMaintenance(@Body() dto: MaintenanceScanDto, @Req() req: any) {
    return this.service.scanMaintenance(dto, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Post('scan/machine-check')
  @Permissions('barcode-scan:machine-check')
  @ApiOperation({ summary: 'Scan machine QR for quick operational status' })
  scanMachineCheck(@Body() dto: MachineCheckScanDto, @Req() req: any) {
    return this.service.scanMachineCheck(dto, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Post('scan/part-lookup')
  @Permissions('barcode-scan:part-lookup')
  @ApiOperation({ summary: 'Scan part/product label for details and balances' })
  scanPartLookup(@Body() dto: PartLookupScanDto, @Req() req: any) {
    return this.service.scanPartLookup(dto, req.user?.id, req.ip, req.headers?.['user-agent']);
  }
}
