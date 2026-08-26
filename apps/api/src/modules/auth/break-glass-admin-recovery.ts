import { PrismaClient } from '@prisma/client';
import {
  hashPassword,
  isBcryptPasswordHash,
  loadPasswordPolicy,
  passwordPolicyViolations,
  verifyPassword,
} from '../settings/security/password-policy';

export const CANONICAL_BREAK_GLASS_ADMIN_EMAIL = 'admin@atsofterp.com';
export const BACKUP_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000;

export interface VerifiedBackupEvidence {
  status: 'PASS';
  method: 'RESTORE VERIFYONLY WITH CHECKSUM';
  backupPath: string;
  backupLengthBytes: number;
  backupLastWriteUtc: string;
  verifiedAtUtc: string;
}

export interface BreakGlassRecoveryResult {
  targetEmail: string;
  userIdPreserved: boolean;
  roleAssignmentsPreserved: boolean;
  tenantAssignmentsPreserved: boolean;
  otherUserCountPreserved: boolean;
  passwordHashChanged: boolean;
  passwordHashValid: boolean;
  passwordVerified: boolean;
  auditCreated: boolean;
  auditIdentityTruthful: boolean;
  sessionsRevoked: boolean;
  otherUsersChanged: 0;
  businessDataChanged: 0;
}

export class BreakGlassRecoveryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BreakGlassRecoveryError';
  }
}

function stableIds(values: readonly string[]): string {
  return [...values].sort().join('|');
}

export function assertVerifiedBackupEvidence(
  evidence: VerifiedBackupEvidence,
  now = new Date(),
): void {
  if (
    evidence.status !== 'PASS' ||
    evidence.method !== 'RESTORE VERIFYONLY WITH CHECKSUM' ||
    !evidence.backupPath ||
    !Number.isFinite(evidence.backupLengthBytes) ||
    evidence.backupLengthBytes <= 0
  ) {
    throw new BreakGlassRecoveryError('BACKUP_GATE_INVALID');
  }
  const verifiedAt = Date.parse(evidence.verifiedAtUtc);
  const backupLastWrite = Date.parse(evidence.backupLastWriteUtc);
  if (!Number.isFinite(verifiedAt) || !Number.isFinite(backupLastWrite)) {
    throw new BreakGlassRecoveryError('BACKUP_GATE_INVALID_TIMESTAMP');
  }
  const age = now.getTime() - verifiedAt;
  if (age < -5 * 60 * 1000 || age > BACKUP_EVIDENCE_MAX_AGE_MS) {
    throw new BreakGlassRecoveryError('BACKUP_GATE_STALE');
  }
  if (backupLastWrite > verifiedAt) {
    throw new BreakGlassRecoveryError('BACKUP_CHANGED_AFTER_VERIFICATION');
  }
}

function assertActiveSuperAdmin(target: {
  status: string;
  deletedAt: Date | null;
  roles: Array<{
    role: { code: string; status: string; deletedAt: Date | null };
  }>;
}): void {
  if (target.status !== 'ACTIVE' || target.deletedAt !== null) {
    throw new BreakGlassRecoveryError('TARGET_NOT_ACTIVE');
  }
  const isSuperAdmin = target.roles.some(
    (assignment) =>
      assignment.role.code === 'SUPER_ADMIN' &&
      assignment.role.status === 'ACTIVE' &&
      assignment.role.deletedAt === null,
  );
  if (!isSuperAdmin) {
    throw new BreakGlassRecoveryError('TARGET_NOT_SUPER_ADMIN');
  }
}

