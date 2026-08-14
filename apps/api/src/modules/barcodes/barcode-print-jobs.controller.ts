import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BarcodePrintJobsService } from './barcode-print-jobs.service';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { UpdatePrintJobDto } from './dto/update-print-job.dto';
import { PrintJobQueryDto } from './dto/print-job-query.dto';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

@ApiTags('Barcode Print Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'barcodes', version: '1' })
export class BarcodePrintJobsController {
  constructor(private service: BarcodePrintJobsService) {}

  @Post('print-jobs')
  @Permissions('barcode-printJobs:create')
  @ApiOperation({ summary: 'Create a new barcode print job' })
  create(@Body() dto: CreatePrintJobDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, req.user?.id, ctx);
  }

  @Get('print-jobs')
  @Permissions('barcode-printJobs:read')
  @ApiOperation({ summary: 'List barcode print jobs' })
  findAll(@Query() query: PrintJobQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get('print-jobs/summary')
  @Permissions('barcode-printJobs:summary')
  @ApiOperation({ summary: 'Get print jobs summary counts' })
  getSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getSummary(ctx);
  }

  @Get('print-jobs/by-entity/:entityType/:entityId')
  @Permissions('barcode-printJobs:read')
  @ApiOperation({ summary: 'Get print jobs for an entity' })
  findByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findByEntity(entityType, entityId, ctx);
  }

  @Get('print-jobs/:id')
  @Permissions('barcode-printJobs:read')
  @ApiOperation({ summary: 'Get barcode print job by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch('print-jobs/:id/status')
  @Permissions('barcode-printJobs:update')
  @ApiOperation({ summary: 'Update barcode print job status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePrintJobDto, @Req() req: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateStatus(id, dto, req.user?.id, ctx);
  }
}
