import { Controller, Get, Patch, Body } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { SecurityService } from './security.service'
import { Permissions } from '../../../common/decorators/permissions.decorator'

@ApiTags('Settings')
@Controller('settings/security')
export class SecurityController {
  constructor(private readonly service: SecurityService) {}

  @Get()
  @Permissions('settings.security.view')
  @ApiOperation({ summary: 'Get security settings' })
  async get() {
    return this.service.get()
  }

  @Patch()
  @Permissions('settings.security.manage')
  @ApiOperation({ summary: 'Update security settings' })
  async update(@Body() dto: Record<string, any>) {
    return this.service.update(dto)
  }
}
