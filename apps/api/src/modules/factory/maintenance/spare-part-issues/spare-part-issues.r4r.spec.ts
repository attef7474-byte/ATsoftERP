import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SparePartIssuesService } from './spare-part-issues.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { MaintenanceStockIssueService } from '../maintenance-stock-issue/maintenance-stock-issue.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

/**
 * R4R — canonical Spare Part Issue tenant isolation.
 *
 * The canonical issue route replaces the request-nested stock-issue route. Because it is
 * a first-class resource it must enforce the same, and only the same, tenant boundary:
 * Company A can issue its own approved requirement; Company B can neither issue it,
 * read its movements, nor return stock against it, and a cross-tenant reference is
 * reported identically to a missing record so no record id is disclosed.
 */

const ctxA: ActiveOperationalContext = {
  contextKey: 'cA:bA:-:-', scopeId: 'sA',
  companyId: 'cA', companyName: 'Company A', companyCode: 'A',
  branchId: 'bA', branchName: 'HQ A', branchCode: 'A',
  administrationId: null, administrationName: null, administrationCode: null,
  departmentId: null, departmentName: null, departmentCode: null,
  isDefault: true, source: 'EXPLICIT_SCOPE',
};

const ctxB: ActiveOperationalContext = {
  ...ctxA,
  contextKey: 'cB:bB:-:-', scopeId: 'sB',
  companyId: 'cB', companyName: 'Company B', companyCode: 'B',
  branchId: 'bB', branchName: 'HQ B', branchCode: 'B',
};

const requirement = (overrides: Record<string, any> = {}) => ({
  id: 'line-A',
  maintenanceRequestId: 'req-A',
  machineComponentId: null,
  status: 'APPROVED',
  sparePart: { id: 'sp-A', code: 'SP-A', productId: 'prod-A', status: 'ACTIVE', deletedAt: null },
  maintenanceRequest: { id: 'req-A', machine: { id: 'm-A', companyId: 'cA', branchId: 'bA' } },
  ...overrides,
});

const issueDto = (overrides: Record<string, any> = {}) => ({
  requiredPartId: 'line-A',
  maintenanceRequestId: 'req-A',
  warehouseId: 'wh-A',
  issuedQuantity: 2,
  ...overrides,
});

