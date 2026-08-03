import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ProductionOperationalPeopleService } from './production-operational-people.service';

@ApiTags('production-operational-people')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/operational-people')
export class ProductionOperationalPeopleController {
  constructor(private readonly peopleService: ProductionOperationalPeopleService) {}

  @Get()
  @Permissions('production-shift-assignment:read')
  @ApiOperation({ summary: 'List operational people (for shift assignment pickers)' })
  findAll(@Query() query: { search?: string; page?: string; limit?: string; isActive?: string }) {
    return this.peopleService.findAll({
      search: query.search,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      isActive: query.isActive,
    });
  }

  @Get(':id')
  @Permissions('production-shift-assignment:read')
  @ApiOperation({ summary: 'Get one operational person' })
  findOne(@Param('id') id: string) {
    return this.peopleService.findOne(id);
  }
}