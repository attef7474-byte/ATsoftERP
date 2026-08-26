import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  loadPasswordPolicy,
  passwordPolicyViolations,
  hashPassword,
  verifyPassword,
  PasswordPolicy,
  PasswordPolicyClient,
} from './password-policy';

@Injectable()
export class PasswordCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  getPolicy(client: PasswordPolicyClient = this.prisma): Promise<PasswordPolicy> {
    return loadPasswordPolicy(client);
  }

  assertConfirmation(
    password: string,
    confirmation: string,
    confirmationField = 'confirmNewPassword',
  ): void {
    if (password !== confirmation) {
      throw this.validationException([
        { field: confirmationField, code: 'validation.passwordMismatch' },
      ]);
    }
  }

  async preparePassword(
    password: string,
    confirmation: string,
    options: {
      passwordField?: string;
      confirmationField?: string;
      client?: PasswordPolicyClient;
    } = {},
  ): Promise<{ passwordHash: string; policy: PasswordPolicy }> {
    const passwordField = options.passwordField ?? 'newPassword';
    const confirmationField = options.confirmationField ?? 'confirmNewPassword';
    this.assertConfirmation(password, confirmation, confirmationField);

    const policy = await this.getPolicy(options.client);
    const violations = passwordPolicyViolations(password, policy, passwordField);
    if (violations.length > 0) {
      throw this.validationException(violations);
    }

    return { passwordHash: await hashPassword(password), policy };
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return verifyPassword(password, passwordHash);
  }

  private validationException(
    errors: Array<{
      field: string;
      code: string;
      params?: Record<string, string>;
    }>,
  ): BadRequestException {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'common.validationFailed',
      errors,
    });
  }
}
