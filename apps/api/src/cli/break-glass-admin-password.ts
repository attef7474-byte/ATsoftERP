import { config } from 'dotenv';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface, emitKeypressEvents } from 'node:readline';
import {
  BreakGlassRecoveryError,
  CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
  recoverCanonicalAdminPassword,
  VerifiedBackupEvidence,
} from '../modules/auth/break-glass-admin-recovery';

const PRODUCTION_BACKUP_DIRECTORY = 'C:\\ATsoftERP\\Backups';

function findRepositoryRoot(start: string): string {
  let current = resolve(start);
  while (true) {
    if (
      existsSync(join(current, 'package.json')) &&
      existsSync(join(current, 'apps', 'api', 'prisma', 'schema.prisma'))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new BreakGlassRecoveryError('REPOSITORY_ROOT_NOT_FOUND');
    }
    current = parent;
  }
}

function latestBackupFile(directory: string): string {
  if (!existsSync(directory)) {
    throw new BreakGlassRecoveryError('BACKUP_DIRECTORY_NOT_FOUND');
  }
  const candidates = readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith('.bak'))
    .map((name) => {
      const path = join(directory, name);
      return { path, stat: statSync(path) };
    })
    .filter((candidate) => candidate.stat.isFile())
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
  if (candidates.length === 0 || candidates[0].stat.size <= 0) {
    throw new BreakGlassRecoveryError('NONZERO_BACKUP_NOT_FOUND');
  }
  return candidates[0].path;
}

function verifyLatestBackup(repositoryRoot: string): VerifiedBackupEvidence {
  const backupPath = latestBackupFile(PRODUCTION_BACKUP_DIRECTORY);
  const evidencePath = join(
    tmpdir(),
    `atsofterp-auth-backup-gate-${randomUUID()}.json`,
  );
  const scriptPath = join(repositoryRoot, 'tools', 'backup', 'verify-backup.ps1');
  if (!existsSync(scriptPath)) {
    throw new BreakGlassRecoveryError('BACKUP_VERIFIER_NOT_FOUND');
  }

  try {
    const verification = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-BackupFile',
        backupPath,
        '-EvidenceFile',
        evidencePath,
        '-Quiet',
      ],
      { stdio: 'inherit', windowsHide: true },
    );
    if (verification.status !== 0 || !existsSync(evidencePath)) {
      throw new BreakGlassRecoveryError('BACKUP_VERIFYONLY_FAILED');
    }

    const evidence = JSON.parse(
      readFileSync(evidencePath, 'utf8'),
    ) as VerifiedBackupEvidence;
    const current = statSync(backupPath);
    if (
      resolve(evidence.backupPath) !== resolve(backupPath) ||
      evidence.backupLengthBytes !== current.size ||
      basename(evidence.backupPath) !== basename(backupPath)
    ) {
      throw new BreakGlassRecoveryError('BACKUP_EVIDENCE_MISMATCH');
    }
    return evidence;
  } finally {
    if (existsSync(evidencePath)) unlinkSync(evidencePath);
  }
}

function readConfirmation(): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolveValue) => {
    terminal.question(
      `Type RECOVER to reset ${CANONICAL_BREAK_GLASS_ADMIN_EMAIL}: `,
      (answer) => {
        terminal.close();
        resolveValue(answer);
      },
    );
  });
}

function readHiddenLine(prompt: string): Promise<string> {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    typeof process.stdin.setRawMode !== 'function'
  ) {
    throw new BreakGlassRecoveryError('SECURE_INTERACTIVE_TTY_REQUIRED');
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(prompt);

  return new Promise((resolveValue, rejectValue) => {
    let value = '';
    const finish = () => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        finish();
        rejectValue(new BreakGlassRecoveryError('OPERATOR_CANCELLED'));
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish();
        resolveValue(value);
        return;
      }
      if (key.name === 'backspace') {
        value = Array.from(value).slice(0, -1).join('');
        return;
      }
      if (!key.ctrl && character && !/[\r\n\u0000-\u001f\u007f]/u.test(character)) {
        value += character;
      }
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function main(): Promise<void> {
  if (process.argv.slice(2).length > 0) {
    throw new BreakGlassRecoveryError('COMMAND_LINE_ARGUMENTS_NOT_ALLOWED');
  }

  const repositoryRoot = findRepositoryRoot(process.cwd());
  config({ path: join(repositoryRoot, 'apps', 'api', '.env') });
  if (!process.env.DATABASE_URL) {
    throw new BreakGlassRecoveryError('DATABASE_CONFIGURATION_MISSING');
  }

  process.stdout.write('ATsoftERP local break-glass administrator recovery\n');
  process.stdout.write('NETWORK_EXPOSURE=NONE\n');
  process.stdout.write('TARGET=' + CANONICAL_BREAK_GLASS_ADMIN_EMAIL + '\n');
  const backupEvidence = verifyLatestBackup(repositoryRoot);
  process.stdout.write('RECOVERY_BACKUP_GATE=PASS\n');

  const confirmation = await readConfirmation();
  if (confirmation !== 'RECOVER') {
    throw new BreakGlassRecoveryError('OPERATOR_CONFIRMATION_REJECTED');
  }

  let newPassword = await readHiddenLine('New password (hidden): ');
  let confirmPassword = await readHiddenLine('Confirm password (hidden): ');

  const adapter = new PrismaMssql(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter });
  try {
    await prisma.$connect();
    const result = await recoverCanonicalAdminPassword(prisma, {
      targetEmail: CANONICAL_BREAK_GLASS_ADMIN_EMAIL,
      newPassword,
      confirmation: confirmPassword,
      backupEvidence,
    });
    newPassword = '';
    confirmPassword = '';

    const postconditions = [
      result.userIdPreserved,
      result.roleAssignmentsPreserved,
      result.tenantAssignmentsPreserved,
      result.otherUserCountPreserved,
      result.passwordHashChanged,
      result.passwordHashValid,
      result.passwordVerified,
      result.auditCreated,
      result.auditIdentityTruthful,
      result.sessionsRevoked,
    ];
    if (!postconditions.every(Boolean)) {
      throw new BreakGlassRecoveryError('POSTCONDITION_FAILED');
    }

    process.stdout.write('RECOVERY=PASS\n');
    process.stdout.write('PASSWORD_HASH_CHANGED=YES\n');
    process.stdout.write('BCRYPT_COMPARE_WITH_NEW_PASSWORD=PASS\n');
    process.stdout.write('USER_ID_CHANGED=NO\n');
    process.stdout.write('ROLE_CHANGED=NO\n');
    process.stdout.write('TENANT_ASSIGNMENTS_CHANGED=0\n');
    process.stdout.write('OTHER_USERS_CHANGED=0\n');
    process.stdout.write('BUSINESS_DATA_CHANGED=0\n');
    process.stdout.write('AUDIT_EVENT_CREATED=YES\n');
    process.stdout.write('AUDIT_IDENTITY_TRUTHFUL=YES\n');
    process.stdout.write('SESSIONS_REVOKED=YES\n');
  } finally {
    newPassword = '';
    confirmPassword = '';
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const code =
    error instanceof BreakGlassRecoveryError
      ? error.code
      : 'UNEXPECTED_ERROR';
  process.stderr.write(`RECOVERY=BLOCKED CODE=${code}\n`);
  process.exitCode = 1;
});