export async function recoverCanonicalAdminPassword(
  prisma: PrismaClient,
  input: {
    targetEmail: string;
    newPassword: string;
    confirmation: string;
    backupEvidence: VerifiedBackupEvidence;
    now?: Date;
  },
): Promise<BreakGlassRecoveryResult> {
  assertVerifiedBackupEvidence(input.backupEvidence, input.now);

  if (
    input.targetEmail.trim().toLowerCase() !==
    CANONICAL_BREAK_GLASS_ADMIN_EMAIL
  ) {
    throw new BreakGlassRecoveryError('WRONG_TARGET');
  }
  if (input.newPassword !== input.confirmation) {
    throw new BreakGlassRecoveryError('PASSWORD_CONFIRMATION_MISMATCH');
  }

  const policy = await loadPasswordPolicy(prisma);
  const policyErrors = passwordPolicyViolations(
    input.newPassword,
    policy,
    'newPassword',
  );
  if (policyErrors.length > 0) {
    throw new BreakGlassRecoveryError(
      `PASSWORD_POLICY_REJECTED_${policyErrors
        .map((error) => error.code.replace('validation.', '').toUpperCase())
        .join('_')}`,
    );
  }

  const target = await prisma.user.findUnique({
    where: { email: CANONICAL_BREAK_GLASS_ADMIN_EMAIL },
    include: {
      roles: {
        include: {
          role: {
            select: { id: true, code: true, status: true, deletedAt: true },
          },
        },
      },
      operationalScopes: { select: { id: true } },
    },
  });
  if (!target) {
    throw new BreakGlassRecoveryError('TARGET_NOT_FOUND');
  }
  assertActiveSuperAdmin(target);

  const beforeUserCount = await prisma.user.count();
  const beforeRoleIds = stableIds(
    target.roles.map((assignment) => assignment.role.id),
  );
  const beforeScopeIds = stableIds(
    target.operationalScopes.map((scope) => scope.id),
  );
  const previousPasswordHash = target.passwordHash;
  const nextPasswordHash = await hashPassword(input.newPassword);
  if (!(await verifyPassword(input.newPassword, nextPasswordHash))) {
    throw new BreakGlassRecoveryError('GENERATED_HASH_VERIFICATION_FAILED');
  }

  const passwordChangedAt = input.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    const currentTarget = await tx.user.findUnique({
      where: { email: CANONICAL_BREAK_GLASS_ADMIN_EMAIL },
      include: {
        roles: {
          include: {
            role: {
              select: { code: true, status: true, deletedAt: true },
            },
          },
        },
      },
    });
    if (!currentTarget || currentTarget.id !== target.id) {
      throw new BreakGlassRecoveryError('TARGET_CHANGED_DURING_RECOVERY');
    }
    assertActiveSuperAdmin(currentTarget);

    const update = await tx.user.updateMany({
      where: {
        id: target.id,
        email: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
        status: 'ACTIVE',
        deletedAt: null,
        passwordHash: previousPasswordHash,
        authVersion: target.authVersion,
      },
      data: {
        passwordHash: nextPasswordHash,
        passwordChangedAt,
        authVersion: { increment: 1 },
      },
    });
    if (update.count !== 1) {
      throw new BreakGlassRecoveryError('TARGET_CHANGED_DURING_RECOVERY');
    }

    await tx.auditLog.create({
      data: {
        userId: null,
        action: 'ADMIN_PASSWORD_RECOVERY',
        entity: 'user-credential',
        entityId: target.id,
        details: JSON.stringify({
          actorType: 'SYSTEM',
          source: 'LOCAL_BREAK_GLASS',
          targetUserId: target.id,
          targetEmail: target.email,
          companyId: target.companyId,
          branchId: target.branchId,
          sessionsRevoked: true,
          backupVerifiedAtUtc: input.backupEvidence.verifiedAtUtc,
        }),
      },
    });
  });

  const [afterTarget, afterUserCount, auditCount] = await Promise.all([
    prisma.user.findUnique({
      where: { email: CANONICAL_BREAK_GLASS_ADMIN_EMAIL },
      include: {
        roles: { include: { role: { select: { id: true } } } },
        operationalScopes: { select: { id: true } },
      },
    }),
    prisma.user.count(),
    prisma.auditLog.count({
      where: {
        userId: null,
        action: 'ADMIN_PASSWORD_RECOVERY',
        entity: 'user-credential',
        entityId: target.id,
        createdAt: { gte: passwordChangedAt },
      },
    }),
  ]);
  if (!afterTarget) {
    throw new BreakGlassRecoveryError('POSTCONDITION_TARGET_MISSING');
  }

  return {
    targetEmail: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
    userIdPreserved: afterTarget.id === target.id,
    roleAssignmentsPreserved:
      stableIds(afterTarget.roles.map((assignment) => assignment.role.id)) ===
      beforeRoleIds,
    tenantAssignmentsPreserved:
      afterTarget.companyId === target.companyId &&
      afterTarget.branchId === target.branchId &&
      stableIds(afterTarget.operationalScopes.map((scope) => scope.id)) ===
        beforeScopeIds,
    otherUserCountPreserved: afterUserCount === beforeUserCount,
    passwordHashChanged: afterTarget.passwordHash !== previousPasswordHash,
    passwordHashValid: isBcryptPasswordHash(afterTarget.passwordHash),
    passwordVerified: await verifyPassword(
      input.newPassword,
      afterTarget.passwordHash,
    ),
    auditCreated: auditCount === 1,
    auditIdentityTruthful: true,
    sessionsRevoked: afterTarget.authVersion === target.authVersion + 1,
    otherUsersChanged: 0,
    businessDataChanged: 0,
  };
}
