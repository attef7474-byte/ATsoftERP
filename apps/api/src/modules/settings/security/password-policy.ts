import * as bcrypt from 'bcryptjs';

export const PASSWORD_HASH_ROUNDS = 10;
export const PASSWORD_MAX_BYTES = 72;

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  maxBytes: number;
}

export interface PasswordPolicySetting {
  key: string;
  value: string;
}

export interface PasswordPolicyClient {
  systemSetting: {
    findMany(args: {
      where: { group: string; status: string };
      select: { key: true; value: true };
    }): Promise<PasswordPolicySetting[]>;
  };
}

export interface PasswordPolicyViolation {
  field: string;
  code: string;
  params?: Record<string, string>;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = Object.freeze({
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
  maxBytes: PASSWORD_MAX_BYTES,
});

function configuredBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value !== 'false';
}

function configuredMinimum(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_PASSWORD_POLICY.minLength;
  return Math.min(64, Math.max(8, parsed));
}

export function resolvePasswordPolicy(
  settings: readonly PasswordPolicySetting[],
): PasswordPolicy {
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  return {
    minLength: configuredMinimum(values.get('security.passwordMinLength')),
    requireUppercase: configuredBoolean(
      values.get('security.passwordRequireUppercase'),
      DEFAULT_PASSWORD_POLICY.requireUppercase,
    ),
    requireLowercase: configuredBoolean(
      values.get('security.passwordRequireLowercase'),
      DEFAULT_PASSWORD_POLICY.requireLowercase,
    ),
    requireNumber: configuredBoolean(
      values.get('security.passwordRequireNumber'),
      DEFAULT_PASSWORD_POLICY.requireNumber,
    ),
    requireSymbol: configuredBoolean(
      values.get('security.passwordRequireSymbol'),
      DEFAULT_PASSWORD_POLICY.requireSymbol,
    ),
    maxBytes: PASSWORD_MAX_BYTES,
  };
}

export async function loadPasswordPolicy(
  client: PasswordPolicyClient,
): Promise<PasswordPolicy> {
  const settings = await client.systemSetting.findMany({
    where: { group: 'security', status: 'ACTIVE' },
    select: { key: true, value: true },
  });
  return resolvePasswordPolicy(settings);
}

export function passwordPolicyViolations(
  password: string,
  policy: PasswordPolicy,
  field = 'newPassword',
): PasswordPolicyViolation[] {
  const violations: PasswordPolicyViolation[] = [];
  if (password.length === 0) {
    return [{ field, code: 'validation.required' }];
  }
  if (password.trim().length === 0) {
    violations.push({ field, code: 'validation.passwordWhitespaceOnly' });
  }
  if (Array.from(password).length < policy.minLength) {
    violations.push({
      field,
      code: 'validation.passwordMinLength',
      params: { min: String(policy.minLength) },
    });
  }
  if (Buffer.byteLength(password, 'utf8') > policy.maxBytes) {
    violations.push({
      field,
      code: 'validation.passwordTooLong',
      params: { maxBytes: String(policy.maxBytes) },
    });
  }
  if (policy.requireUppercase && !/\p{Lu}/u.test(password)) {
    violations.push({ field, code: 'validation.passwordUppercase' });
  }
  if (policy.requireLowercase && !/\p{Ll}/u.test(password)) {
    violations.push({ field, code: 'validation.passwordLowercase' });
  }
  if (policy.requireNumber && !/\p{N}/u.test(password)) {
    violations.push({ field, code: 'validation.passwordNumber' });
  }
  if (policy.requireSymbol && !/[\p{P}\p{S}]/u.test(password)) {
    violations.push({ field, code: 'validation.passwordSymbol' });
  }
  return violations;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function isBcryptPasswordHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}
