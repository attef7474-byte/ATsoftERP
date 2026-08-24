import { Controller, Post, Get, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUserType } from './types/current-user.type';
import { ValidateOperationalContextDto } from './dto/validate-operational-context.dto';
import { OperationalContextOptional } from '../../common/operational-context/operational-context-optional.decorator';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @OperationalContextOptional()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: CurrentUserType) {
    return this.authService.getProfile(user.id);
  }

  @Get('contexts')
  @UseGuards(JwtAuthGuard)
  @OperationalContextOptional()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get allowed operational contexts' })
  async getContexts(@CurrentUser() user: CurrentUserType) {
    return this.authService.getAllowedContexts(user.id);
  }

  @Post('context/validate')
  @UseGuards(JwtAuthGuard)
  @OperationalContextOptional()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate and normalize an operational context' })
  async validateContext(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: ValidateOperationalContextDto,
  ) {
    return this.authService.validateOperationalContext(user.id, dto);
  }

  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  @OperationalContextOptional()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user permissions' })
  async getPermissions(@CurrentUser() user: CurrentUserType) {
    return this.authService.getUserPermissions(user.id);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout (no-op for stateless JWT auth)' })
  async logout() {
    return { message: 'Logged out successfully' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(@CurrentUser() user: CurrentUserType, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
