import { GUARDS_METADATA } from '@nestjs/common/constants';
import { validate } from 'class-validator';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UsersController } from './users.controller';

describe('Users password reset API contract', () => {
  it('requires both authentication and permission guards at the controller boundary', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, UsersController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionsGuard]));
    expect(
      Reflect.getMetadata(
        'permissions',
        UsersController.prototype.resetPassword,
      ),
    ).toEqual(['user:reset-password']);
  });

  it('rejects malformed reset payloads before service execution', async () => {
    const dto = Object.assign(new ResetUserPasswordDto(), {
      newPassword: '',
      confirmNewPassword: '',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property).sort()).toEqual([
      'confirmNewPassword',
      'newPassword',
    ]);
  });
});
