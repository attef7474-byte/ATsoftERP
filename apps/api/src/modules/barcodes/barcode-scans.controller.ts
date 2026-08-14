import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BarcodeScansService } from './barcode-scans.service';
import { ScanBarcodeDto } from './dto/scan-barcode.dto';
import { BarcodeScanQueryDto } from './dto/barcode-scan-query.dto';
import { ResolveScanDto } from './dto/resolve-scan.dto';
import { InventoryCountScanDto } from './dto/inventory-count-scan.dto';
import { MaintenanceScanDto } from './dto/maintenance-scan.dto';
import { MachineCheckScanDto } from './dto/machine-check-scan.dto';
import { PartLookupScanDto } from './dto/part-lookup-scan.dto';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@ApiTags('Barcode Scans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'barcodes', version: '1' })
export class BarcodeScansController {
  constructor(private service: BarcodeScansService) {}

  @Post('scan')
  @Permissions('barcode-scan:create')
  @ApiOperation({ summary: 'Scan a barcode value (general lookup)' })
  scan(@Body() dto: ScanBarcodeDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.scan(dto, ctx, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Get('scans')
  @Permissions('barcode-scan:read')
  @ApiOperation({ summary: 'List scan events' })
  findAllScans(@Query() query: BarcodeScanQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAllScans(query, ctx);
  }

  @Get('scans/summary')
  @Permissions('barcode-scan:read')
  @ApiOperation({ summary: 'Get barcode scan summary statistics' })
  getScanSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getScanSummary(ctx);
  }

  @Get('scans/:id')
  @Permissions('barcode-scan:read')
  @ApiOperation({ summary: 'Get a scan event by ID' })
  findScanById(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findScanById(id, ctx);
  }

  @Post('scan/inventory-count')
  @Permissions('barcode-scan:inventory-count')
  @ApiOperation({ summary: 'Scan for inventory counting context' })
  scanInventoryCount(@Body() dto: InventoryCountScanDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.scanInventoryCount(dto, ctx, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Post('scan/maintenance')
  @Permissions('barcode-scan:maintenance')
  @ApiOperation({ summary: 'Scan for maintenance context' })
  scanMaintenance(@Body() dto: MaintenanceScanDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.scanMaintenance(dto, ctx, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Post('scan/machine-check')
  @Permissions('barcode-scan:machine-check')
  @ApiOperation({ summary: 'Scan machine QR for quick operational status' })
  scanMachineCheck(@Body() dto: MachineCheckScanDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.scanMachineCheck(dto, ctx, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Post('scan/part-lookup')
  @Permissions('barcode-scan:part-lookup')
  @ApiOperation({ summary: 'Scan part/product label for details and balances' })
  scanPartLookup(@Body() dto: PartLookupScanDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.scanPartLookup(dto, ctx, req.user?.id, req.ip, req.headers?.['user-agent']);
  }

  @Get('scans/by-entity/:entityType/:entityId')
  @Permissions('barcode-scan:read')
  @ApiOperation({ summary: 'Get scans for a specific entity' })
  findScansByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string, @Query() query: BarcodeScanQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findScansByEntity(entityType, entityId, query, ctx);
  }

  @Post('scans/resolve')
  @Permissions('barcode-scan:resolve')
  @ApiOperation({ summary: 'Resolve and scan a barcode value in one call' })
  resolveAndScan(@Body() dto: ResolveScanDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.resolveAndScan(dto, ctx, req.user?.id, req.ip, req.headers?.['user-agent']);
  }
}
