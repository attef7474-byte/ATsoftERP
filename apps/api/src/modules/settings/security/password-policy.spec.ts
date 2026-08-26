import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_PASSWORD_POLICY,
  isBcryptPasswordHash,
  passwordPolicyViolations,
  resolvePasswordPolicy,
  verifyPassword,
} from './password-policy';
import { PasswordCredentialService } from './password-credential.service';

describe('canonical password policy and credential service', () => {
  it('uses the security-settings defaults as the single policy baseline', () => {
    expect(resolvePasswordPolicy([])).toEqual(DEFAULT_PASSWORD_POLICY);
  });

  it('resolves every configured policy switch and minimum length', () => {
    expect(
      resolvePasswordPolicy([
        { key: 'security.passwordMinLength', value: '12' },
        { key: 'security.passwordRequireUppercase', value: 'false' },
        { key: 'security.passwordRequireLowercase', value: 'true' },
        { key: 'security.passwordRequireNumber', value: 'false' },
        { key: 'security.passwordRequireSymbol', value: 'true' },
      ]),
    ).toEqual({
      minLength: 12,
      requireUppercase: false,
      requireLowercase: true,
      requireNumber: false,
      requireSymbol: true,
      maxBytes: 72,
    });
  });

  it('rejects whitespace-only, weak, and bcrypt-truncated credentials', () => {
    expect(
      passwordPolicyViolations('        ', DEFAULT_PASSWORD_POLICY).map(
        (violation) => violation.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        'validation.passwordWhitespaceOnly',
        'validation.passwordUppercase',
        'validation.passwordLowercase',
        'validation.passwordNumber',
        'validation.passwordSymbol',
      ]),
    );
    expect(
      passwordPolicyViolations('A1!' + 'a'.repeat(70), DEFAULT_PASSWORD_POLICY),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'validation.passwordTooLong' }),
      ]),
    );
  });

  it('hashes and verifies only after confirmation and policy validation', async () => {
    const prisma = {
      systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PasswordCredentialService(prisma as any);

    const prepared = await service.preparePassword(
      'StrongSecret123!',
      'StrongSecret123!',
    );
    expect(isBcryptPasswordHash(prepared.passwordHash)).toBe(true);
    await expect(
      verifyPassword('StrongSecret123!', prepared.passwordHash),
    ).resolves.toBe(true);
    await expect(
      verifyPassword('WrongSecret123!', prepared.passwordHash),
    ).resolves.toBe(false);
  });

  it('rejects mismatch before reading settings or hashing', async () => {
    const prisma = {
      systemSetting: { findMany: jest.fn() },
    };
    const service = new PasswordCredentialService(prisma as any);

    await expect(
      service.preparePassword('StrongSecret123!', 'DifferentSecret123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.systemSetting.findMany).not.toHaveBeenCalled();
  });
});
