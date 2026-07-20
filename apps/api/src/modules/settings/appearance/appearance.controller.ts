import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AppearanceService } from './appearance.service'
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../common/guards/permissions.guard'
import { Permissions } from '../../../common/decorators/permissions.decorator'

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings/appearance')
export class AppearanceController {
  constructor(private readonly service: AppearanceService) {}

  @Get()
  @Permissions('settings.appearance.view')
  @ApiOperation({ summary: 'Get appearance settings' })
  async get() {
    return this.service.get()
  }

  @Patch()
  @Permissions('settings.appearance.manage')
  @ApiOperation({ summary: 'Update appearance settings' })
  async update(@Body() dto: Record<string, any>) {
    return this.service.update(dto)
  }
}
