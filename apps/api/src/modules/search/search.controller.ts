import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { SearchService } from './search.service';
import {
  UnifiedSearchQueryDto,
  EntitySearchQueryDto,
  LookupRequestDto,
  EntityType,
  SearchEntityFilters,
} from './dto/search-query.dto';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Permissions('search.global:use')
  @ApiOperation({ summary: 'Unified global search across all entities' })
  async unifiedSearch(
    @Query(new ValidationPipe({ transform: true })) query: UnifiedSearchQueryDto,
    @CurrentActiveContext() context: ActiveOperationalContext,
  ) {
    const q = (query.q || '').trim();
    if (q.length < 1) {
      return { data: [], meta: { total: 0, page: query.page, limit: query.limit } };
    }
    const groups = await this.searchService.searchGlobal(
      q,
      context,
      query.types,
      query.page,
      query.limit,
      query,
    );
    return { data: groups, meta: { total: groups.reduce((s, g) => s + g.total, 0), page: query.page, limit: query.limit } };
  }

  @Post()
  @Permissions('search.global:use')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unified search via POST (allows body-based queries)' })
  async unifiedSearchPost(
    @Body(new ValidationPipe({ transform: true })) query: UnifiedSearchQueryDto,
    @CurrentActiveContext() context: ActiveOperationalContext,
  ) {
    return this.unifiedSearch(query, context);
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
    @Param('entityType', new ParseEnumPipe(EntityType)) entityType: EntityType,
    @Query(new ValidationPipe({ transform: true })) query: EntitySearchQueryDto,
    @CurrentActiveContext() context: ActiveOperationalContext,
  ) {
    const q = (query.q || '').trim();
    const result = await this.searchService.searchEntity(
      entityType,
      q,
      context,
      query.page,
      query.limit,
      query,
    );
    return { data: result.items, meta: { total: result.total, page: query.page, limit: query.limit } };
  }

  @Get(':entityType/:id')
  @Permissions('search.entities:view')
  @ApiOperation({ summary: 'Get a specific search result by entity type and ID' })
  async getEntityById(
    @Param('entityType', new ParseEnumPipe(EntityType)) entityType: EntityType,
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) filters: SearchEntityFilters,
    @CurrentActiveContext() context: ActiveOperationalContext,
  ) {
    const item = await this.searchService.lookupEntity(entityType, id, context, filters);
    if (!item) {
      throw new NotFoundException({
        messageKey: 'common.notFound',
        message: 'Search result not found',
      });
    }
    return { data: item };
  }

  @Post('lookup')
  @Permissions('search.entities:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lookup records (F9 lookup mode)' })
  async lookup(
    @Body(new ValidationPipe({ transform: true })) body: LookupRequestDto,
    @CurrentActiveContext() context: ActiveOperationalContext,
  ) {
    const q = (body.q || '').trim();
    if (body.id && body.entityType) {
      const item = await this.searchService.lookupEntity(body.entityType, body.id, context, body);
      if (!item) {
        throw new NotFoundException({
          messageKey: 'common.notFound',
          message: 'Search result not found',
        });
      }
      return { data: item ? [item] : [] };
    }
    if (body.entityType) {
      const result = await this.searchService.searchEntity(
        body.entityType,
        q,
        context,
        1,
        100,
        body,
      );
      return { data: result.items, meta: { total: result.total } };
    }
    return { data: [] };
  }
}
