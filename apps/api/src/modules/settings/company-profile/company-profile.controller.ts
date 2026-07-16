import { Controller, Get, Patch, Body } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { CompanyProfileService } from './company-profile.service'
import { Permissions } from '../../../common/decorators/permissions.decorator'

@ApiTags('Settings')
@Controller('settings/company-profile')
export class CompanyProfileController {
  constructor(private readonly service: CompanyProfileService) {}

  @Get()
  @Permissions('settings.company.view')
  @ApiOperation({ summary: 'Get company profile' })
  async getProfile() {
    return this.service.getProfile()
  }

  @Patch()
  @Permissions('settings.company.manage')
  @ApiOperation({ summary: 'Update company profile' })
  async updateProfile(@Body() dto: Record<string, any>) {
    return this.service.updateProfile(dto)
  }
}