describe('R4R SparePartIssuesService tenant isolation', () => {
  let prisma: any;
  let audit: any;
  let stockIssue: any;
  let service: SparePartIssuesService;

  beforeEach(() => {
    prisma = {
      maintenanceRequestRequiredPart: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      inventoryBalance: { findMany: jest.fn().mockResolvedValue([]) },
      warehouse: { findUnique: jest.fn().mockResolvedValue({ id: 'wh-A', companyId: 'cA', branchId: 'bA' }) },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    stockIssue = {
      issue: jest.fn().mockResolvedValue({ id: 'line-A' }),
      returnStock: jest.fn().mockResolvedValue({ id: 'line-A' }),
      getIssues: jest.fn().mockResolvedValue([]),
    };
    service = new SparePartIssuesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      stockIssue as unknown as MaintenanceStockIssueService,
    );
  });

  describe('issue', () => {
    it('Company A issues its own approved requirement', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      await service.issue(issueDto() as any, 'user-A', ctxA);

      expect(stockIssue.issue).toHaveBeenCalledWith(
        'req-A',
        'line-A',
        expect.objectContaining({ warehouseId: 'wh-A', issuedQuantity: 2 }),
        'user-A',
        ctxA,
        {},
      );
      expect(audit.log).toHaveBeenCalledWith(
        'user-A',
        'SPARE_PART_ISSUE',
        'MaintenanceRequestRequiredPart',
        'line-A',
        expect.objectContaining({ canonicalWorkflow: 'SPARE_PART_ISSUE', companyId: 'cA', branchId: 'bA' }),
      );
    });

    it('Company B cannot issue Company A requirement', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      const error = await service.issue(issueDto() as any, 'user-B', ctxB).catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect(stockIssue.issue).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('Company B gets the SAME error for a foreign requirement as for a missing one', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValueOnce(requirement());
      const foreign = await service.issue(issueDto() as any, 'user-B', ctxB).catch((e) => e);

      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValueOnce(null);
      const missing = await service.issue(issueDto() as any, 'user-B', ctxB).catch((e) => e);

      expect(foreign.getStatus()).toBe(missing.getStatus());
      expect(foreign.getResponse()).toEqual(missing.getResponse());
    });

    it('Company B in the same company but another branch cannot issue it', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        requirement({ maintenanceRequest: { id: 'req-A', machine: { id: 'm-A', companyId: 'cA', branchId: 'bA2' } } }),
      );

      const error = await service.issue(issueDto() as any, 'user-A', ctxA).catch((e) => e);

      expect(error).toBeInstanceOf(NotFoundException);
      expect(stockIssue.issue).not.toHaveBeenCalled();
    });

    it('a machine with no branch (company-wide) is issuable from any authorized branch', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        requirement({ maintenanceRequest: { id: 'req-A', machine: { id: 'm-A', companyId: 'cA', branchId: null } } }),
      );

      await service.issue(issueDto() as any, 'user-A', ctxA);

      expect(stockIssue.issue).toHaveBeenCalled();
    });

    it('rejects a requirement that does not belong to the supplied maintenance request', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      const error = await service
        .issue(issueDto({ maintenanceRequestId: 'req-OTHER' }) as any, 'user-A', ctxA)
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ messageKey: 'sparePartIssue.requirementRequestMismatch' });
      expect(stockIssue.issue).not.toHaveBeenCalled();
    });

    it('rejects a requirement that is not APPROVED or RESERVED', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement({ status: 'DRAFT' }));

      const error = await service.issue(issueDto() as any, 'user-A', ctxA).catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ messageKey: 'sparePartIssue.requirementNotIssuable' });
      expect(stockIssue.issue).not.toHaveBeenCalled();
    });

    it('rejects a requirement with no canonical spare part attached', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement({ sparePart: null }));

      const error = await service.issue(issueDto() as any, 'user-A', ctxA).catch((e) => e);

      expect(error.getResponse()).toMatchObject({ messageKey: 'sparePartIssue.sparePartMissing' });
      expect(stockIssue.issue).not.toHaveBeenCalled();
    });

    it('a foreign warehouse is rejected BEFORE the stock authority is invoked', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-A', companyId: 'cB', branchId: 'bB' });

      await expect(service.issue(issueDto() as any, 'user-A', ctxA)).rejects.toBeDefined();
      expect(stockIssue.issue).not.toHaveBeenCalled();
    });

    it('the canonical DTO never forwards the client-supplied requirement identity as authority: only ids reach the authority', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      await service.issue(
        issueDto({
          // A malicious payload trying to dictate identity fields.
          sparePartId: 'sp-EVIL',
          productId: 'prod-EVIL',
          machineId: 'm-EVIL',
          approvedQuantity: 999,
        }) as any,
        'user-A',
        ctxA,
      );

      const forwarded = stockIssue.issue.mock.calls[0][2];
      expect(forwarded.sparePartId).toBeUndefined();
      expect(forwarded.productId).toBeUndefined();
      expect(forwarded.machineId).toBeUndefined();
      expect(forwarded.approvedQuantity).toBeUndefined();
      expect(forwarded.requiredPartId).toBeUndefined();
      expect(forwarded.maintenanceRequestId).toBeUndefined();
    });

    it('the clientRequestId is passed through to the authority as the idempotency key', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      await service.issue(issueDto({ clientRequestId: 'cr-1' }) as any, 'user-A', ctxA);

      expect(stockIssue.issue).toHaveBeenCalledWith(
        'req-A', 'line-A', expect.anything(), 'user-A', ctxA, { clientRequestId: 'cr-1' },
      );
    });

    it('audits exactly one SPARE_PART_ISSUE event for a real issue', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());
      stockIssue.issue.mockResolvedValueOnce({ id: 'line-A' });

      await service.issue(issueDto() as any, 'user-A', ctxA);

      const canonicalAudits = audit.log.mock.calls.filter((c: any[]) => c[1] === 'SPARE_PART_ISSUE');
      expect(canonicalAudits).toHaveLength(1);
    });

    it('does NOT audit a second SPARE_PART_ISSUE event when the authority reports an idempotent replay', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());
      // The authority signals that the submission was a replay: no movement was created.
      stockIssue.issue.mockResolvedValueOnce({ id: 'line-A', idempotentReplay: true });

      await service.issue(issueDto({ clientRequestId: 'cr-replay' }) as any, 'user-A', ctxA);

      const canonicalAudits = audit.log.mock.calls.filter((c: any[]) => c[1] === 'SPARE_PART_ISSUE');
      expect(canonicalAudits).toHaveLength(0);
    });
  });

  describe('movements', () => {
    it('Company A reads its own requirement movements', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      await service.movements('line-A', 'req-A', ctxA);

      expect(stockIssue.getIssues).toHaveBeenCalledWith('line-A', 'req-A', ctxA);
    });

    it('Company B cannot read Company A requirement movements', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      await expect(service.movements('line-A', 'req-A', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(stockIssue.getIssues).not.toHaveBeenCalled();
    });
  });

  describe('return', () => {
    it('Company A returns stock against its own requirement', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      await service.return({ returnQuantity: 1 } as any, 'line-A', 'req-A', 'user-A', ctxA);

      expect(stockIssue.returnStock).toHaveBeenCalledWith('req-A', 'line-A', { returnQuantity: 1 }, 'user-A', ctxA);
    });

    it('Company B cannot return stock against Company A requirement', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(requirement());

      await expect(
        service.return({ returnQuantity: 1 } as any, 'line-A', 'req-A', 'user-B', ctxB),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(stockIssue.returnStock).not.toHaveBeenCalled();
    });
  });

  describe('listIssuable', () => {
    it('scopes the worklist to the active company and branch through the owning machine', async () => {
      prisma.maintenanceRequestRequiredPart.findMany.mockResolvedValue([]);
      prisma.maintenanceRequestRequiredPart.count.mockResolvedValue(0);

      await service.listIssuable({}, ctxA);

      expect(prisma.maintenanceRequestRequiredPart.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['APPROVED', 'RESERVED'] },
            maintenanceRequest: {
              machine: {
                companyId: 'cA',
                OR: [{ branchId: 'bA' }, { branchId: null }],
              },
            },
          }),
        }),
      );
    });

    it('only offers a requirement whose spare part is ACTIVE, not deleted and still has remaining quantity', async () => {
      prisma.maintenanceRequestRequiredPart.findMany.mockResolvedValue([
        {
          id: 'line-1',
          maintenanceRequestId: 'req-A',
          status: 'APPROVED',
          requestedQuantity: 5,
          approvedQuantity: 4,
          issuedQuantity: 0,
          returnedQuantity: 0,
          stockIssueStatus: null,
          warehouseId: 'wh-A',
          machineComponent: null,
          lastIssueBy: null,
          sparePart: { id: 'sp-A', code: 'SP-A', name: 'Part A', productId: 'prod-A', unit: 'PCS', status: 'ACTIVE', deletedAt: null, isCritical: false },
          maintenanceRequest: { id: 'req-A', requestNumber: 'MR-1', title: 'Fix', status: 'IN_PROGRESS', machine: { id: 'm-A', code: 'M-A', name: 'Machine A', branchId: 'bA' } },
        },
      ]);
      prisma.maintenanceRequestRequiredPart.count.mockResolvedValue(1);

      const result = await service.listIssuable({}, ctxA);

      expect(result.data[0]).toMatchObject({ id: 'line-1', remainingIssuableQuantity: 4, issuable: true });
    });

    it('marks a soft-deleted spare part as not issuable', async () => {
      prisma.maintenanceRequestRequiredPart.findMany.mockResolvedValue([
        {
          id: 'line-2',
          maintenanceRequestId: 'req-A',
          status: 'APPROVED',
          requestedQuantity: 5,
          approvedQuantity: 5,
          issuedQuantity: 0,
          returnedQuantity: 0,
          stockIssueStatus: null,
          warehouseId: 'wh-A',
          machineComponent: null,
          lastIssueBy: null,
          sparePart: { id: 'sp-B', code: 'SP-B', name: 'Part B', productId: 'prod-B', unit: 'PCS', status: 'ACTIVE', deletedAt: new Date('2026-01-01'), isCritical: false },
          maintenanceRequest: { id: 'req-A', requestNumber: 'MR-1', title: 'Fix', status: 'IN_PROGRESS', machine: { id: 'm-A', code: 'M-A', name: 'Machine A', branchId: 'bA' } },
        },
      ]);
      prisma.maintenanceRequestRequiredPart.count.mockResolvedValue(1);

      const result = await service.listIssuable({}, ctxA);

      expect(result.data[0].issuable).toBe(false);
    });
  });
});
