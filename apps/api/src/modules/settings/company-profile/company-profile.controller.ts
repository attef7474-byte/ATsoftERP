import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { CompanyProfileService } from './company-profile.service'
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../common/guards/permissions.guard'
import { Permissions } from '../../../common/decorators/permissions.decorator'
import { UpdateCompanyProfileDto } from '../dto/update-company-profile.dto'

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  async updateProfile(@Body() dto: UpdateCompanyProfileDto) {
    return this.service.updateProfile(dto)
  }
}
