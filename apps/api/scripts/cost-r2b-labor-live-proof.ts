import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { NumberingService } from '../src/modules/numbering/numbering.service';
import { InventoryValuationEngineService } from '../src/modules/factory/inventory-valuation/inventory-valuation-engine.service';
import { OperationalCostCenterResolver } from '../src/modules/factory/maintenance/cost-centers/operational-cost-center-resolver.service';
import { MaintenanceWorkOrdersService } from '../src/modules/factory/maintenance/maintenance-work-orders/maintenance-work-orders.service';
import { OperationalSourceChangesService } from '../src/modules/factory/operational-source-changes/operational-source-changes.service';
import { ProductionCostService } from '../src/modules/factory/production-cost/production-cost.service';
import { OperationalCostReconciliationService } from '../src/modules/factory/production-cost/operational-cost-reconciliation.service';

const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const prefix = `QA-COST-R2B-LABOR-${stamp}`;
const ids = {
  company: `${prefix}-COMPANY`,
  branch: `${prefix}-BRANCH`,
  user: `${prefix}-USER`,
  costCenter: `${prefix}-CC`,
  machine: `${prefix}-MACHINE`,
  workOrder: `${prefix}-WO`,
  labor: `${prefix}-LABOR`,
};

const prisma = new PrismaService();
const audit = new AuditService(prisma);
const numbering = new NumberingService(prisma);
const valuation = new InventoryValuationEngineService(prisma);
const resolver = new OperationalCostCenterResolver(prisma);
const sourceChanges = new OperationalSourceChangesService(prisma);
const productionCost = new ProductionCostService(prisma, audit, sourceChanges, numbering, resolver);
const workOrders = new MaintenanceWorkOrdersService(prisma, audit, numbering, valuation, productionCost, resolver);
const reconciliation = new OperationalCostReconciliationService(prisma);

const ctx: any = {
  contextKey: `${ids.company}:${ids.branch}:-:-`,
  scopeId: `${prefix}-SCOPE`,
  companyId: ids.company,
  companyName: prefix,
  companyCode: prefix,
  branchId: ids.branch,
  branchName: prefix,
  branchCode: prefix,
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};
const actor: any = { id: ids.user, sub: ids.user, email: `${stamp}@qa.invalid`, name: prefix };
const amount = new Prisma.Decimal('125.75');

let userVisibleHttp500 = 0;
const statusOf = (error: any): number => {
  const status = typeof error?.getStatus === 'function' ? error.getStatus() : 500;
  if (status === 500) userVisibleHttp500++;
  return status;
};

