import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../settings/security/password-policy';
import {
  BreakGlassRecoveryError,
  CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
  recoverCanonicalAdminPassword,
  VerifiedBackupEvidence,
} from './break-glass-admin-recovery';

describe('local break-glass administrator recovery', () => {
  const now = new Date('2026-08-26T12:00:00.000Z');
  const evidence: VerifiedBackupEvidence = {
    status: 'PASS',
    method: 'RESTORE VERIFYONLY WITH CHECKSUM',
    backupPath: 'C:\\ATsoftERP\\Backups\\ATsoftERP_DB_test.bak',
    backupLengthBytes: 1024,
    backupLastWriteUtc: '2026-08-26T11:50:00.000Z',
    verifiedAtUtc: '2026-08-26T11:59:00.000Z',
  };

  async function fixture(options: { status?: string; roleCode?: string } = {}) {
    const previousHash = await hashPassword('PreviousSecret123!');
    let nextHash = previousHash;
    const target = {
      id: 'admin-id',
      email: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
      passwordHash: previousHash,
      authVersion: 5,
      status: options.status ?? 'ACTIVE',
      deletedAt: null,
      companyId: 'company-a',
      branchId: 'branch-a',
      roles: [
        {
          role: {
            id: 'role-super',
            code: options.roleCode ?? 'SUPER_ADMIN',
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
      ],
      operationalScopes: [{ id: 'scope-a' }],
    };
    let findCall = 0;
    const prisma: any = {
      systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn().mockImplementation(async () => {
          findCall += 1;
          if (findCall < 3) return target;
          return { ...target, passwordHash: nextHash, authVersion: 6 };
        }),
        updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
          nextHash = data.passwordHash;
          return { count: 1 };
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn().mockImplementation(
        async (callback: (tx: any) => Promise<any>) => callback(prisma),
      ),
    };
    return { prisma, target };
  }

  it('rejects stale backup evidence before any database read', async () => {
    const { prisma } = await fixture();
    await expect(
      recoverCanonicalAdminPassword(prisma as PrismaClient, {
        targetEmail: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
        newPassword: 'NextSecret123!',
        confirmation: 'NextSecret123!',
        backupEvidence: {
          ...evidence,
          verifiedAtUtc: '2026-08-26T10:00:00.000Z',
        },
        now,
      }),
    ).rejects.toMatchObject({ code: 'BACKUP_GATE_STALE' });
    expect(prisma.systemSetting.findMany).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects every target except the canonical administrator', async () => {
    const { prisma } = await fixture();
    await expect(
      recoverCanonicalAdminPassword(prisma as PrismaClient, {
        targetEmail: 'other-admin@example.test',
        newPassword: 'NextSecret123!',
        confirmation: 'NextSecret123!',
        backupEvidence: evidence,
        now,
      }),
    ).rejects.toMatchObject({ code: 'WRONG_TARGET' });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 'INACTIVE' }, 'TARGET_NOT_ACTIVE'],
    [{ roleCode: 'MANAGER' }, 'TARGET_NOT_SUPER_ADMIN'],
  ])('rejects unsafe target state %j', async (options, code) => {
    const { prisma } = await fixture(options);
    await expect(
      recoverCanonicalAdminPassword(prisma as PrismaClient, {
        targetEmail: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
        newPassword: 'NextSecret123!',
        confirmation: 'NextSecret123!',
        backupEvidence: evidence,
        now,
      }),
    ).rejects.toMatchObject({ code });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('mutates exactly one credential and writes a null-actor audit in the same transaction', async () => {
    const { prisma, target } = await fixture();
    const result = await recoverCanonicalAdminPassword(prisma as PrismaClient, {
      targetEmail: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
      newPassword: 'NextSecret123!',
      confirmation: 'NextSecret123!',
      backupEvidence: evidence,
      now,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: target.id,
        email: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
        passwordHash: target.passwordHash,
        authVersion: 5,
      }),
      data: expect.objectContaining({
        authVersion: { increment: 1 },
        passwordChangedAt: now,
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: 'ADMIN_PASSWORD_RECOVERY',
        entityId: target.id,
      }),
    });
    const auditDetails = JSON.parse(
      prisma.auditLog.create.mock.calls[0][0].data.details,
    );
    expect(auditDetails).toMatchObject({
      actorType: 'SYSTEM',
      source: 'LOCAL_BREAK_GLASS',
      targetUserId: target.id,
      sessionsRevoked: true,
    });
    expect(auditDetails).not.toHaveProperty('password');
    expect(auditDetails).not.toHaveProperty('passwordHash');
    expect(result).toMatchObject({
      passwordHashChanged: true,
      passwordHashValid: true,
      passwordVerified: true,
      roleAssignmentsPreserved: true,
      tenantAssignmentsPreserved: true,
      otherUsersChanged: 0,
      businessDataChanged: 0,
      auditIdentityTruthful: true,
      sessionsRevoked: true,
    });
  });

  it('does not claim recovery success when audit persistence fails', async () => {
    const { prisma } = await fixture();
    prisma.auditLog.create.mockRejectedValue(new Error('audit unavailable'));
    await expect(
      recoverCanonicalAdminPassword(prisma as PrismaClient, {
        targetEmail: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
        newPassword: 'NextSecret123!',
        confirmation: 'NextSecret123!',
        backupEvidence: evidence,
        now,
      }),
    ).rejects.toThrow('audit unavailable');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('keeps the CLI local-only and refuses password arguments or environment input', () => {
    const cliSource = readFileSync(
      resolve(__dirname, '../../cli/break-glass-admin-password.ts'),
      'utf8',
    );
    expect(cliSource).not.toMatch(/createServer|\.listen\s*\(/);
    expect(cliSource).toContain('COMMAND_LINE_ARGUMENTS_NOT_ALLOWED');
    expect(cliSource).not.toMatch(/process\.env\.[A-Z_]*PASSWORD/);
    expect(cliSource).toContain('process.stdin.setRawMode(true)');
    expect(cliSource.indexOf('verifyLatestBackup(repositoryRoot)')).toBeLessThan(
      cliSource.indexOf("readHiddenLine('New password"),
    );
  });
});
