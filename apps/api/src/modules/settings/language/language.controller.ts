import { Controller, Get, Patch, Body } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { LanguageService } from './language.service'
import { Permissions } from '../../../common/decorators/permissions.decorator'

@ApiTags('Settings')
@Controller('settings/language')
export class LanguageController {
  constructor(private readonly service: LanguageService) {}

  @Get()
  @Permissions('settings.language.view')
  @ApiOperation({ summary: 'Get language settings' })
  async get() {
    return this.service.get()
  }

  @Patch()
  @Permissions('settings.language.manage')
  @ApiOperation({ summary: 'Update language settings' })
  async update(@Body() dto: Record<string, any>) {
    return this.service.update(dto)
  }
}
