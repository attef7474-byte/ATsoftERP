import { BadRequestException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { AuditService } from '../../audit/audit.service';
import { AllowedContextResolver } from '../../../common/operational-context/allowed-context.resolver';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

/**
 * BRANCH-NAME-REPAIR-R3B — Unicode contract + Branch UPDATE audit coverage.
 *
 * Two independent things are proven here:
 *
 * 1. The CURRENT branch bootstrap and update paths transport arbitrary valid
 *    Unicode byte-for-byte. The persisted Joubah corruption was proven to come
 *    from a historical client script, not from this server code, so there is
 *    deliberately no Arabic-specific handling here: the service must stay
 *    encoding-agnostic and must not be "fixed" with a hard-coded replacement.
 *
 * 2. `BranchesService.update()` used to persist changes without writing any
 *    audit row, which is exactly why the historical corrupting PATCH left no
 *    trace. A successful supported Branch update must now emit one
 *    `UPDATE`/`Branch` audit event naming the same record, and a rejected
 *    update must emit none.
 */
describe('BranchesService Unicode contract (BRANCH-NAME-REPAIR-R3B)', () => {
  // Built from explicit code points so no source-file encoding can influence
  // the value under test.
  const CANONICAL = String.fromCodePoint(
    0x0627, 0x0644, 0x0645, 0x0631, 0x0643, 0x0632, 0x0020, // المركز
    0x0627, 0x0644, 0x0631, 0x0626, 0x064a, 0x0633, 0x064a, // الرئيسي
  );
  const CANONICAL_HEX = 'd8a7d984d985d8b1d983d8b220d8a7d984d8b1d8a6d98ad8b3d98a';

  // The exact required literal, written literally in source, so the test proves
  // the literal itself and not only a code-point reconstruction of it.
  const CANONICAL_LITERAL = 'المركز الرئيسي';

  // A non-Latin, non-Arabic sample so the guarantee is proven to be general
  // Unicode preservation rather than an Arabic-shaped special case.
  const CJK = String.fromCodePoint(0x4e2d, 0x6587, 0x6d4b, 0x9a8c); // 中文检验
  const CJK_HEX = 'e4b8ade69687e6b58be9aa8c';
  // Cyrillic + combining mark, to catch normalization-style damage.
  const CYRILLIC = String.fromCodePoint(0x0416, 0x0438, 0x0432, 0x0430, 0x0301);
  const RTL_EMBEDDING = '\u202b\u0627\u0644\u0639\u0631\u0628\u064a\u0629\u202c';

  const TARGET_COMPANY = 'cm-target-company';
  const BRANCH_ID = 'cmum5dwmo0000ro95qq4day18';
  const CALLER = 'r3b-actor';
  const CTX: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const SUPER_ADMIN = { isSuperAdmin: true, roles: [{ code: 'SUPER_ADMIN' }], permissions: [] };

  let prisma: any;
  let tx: any;
  let numbering: any;
  let audit: any;
  let resolver: any;
  let service: BranchesService;

  beforeEach(() => {
    // The supported update path performs the row write and the audit write on
    // the same transactional client, so both are represented by one writer mock
    // exposed on both the root client and the transaction client.
    const writer = {
      branchUpdate: jest.fn().mockImplementation(({ where, data }: any) => ({ id: where.id, code: 'BRN-000002', ...data })),
    };
    tx = {
      branch: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: writer.branchUpdate,
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    prisma = {
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: TARGET_COMPANY, code: 'COM-000042', name: 'X', status: 'ACTIVE' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'company-a' }),
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: BRANCH_ID, companyId: 'company-a', code: 'BRN-000002', name: 'old' }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: writer.branchUpdate,
        findMany: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-root' }) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('BRN-000003'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('BRN-000003'),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue({ id: 'audit-1' }), log: jest.fn() };
    resolver = { getAuthorization: jest.fn().mockResolvedValue(SUPER_ADMIN) };
    service = new BranchesService(
      prisma as PrismaService,
      numbering as NumberingService,
      audit as AuditService,
      resolver as AllowedContextResolver,
    );
  });

  function auditCalls(): any[] {
    return audit.logWithClient.mock.calls.map((c: any[]) => c[1]);
  }

  describe('BOOTSTRAP_UNICODE_TEST — bootstrap preserves the canonical literal exactly', () => {
    it('builds the canonical fixture itself without encoding damage', () => {
      expect(Buffer.from(CANONICAL, 'utf8').toString('hex')).toBe(CANONICAL_HEX);
      expect([...CANONICAL]).toHaveLength(14);
    });

    it('the canonical literal written in this source file is itself exact', () => {
      // Guards the checked-in literal itself, so a future editor or a
      // re-save with the wrong code page cannot silently rewrite the fixture
      // while the fromCodePoint reference above keeps passing.
      expect(CANONICAL_LITERAL).toBe(CANONICAL);
      expect(Buffer.from(CANONICAL_LITERAL, 'utf8').toString('hex')).toBe(CANONICAL_HEX);
    });

    it('persists the literal as written in source, byte-exact', async () => {
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: CANONICAL_LITERAL }, CALLER);

      const persistedName = tx.branch.create.mock.calls[0][0].data.name;
      expect(persistedName).toBe(CANONICAL_LITERAL);
      expect(Buffer.from(persistedName, 'utf8').toString('hex')).toBe(CANONICAL_HEX);
      expect(auditCalls()[0].details.branchName).toBe(CANONICAL_LITERAL);
    });

    it('BOOTSTRAP_PERSISTENCE_ARGUMENT_EXACT — the value handed to branch persistence is byte-exact', async () => {
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: CANONICAL }, CALLER);

      const persistedName = tx.branch.create.mock.calls[0][0].data.name;
      expect(persistedName).toBe(CANONICAL);
      expect(Buffer.from(persistedName, 'utf8').toString('hex')).toBe(CANONICAL_HEX);
      expect([...persistedName]).toEqual([...CANONICAL]);
    });

    it('BOOTSTRAP_AUDIT_ARGUMENT_EXACT — the value written to audit details is byte-exact', async () => {
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: CANONICAL }, CALLER);

      const details = auditCalls()[0].details;
      expect(details.branchName).toBe(CANONICAL);
      expect(Buffer.from(details.branchName, 'utf8').toString('hex')).toBe(CANONICAL_HEX);
    });

    it('BOOTSTRAP_INPUT_EXACT = PERSISTENCE_NAME_EXACT = AUDIT_NAME_EXACT', async () => {
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: CANONICAL }, CALLER);

      const persisted = tx.branch.create.mock.calls[0][0].data.name;
      const audited = auditCalls()[0].details.branchName;
      expect(CANONICAL).toBe(persisted);
      expect(persisted).toBe(audited);
    });

    it('never introduces U+FFFD into the canonical literal', async () => {
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: CANONICAL }, CALLER);

      const persisted = tx.branch.create.mock.calls[0][0].data.name;
      expect(persisted).not.toContain('\uFFFD');
      expect(auditCalls()[0].details.branchName).not.toContain('\uFFFD');
    });

    it('preserves a non-Latin CJK sample exactly, proving general Unicode safety', async () => {
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: CJK }, CALLER);

      const persisted = tx.branch.create.mock.calls[0][0].data.name;
      expect(persisted).toBe(CJK);
      expect(Buffer.from(persisted, 'utf8').toString('hex')).toBe(CJK_HEX);
      expect(auditCalls()[0].details.branchName).toBe(CJK);
    });

    it('preserves combining marks and bidi control characters verbatim', async () => {
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: CYRILLIC }, CALLER);
      expect(tx.branch.create.mock.calls[0][0].data.name).toBe(CYRILLIC);

      tx.branch.create.mockClear();
      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: RTL_EMBEDDING }, CALLER);
      expect(tx.branch.create.mock.calls[0][0].data.name).toBe(RTL_EMBEDDING);
    });

    it('does not normalize or transliterate a name that a client sent verbatim', async () => {
      const alreadyCorrupt = 'المركز الرئي ىي';
      tx.branch.create.mockImplementation(({ data }: any) => ({ id: BRANCH_ID, ...data }));

      await service.bootstrapFirstBranch({ companyId: TARGET_COMPANY, name: alreadyCorrupt }, CALLER);

      // The server must not attempt to "guess" or repair a caller's string.
      expect(tx.branch.create.mock.calls[0][0].data.name).toBe(alreadyCorrupt);
    });
  });

  describe('BRANCH_UPDATE_AUDIT — supported update now emits one audit event', () => {
    it('persists a canonical name update and records exactly one UPDATE/Branch audit row', async () => {
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, code: 'BRN-000002', name: CANONICAL });

      await service.update(BRANCH_ID, { name: CANONICAL }, CTX, CALLER);

      expect(auditCalls()).toHaveLength(1);
      const entry = auditCalls()[0];
      expect(entry.action).toBe('UPDATE');
      expect(entry.entity).toBe('Branch');
      expect(entry.entityId).toBe(BRANCH_ID);
      expect(entry.userId).toBe(CALLER);
    });

    it('records the branch code, the changed fields and the previous/new name', async () => {
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, code: 'BRN-000002', name: CANONICAL });

      await service.update(BRANCH_ID, { name: CANONICAL }, CTX, CALLER);

      const details = auditCalls()[0].details;
      expect(details.branchCode).toBe('BRN-000002');
      expect(details.changedFields).toEqual(['name']);
      expect(details.previousName).toBe('old');
      expect(details.newName).toBe(CANONICAL);
    });

    it('keeps the new name byte-exact in both the row and the audit details', async () => {
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, code: 'BRN-000002', name: CANONICAL });

      await service.update(BRANCH_ID, { name: CANONICAL }, CTX, CALLER);

      expect(prisma.branch.update.mock.calls[0][0].data.name).toBe(CANONICAL);
      expect(Buffer.from(prisma.branch.update.mock.calls[0][0].data.name, 'utf8').toString('hex')).toBe(CANONICAL_HEX);
      expect(auditCalls()[0].details.newName).toBe(CANONICAL);
    });

    it('lists code alongside name when both fields are updated', async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ id: BRANCH_ID, companyId: 'company-a', code: 'BRN-000002', name: 'old' })
        .mockResolvedValueOnce(null);
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, name: CANONICAL });

      await service.update(BRANCH_ID, { code: 'BRN-000099', name: CANONICAL }, CTX, CALLER);

      expect(auditCalls()[0].details.changedFields.sort()).toEqual(['code', 'name']);
    });

    it('never puts credential material into audit details', async () => {
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, name: CANONICAL });

      await service.update(BRANCH_ID, { name: CANONICAL } as any, CTX, CALLER);

      const serialized = JSON.stringify(auditCalls()[0].details).toLowerCase();
      for (const forbidden of ['password', 'token', 'jwt', 'authorization', 'secret', 'credential', 'database_url']) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('records an update on the same record it mutated, never a different id', async () => {
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, name: CANONICAL });

      await service.update(BRANCH_ID, { name: CANONICAL }, CTX, CALLER);

      expect(prisma.branch.update.mock.calls[0][0].where).toEqual({ id: BRANCH_ID });
      expect(auditCalls()[0].entityId).toBe(prisma.branch.update.mock.calls[0][0].where.id);
    });
  });

  describe('BRANCH_UPDATE_AUDIT — rejected updates must not emit a success event', () => {
    it('emits no audit event when the target branch is outside the active tenant', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.update('foreign-branch', { name: CANONICAL }, CTX)).rejects.toThrow();
      expect(auditCalls()).toHaveLength(0);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });

    it('emits no audit event when a duplicate branch code is rejected', async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ id: BRANCH_ID, companyId: 'company-a', code: 'BRN-000002', name: 'old' })
        .mockResolvedValueOnce({ id: 'other-branch' });

      await expect(service.update(BRANCH_ID, { code: 'BRN-000099' }, CTX, CALLER)).rejects.toThrow(BadRequestException);
      expect(auditCalls()).toHaveLength(0);
      expect(prisma.branch.update).not.toHaveBeenCalled();
    });

    it('emits no audit event when persistence itself fails', async () => {
      prisma.branch.update.mockRejectedValue(new Error('db unavailable'));

      await expect(service.update(BRANCH_ID, { name: CANONICAL }, CTX, CALLER)).rejects.toThrow('db unavailable');
      expect(auditCalls()).toHaveLength(0);
    });
  });

  describe('BRANCH_UPDATE_AUDIT — tenant isolation and ownership are preserved', () => {
    it('cannot update a branch of another company through the active context', async () => {
      prisma.branch.findFirst.mockResolvedValue(null); // scoped lookup finds nothing

      await expect(service.update(BRANCH_ID, { name: CANONICAL }, CTX, CALLER)).rejects.toThrow();
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a', deletedAt: null }) }),
      );
      expect(auditCalls()).toHaveLength(0);
    });

    it('never lets a client-supplied companyId re-point branch ownership', async () => {
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, name: CANONICAL });

      await service.update(BRANCH_ID, { companyId: 'attacker-company', name: CANONICAL } as any, CTX, CALLER);

      const data = prisma.branch.update.mock.calls[0][0].data;
      expect(data.companyId).toBeUndefined();
      expect(JSON.stringify(data)).not.toContain('attacker-company');
      expect(auditCalls()[0].details.companyId).toBe('company-a');
    });

    it('keeps duplicate code protection for the same record without flagging itself', async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ id: BRANCH_ID, companyId: 'company-a', code: 'BRN-000002', name: 'old' })
        .mockResolvedValueOnce(null);
      prisma.branch.update.mockResolvedValue({ id: BRANCH_ID, name: CANONICAL });

      await service.update(BRANCH_ID, { code: 'BRN-000002', name: CANONICAL }, CTX, CALLER);

      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ NOT: { id: BRANCH_ID } }) }),
      );
      expect(auditCalls()).toHaveLength(1);
    });
  });
});
