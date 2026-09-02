import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { CompanyProfileService } from './company-profile.service'
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../../common/guards/permissions.guard'
import { Permissions } from '../../../common/decorators/permissions.decorator'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'
import { UpdateCompanyProfileDto } from '../dto/update-company-profile.dto'

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings/company-profile')
export class CompanyProfileController {
  constructor(private readonly service: CompanyProfileService) {}

  @Get()
  @Permissions('company:read')
  @ApiOperation({ summary: 'Get company profile' })
  async getProfile(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getProfile(ctx)
  }

  @Patch()
  @Permissions('company:update')
  @ApiOperation({ summary: 'Update company profile' })
  async updateProfile(
    @Body() dto: UpdateCompanyProfileDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.updateProfile(dto, userId, ctx)
  }
}
