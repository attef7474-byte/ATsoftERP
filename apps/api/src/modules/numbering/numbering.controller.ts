import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NumberingService } from './numbering.service';
import { CreateNumberSequenceDto } from './dto/create-number-sequence.dto';
import { UpdateNumberSequenceDto } from './dto/update-number-sequence.dto';
import { GenerateNumberDto } from './dto/generate-number.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Number Sequences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'numbering', version: '1' })
export class NumberingController {
  constructor(private service: NumberingService) {}

  @Post()
  @Permissions('numbering:create')
  @ApiOperation({ summary: 'Create number sequence' })
  create(@Body() dto: CreateNumberSequenceDto) { return this.service.create(dto); }

  @Get()
  @Permissions('numbering:read')
  @ApiOperation({ summary: 'List number sequences' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
    });
  }

  @Get(':id')
  @Permissions('numbering:read')
  @ApiOperation({ summary: 'Get number sequence by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/preview')
  @Permissions('numbering:read')
  @ApiOperation({ summary: 'Preview next number without mutating' })
  preview(@Param('id') id: string) { return this.service.preview(id); }

  @Get('code/:code')
  @Permissions('numbering:read')
  @ApiOperation({ summary: 'Get number sequence by code' })
  findByCode(@Param('code') code: string) { return this.service.findByCode(code); }

  @Patch(':id')
  @Permissions('numbering:update')
  @ApiOperation({ summary: 'Update number sequence' })
  update(@Param('id') id: string, @Body() dto: UpdateNumberSequenceDto) { return this.service.update(id, dto); }

  @Post('generate')
  @Permissions('numbering:generate')
  @ApiOperation({ summary: 'Generate next number in sequence' })
  generate(@Body() dto: GenerateNumberDto) { return this.service.generateNumber(dto.code); }
}
