import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AppearanceService } from './appearance.service'
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../common/guards/permissions.guard'
import { Permissions } from '../../../common/decorators/permissions.decorator'
import { OperationalContextOptional } from '../../../common/operational-context/operational-context-optional.decorator'
import { UpdateAppearanceSettingsDto } from '../dto/update-appearance-settings.dto'

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings/appearance')
export class AppearanceController {
  constructor(private readonly service: AppearanceService) {}

  @Get()
  @OperationalContextOptional()
  @Permissions('settings.appearance.view')
  @ApiOperation({ summary: 'Get appearance settings (system-wide)' })
  async get() {
    return this.service.get()
  }

  @Patch()
  @OperationalContextOptional()
  @Permissions('settings.appearance.manage')
  @ApiOperation({ summary: 'Update appearance settings (system-wide)' })
  async update(@Body() dto: UpdateAppearanceSettingsDto) {
    return this.service.update(dto as unknown as Record<string, unknown>)
  }
}
