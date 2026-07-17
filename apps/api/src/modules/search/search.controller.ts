import { Controller, Get, Post, Delete, Query, Body, Param, UseGuards, HttpCode, HttpStatus, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { SearchService, SearchGroup, SearchResult } from './search.service';
import { UnifiedSearchQueryDto, EntitySearchQueryDto, LookupRequestDto, EntityType } from './dto/search-query.dto';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Permissions('search.global:use')
  @ApiOperation({ summary: 'Unified global search across all entities' })
  async unifiedSearch(@Query(new ValidationPipe({ transform: true })) query: UnifiedSearchQueryDto) {
    const q = (query.q || '').trim();
    if (q.length < 1) {
      return { data: [], meta: { total: 0, page: query.page, limit: query.limit } };
    }
    const groups = await this.searchService.searchGlobal(q, query.types, query.page, query.limit);
    return { data: groups, meta: { total: groups.reduce((s, g) => s + g.total, 0), page: query.page, limit: query.limit } };
  }

  @Post()
  @Permissions('search.global:use')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unified search via POST (allows body-based queries)' })
  async unifiedSearchPost(@Body(new ValidationPipe({ transform: true })) query: UnifiedSearchQueryDto) {
    return this.unifiedSearch(query);
  }

  @Get('entities')
  @Permissions('search.entities:view')
  @ApiOperation({ summary: 'List all searchable entity types' })
  async getSearchableEntities() {
    const entities = this.searchService.getSearchableEntities();
    return { data: entities, meta: { total: entities.length } };
  }

  @Get(':entityType')
  @Permissions('search.entities:view')
  @ApiOperation({ summary: 'Search records of a specific entity type' })
  async searchEntityType(
    @Param('entityType') entityType: EntityType,
    @Query(new ValidationPipe({ transform: true })) query: EntitySearchQueryDto,
  ) {
    const q = (query.q || '').trim();
    const result = await this.searchService.searchEntity(entityType, q, query.page, query.limit);
    return { data: result.items, meta: { total: result.total, page: query.page, limit: query.limit } };
  }

  @Get(':entityType/:id')
  @Permissions('search.entities:view')
  @ApiOperation({ summary: 'Get a specific search result by entity type and ID' })
  async getEntityById(@Param('entityType') entityType: EntityType, @Param('id') id: string) {
    const item = await this.searchService.lookupEntity(entityType, id);
    if (!item) return { data: null };
    return { data: item };
  }

  @Post('lookup')
  @Permissions('search.entities:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lookup records (F9 lookup mode)' })
  async lookup(@Body(new ValidationPipe({ transform: true })) body: LookupRequestDto) {
    const q = (body.q || '').trim();
    if (body.id && body.entityType) {
      const item = await this.searchService.lookupEntity(body.entityType, body.id);
      return { data: item ? [item] : [] };
    }
    if (body.entityType) {
      const result = await this.searchService.searchEntity(body.entityType, q, 1, 100);
      return { data: result.items, meta: { total: result.total } };
    }
    return { data: [] };
  }
}