async function teardown() {
  await prisma.operationalSourceChange.deleteMany({ where: { companyId: ids.company, branchId: ids.branch } });
  await prisma.auditLog.deleteMany({ where: { userId: ids.user } });
  await prisma.operationalCostTransaction.deleteMany({
    where: { companyId: ids.company, branchId: ids.branch, entryRole: 'REVERSAL' },
  });
  await prisma.operationalCostTransaction.deleteMany({ where: { companyId: ids.company, branchId: ids.branch } });
  await prisma.maintenanceWorkOrderCostEntry.deleteMany({ where: { id: ids.labor } });
  await prisma.maintenanceWorkOrder.deleteMany({ where: { id: ids.workOrder } });
  await prisma.machine.deleteMany({ where: { id: ids.machine } });
  await prisma.costCenter.deleteMany({ where: { id: ids.costCenter } });
  // Repeat after operational rows are gone so even a late transaction-side audit
  // can never block exact-id fixture cleanup.
  await prisma.auditLog.deleteMany({ where: { userId: ids.user } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
  await prisma.branch.deleteMany({ where: { id: ids.branch } });
  await prisma.company.deleteMany({ where: { id: ids.company } });
}

async function residue() {
  const [company, branch, workOrder, labor, ledger, auditRows] = await Promise.all([
    prisma.company.count({ where: { id: ids.company } }),
    prisma.branch.count({ where: { id: ids.branch } }),
    prisma.maintenanceWorkOrder.count({ where: { id: ids.workOrder } }),
    prisma.maintenanceWorkOrderCostEntry.count({ where: { id: ids.labor } }),
    prisma.operationalCostTransaction.count({ where: { companyId: ids.company, branchId: ids.branch } }),
    prisma.auditLog.count({ where: { userId: ids.user } }),
  ]);
  return { company, branch, workOrder, labor, ledger, audit: auditRows };
}

async function main() {
  await prisma.$connect();
  await teardown();

  await prisma.company.create({ data: { id: ids.company, code: prefix, name: prefix, operationalCurrencyCode: 'YER' } });
  await prisma.branch.create({ data: { id: ids.branch, companyId: ids.company, code: prefix, name: prefix } });
  await prisma.user.create({
    data: {
      id: ids.user,
      email: actor.email,
      passwordHash: 'QA-DISPOSABLE-NOT-A-LOGIN-CREDENTIAL',
      name: prefix,
      companyId: ids.company,
      branchId: ids.branch,
    },
  });
  await prisma.costCenter.create({
    data: {
      id: ids.costCenter,
      code: prefix,
      name: prefix,
      type: 'MAINTENANCE',
      companyId: ids.company,
      branchId: ids.branch,
      status: 'ACTIVE',
    },
  });
  await prisma.machine.create({
    data: {
      id: ids.machine,
      code: prefix,
      name: prefix,
      companyId: ids.company,
      branchId: ids.branch,
      defaultCostCenterId: ids.costCenter,
    },
  });
  await prisma.maintenanceWorkOrder.create({
    data: {
      id: ids.workOrder,
      companyId: ids.company,
      branchId: ids.branch,
      workOrderNumber: prefix,
      title: prefix,
      status: 'IN_PROGRESS',
      machineId: ids.machine,
      createdById: ids.user,
      startedAt: new Date(),
    },
  });
  await prisma.maintenanceWorkOrderCostEntry.create({
    data: {
      id: ids.labor,
      workOrderId: ids.workOrder,
      type: 'LABOR',
      amount,
      incurredAt: new Date(),
      createdById: ids.user,
    },
  });

  // Missing currency must roll the entire completion/ledger transaction back.
  await prisma.company.update({ where: { id: ids.company }, data: { operationalCurrencyCode: null } });
  let missingCurrencyBlocked = false;
  try {
    await workOrders.transition(ids.workOrder, { action: 'complete' }, actor, ctx);
  } catch (error: any) {
    missingCurrencyBlocked = statusOf(error) !== 500
      && error?.getResponse?.()?.messageKey === 'productionCostTransaction.operationalCurrencyRequired';
  }
  const rollbackState = await prisma.maintenanceWorkOrder.findUnique({ where: { id: ids.workOrder }, select: { status: true } });
  const rollbackLedgerCount = await prisma.operationalCostTransaction.count({ where: { companyId: ids.company } });
  await prisma.company.update({ where: { id: ids.company }, data: { operationalCurrencyCode: 'YER' } });

  // Tenant denial before source mutation.
  let crossTenantBlocked = false;
  try {
    await workOrders.transition(ids.workOrder, { action: 'complete' }, actor, {
      ...ctx, companyId: `${prefix}-OTHER-COMPANY`, branchId: `${prefix}-OTHER-BRANCH`,
    });
  } catch (error: any) {
    crossTenantBlocked = statusOf(error) !== 500;
  }

  // Two real concurrent service calls serialize on the same work-order row.
  const concurrentResults = await Promise.allSettled([
    workOrders.transition(ids.workOrder, { action: 'complete' }, actor, ctx),
    workOrders.transition(ids.workOrder, { action: 'complete' }, actor, ctx),
  ]);
  const concurrentFailure = concurrentResults.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
  if (concurrentFailure) throw concurrentFailure.reason;

  const primaries = await prisma.operationalCostTransaction.findMany({
    where: {
      companyId: ids.company,
      branchId: ids.branch,
      sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY',
      sourceId: ids.labor,
      entryRole: 'PRIMARY_COST',
    },
  });
  const primary = primaries[0];
  const primaryPass = primaries.length === 1
    && primary.eventType === 'LABOR'
    && primary.costPurpose === 'MAINTENANCE'
    && primary.costNature === 'MANUAL_ASSERTED_ACTUAL'
    && primary.amount.eq(amount)
    && primary.quantity.eq(0)
    && primary.rate.eq(0)
    && primary.unit === 'AMOUNT'
    && primary.currencyCode === 'YER'
    && primary.companyId === ids.company
    && primary.branchId === ids.branch
    && primary.costCenterId === ids.costCenter
    && primary.machineId === ids.machine
    && primary.maintenanceWorkOrderId === ids.workOrder;

  let silentRepriceBlocked = false;
  try {
    await workOrders.updateCostEntry(ids.labor, { amount: 999 }, actor, ctx);
  } catch (error: any) {
    silentRepriceBlocked = statusOf(error) !== 500;
  }

  const reversalResult = await productionCost.reverseTransaction(
    primary.id,
    { clientRequestId: `${prefix}-REVERSAL`, reason: 'QA correction proof' },
    ids.user,
    ctx,
  );
  const reversal = reversalResult.reversal;
  const unchangedSource = await prisma.maintenanceWorkOrderCostEntry.findUnique({ where: { id: ids.labor } });
  const unchangedOriginal = await prisma.operationalCostTransaction.findUnique({ where: { id: primary.id } });
  const reversalPass = reversal.entryRole === 'REVERSAL'
    && reversal.reversalOfId === primary.id
    && reversal.sourceType === primary.sourceType
    && reversal.sourceId === primary.sourceId
    && reversal.amount.eq(primary.amount.negated())
    && reversal.currencyCode === primary.currencyCode
    && reversal.costPurpose === primary.costPurpose
    && reversal.costNature === primary.costNature
    && reversal.costCenterId === primary.costCenterId
    && reversal.maintenanceWorkOrderId === primary.maintenanceWorkOrderId
    && unchangedSource?.amount.eq(amount)
    && unchangedOriginal?.amount.eq(amount);

  let doubleReversalBlocked = false;
  try {
    await productionCost.reverseTransaction(
      primary.id,
      { clientRequestId: `${prefix}-REVERSAL-2`, reason: 'QA double reversal proof' },
      ids.user,
      ctx,
    );
  } catch (error: any) {
    doubleReversalBlocked = statusOf(error) !== 500;
  }

  const report = await reconciliation.reconcile({} as any, ctx);
  const counts = report.counts;
  const reversalCount = await prisma.operationalCostTransaction.count({
    where: { companyId: ids.company, branchId: ids.branch, sourceType: primary.sourceType, sourceId: ids.labor, entryRole: 'REVERSAL' },
  });

  const proof = {
    QA_PREFIX: prefix,
    REAL_DB_MAINTENANCE_LABOR_PRIMARY_POST: primaryPass ? 'PASS' : 'FAIL',
    REAL_DB_MAINTENANCE_LABOR_REVERSAL: reversalPass ? 'PASS' : 'FAIL',
    MISSING_CURRENCY: missingCurrencyBlocked ? 'BLOCKED' : 'NOT_BLOCKED',
    ATOMIC_ROLLBACK: rollbackState?.status === 'IN_PROGRESS' && rollbackLedgerCount === 0 ? 'PASS' : 'FAIL',
    CROSS_TENANT: crossTenantBlocked ? 'BLOCKED' : 'NOT_BLOCKED',
    POSTED_SOURCE_SILENT_REPRICE: silentRepriceBlocked ? 'BLOCKED' : 'NOT_BLOCKED',
    CONCURRENT_PRIMARY_COST_COUNT: primaries.length,
    LABOR_REVERSAL_COUNT: reversalCount,
    DOUBLE_REVERSAL: doubleReversalBlocked ? 'BLOCKED' : 'NOT_BLOCKED',
    CURRENT_MAINTENANCE_LABOR_LEDGER_ERROR_COUNT: counts.CURRENT_MAINTENANCE_LABOR_LEDGER_ERROR_COUNT,
    MAINTENANCE_LABOR_CURRENT_MISSING_LEDGER_COUNT: counts.MAINTENANCE_LABOR_CURRENT_MISSING_LEDGER_COUNT,
    MAINTENANCE_LABOR_VALUE_MISMATCH_COUNT: counts.MAINTENANCE_LABOR_VALUE_MISMATCH_COUNT,
    MAINTENANCE_LABOR_CURRENCY_MISMATCH_COUNT: counts.MAINTENANCE_LABOR_CURRENCY_MISMATCH_COUNT,
    MAINTENANCE_LABOR_ORPHAN_REVERSAL_COUNT: counts.MAINTENANCE_LABOR_ORPHAN_REVERSAL_COUNT,
    MAINTENANCE_LABOR_DOUBLE_REVERSAL_COUNT: counts.MAINTENANCE_LABOR_DOUBLE_REVERSAL_COUNT,
    USER_VISIBLE_HTTP_500: userVisibleHttp500,
  };

  await teardown();
  const finalResidue = await residue();
  console.log(JSON.stringify({ proof, residue: finalResidue }, null, 2));

  const failed = Object.values(finalResidue).some((v) => v !== 0)
    || proof.REAL_DB_MAINTENANCE_LABOR_PRIMARY_POST !== 'PASS'
    || proof.REAL_DB_MAINTENANCE_LABOR_REVERSAL !== 'PASS'
    || proof.MISSING_CURRENCY !== 'BLOCKED'
    || proof.ATOMIC_ROLLBACK !== 'PASS'
    || proof.CROSS_TENANT !== 'BLOCKED'
    || proof.POSTED_SOURCE_SILENT_REPRICE !== 'BLOCKED'
    || proof.CONCURRENT_PRIMARY_COST_COUNT !== 1
    || proof.LABOR_REVERSAL_COUNT !== 1
    || proof.DOUBLE_REVERSAL !== 'BLOCKED'
    || proof.CURRENT_MAINTENANCE_LABOR_LEDGER_ERROR_COUNT !== 0
    || proof.USER_VISIBLE_HTTP_500 !== 0;
  if (failed) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    statusOf(error);
    console.error('COST_R2B_LIVE_PROOF_FAILED', error?.message ?? String(error));
    try {
      await teardown();
      console.error('QA_RESIDUE_AFTER_FAILURE', JSON.stringify(await residue()));
    } catch (teardownError: any) {
      console.error('QA_TEARDOWN_FAILED', teardownError?.message ?? String(teardownError));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
