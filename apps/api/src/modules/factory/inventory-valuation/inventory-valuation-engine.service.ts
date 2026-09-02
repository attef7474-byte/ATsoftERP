import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  INVENTORY_MUTATOR_COVERAGE,
  INVENTORY_VALUATION_METHOD_WEIGHTED_AVERAGE,
} from './inventory-valuation.constants';

/**
 * VAL-R1C: canonical ATOMIC PERPETUAL WEIGHTED MOVING AVERAGE ENGINE.
 *
 * This service owns ALL weighted-average valuation math and the authority over
 * the running monetary InventoryValuationBalance state for ACTIVE warehouses. It
 * is the ONLY place the receipt / issue / true-return formulas and the monetary
 * movement snapshot are computed; no other service duplicates them.
 *
 * Design invariants (non-negotiable):
 *  - Every operation runs on the caller's OWN open DB transaction (the passed-in
 *    TransactionClient). The engine never opens an independent transaction
 *    scope; the caller owns Serializable isolation and commit/rollback. The
 *    physical InventoryBalance change, InventoryMovement/line, monetary snapshot,
 *    and InventoryValuationBalance update therefore live in the SAME transaction
 *    (ATOMIC_PHYSICAL_MONETARY_POSTING), and any failure rolls back the event.
 *  - All authoritative quantity/cost/value math uses Prisma.Decimal. No
 *    Number(...)/parseFloat(...)/Math.round(...)/binary multiplication for money.
 *    Rounding only at storage boundaries (quantity 18,4; average 19,8;
 *    movement unitCost 19,6; movement totalCost 19,4; inventoryValue 19,4).
 *  - SQL Server serialization for (companyId, warehouseId, productId) is
 *    authoritative at the DB level via an Exclusive Transaction-scoped applock
 *    (sp_getapplock). It serializes both case A (valuation balance row exists)
 *    and case B (very first receipt, no row yet) and is released at commit. The
 *    unique (companyId, warehouseId, productId) index is the backstop.
 *  - Physical quantity authority = SUM(InventoryBalance.quantityBase). The caller
 *    passes `qold` (aggregate physical quantity BEFORE this line's impact),
 *    computed on the same transaction under the lock, so `qold` is always the
 *    current physical on hand. Monetary state authority =
 *    InventoryValuationBalance.inventoryValue.
 */

export const VALUATION_ENGINE_WA_LOCK_RESOURCE_PREFIX = 'ATSOFT:VAL:WMA:';

interface BasePostingInput {
  companyId: string;
  warehouseId: string;
  productId: string;
  qold: Prisma.Decimal;
  lineId: string;
  movementId: string;
  currencyCode: string;
}

export interface ValuedReceiptInput extends BasePostingInput {
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  /** Exact authoritative receipt value. R1G-B supplies this from the frozen
   * ProductionRunCostSnapshot allocation so the final partial receipt consumes
   * the exact remaining 4dp value without a multiplication residue. */
  authoritativeEventValue?: Prisma.Decimal;
}

export interface ValuedIssueInput extends BasePostingInput {
  quantity: Prisma.Decimal;
}

export interface ValuedReversalInput extends BasePostingInput {
  quantity: Prisma.Decimal;
  originalUnitCost: Prisma.Decimal;
  /** Exact conserved event value for a final remainder when supplied by a
   * trusted original-link resolver; otherwise quantity x originalUnitCost. */
  originalEventValue?: Prisma.Decimal;
}

export interface ValuedReceiptReversalInput extends BasePostingInput {
  quantity: Prisma.Decimal;
  originalUnitCost: Prisma.Decimal;
  originalEventValue: Prisma.Decimal;
}

export interface ValuedPostingResult {
  valuationBalanceId: string;
  inventoryValue: Prisma.Decimal;
  averageUnitCost: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  currencyCode: string;
  valuationMethod: string;
}

// VAL-R1D: one side of a valued warehouse transfer (source or destination).
export interface ValuedTransferSide {
  companyId: string;
  warehouseId: string;
  productId: string;
  qold: Prisma.Decimal;
  lineId: string;
  movementId: string;
  currencyCode: string;
}

export interface ValuedTransferInput {
  source: ValuedTransferSide;
  destination: ValuedTransferSide;
  quantity: Prisma.Decimal;
  currencyCode: string;
}

export interface ValuedTransferResult {
  source: ValuedPostingResult;
  destination: ValuedPostingResult;
  transferTotalValue: Prisma.Decimal;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryValuationEngineService {
  constructor(private readonly prisma: PrismaService) {}

  // ── coverage gate (consulted at activation) ───────────────────────────────

  /**
   * Verifies every registered InventoryBalance mutator is either
   * VALUATION_AWARE_R1C or BLOCKED_WHEN_ACTIVE. A classification change or a
   * future registry entry without a valid classification fails the gate, so
   * activation cannot proceed with an unprotected active mutator.
   */
  coverageGatePasses(): { pass: boolean; unprotected: { key: string; classification: string }[] } {
    const unprotected = INVENTORY_MUTATOR_COVERAGE.filter(
      (m) =>
        m.classification !== 'VALUATION_AWARE_R1C' &&
        m.classification !== 'VALUATION_AWARE_R1D' &&
        m.classification !== 'VALUATION_AWARE_R1E' &&
        m.classification !== 'VALUATION_AWARE_R1F' &&
        m.classification !== 'VALUATION_AWARE_R1G_B' &&
        m.classification !== 'BLOCKED_WHEN_ACTIVE',
    );
    return { pass: unprotected.length === 0, unprotected };
  }

  /**
   * Returns the ACTIVE valuation policy for a given company+warehouse, or null
   * when no ACTIVE policy exists. Runs on the caller's transaction (tenant-safe).
   */
  async findActivePolicyForWarehouse(
    tx: Tx,
    companyId: string,
    warehouseId: string,
  ): Promise<{ id: string; currencyCode: string; method: string } | null> {
    return tx.inventoryValuationPolicy.findFirst({
      where: { companyId, warehouseId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, currencyCode: true, method: true },
    });
  }

  /**
   * Returns the ACTIVE valuation policies for all warehouses in a company-scope
   * (optionally branch-scoped via the warehouse branch). Used to block
   * destructive in-scope rebuilds.
   */
  async findActivePoliciesInScope(
    tx: Tx,
    companyId: string,
    branchId?: string,
  ): Promise<{ id: string; warehouseId: string; currencyCode: string }[]> {
    return tx.inventoryValuationPolicy.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        deletedAt: null,
        warehouse: { ...(branchId ? { branchId } : {}) },
      },
      select: { id: true, warehouseId: true, currencyCode: true },
    });
  }

  /**
   * VERIFIED: throws when an ACTIVE valuation policy exists for the warehouse,
   * blocking a not-yet-valorized mutation path. Emits the generic active-flow
   * error key.
   */
  async assertNotActiveForMutation(
    tx: Tx,
    companyId: string,
    warehouseId: string,
    _flowKey: string,
  ): Promise<void> {
    const policy = await this.findActivePolicyForWarehouse(tx, companyId, warehouseId);
    if (policy) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.unsupportedActiveFlow',
        message: 'This operation is blocked while an ACTIVE valuation policy exists for the warehouse',
      });
    }
  }

  /**
   * Authoritative physical quantity for one product in one warehouse:
   * SUM(InventoryBalance.quantityBase), falling back to the legacy Float
   * quantity when quantityBase is null. This is the physical on-hand authority
   * and the source of EVERY `qold` passed into receipt/issue/return math.
   */
  async aggregatePhysicalQuantity(
    tx: Tx,
    warehouseId: string,
    productId: string,
  ): Promise<Prisma.Decimal> {
    const balances = await tx.inventoryBalance.findMany({
      where: { warehouseId, productId },
      select: { quantity: true, quantityBase: true },
    });
    let sum = new Prisma.Decimal(0);
    for (const b of balances) {
      if (b.quantityBase !== null && b.quantityBase !== undefined) {
        sum = sum.plus(new Prisma.Decimal(b.quantityBase.toString()));
      } else {
        sum = sum.plus(new Prisma.Decimal(Number.isFinite(b.quantity) ? b.quantity : 0));
      }
    }
    return sum;
  }

  // ── SQL Server valuation lock ─────────────────────────────────────────────

  /**
   * Acquires a Transaction-scoped Exclusive applock on a deterministic resource
   * derived from (companyId, warehouseId, productId). SQL Server serializes
   * concurrent transactions on the same resource at DB level (authoritative, not
   * a JS/process mutex). Released automatically at commit/rollback. Handles both
   * case A (balance row exists) and case B (first receipt, no row). Exclusive
   * lock timeout (5s) is a hard concurrency failure.
   */
  async acquireValuationLock(
    tx: Tx,
    companyId: string,
    warehouseId: string,
    productId: string,
  ): Promise<void> {
    const resource = `${VALUATION_ENGINE_WA_LOCK_RESOURCE_PREFIX}${companyId}:${warehouseId}:${productId}`;
    const result: Array<{ result: number }> = await tx.$queryRaw`
      DECLARE @res int;
      EXEC @res = sp_getapplock @Resource = ${resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
      SELECT @res AS result;
    `;
    const status = result?.[0]?.result;
    // 0 = granted, 1 = granted after wait, -1 = timeout, -2 = cancelled, -3 = deadlock victim
    if (status === -1 || status === -2 || status === -3) {
      throw new ConflictException({
        messageKey: 'inventoryValuation.concurrencyConflict',
        message: 'A concurrent valuation operation conflicts on this product and warehouse; retry the operation',
      });
    }
  }

  // VAL-R1D: acquires the valuation applock for EVERY scope in a multi-warehouse
  // operation (e.g. warehouse transfer touches source AND destination). Scopes
  // are acquired in deterministic lexicographic order
  // (companyId -> warehouseId -> productId) so two concurrent transfers between
  // the same pair of warehouses always lock in the same order and cannot form an
  // A->B / B->A deadlock.
  async acquireValuationLocksSorted(
    tx: Tx,
    scopes: { companyId: string; warehouseId: string; productId: string }[],
  ): Promise<void> {
    const sorted = [...scopes].sort((a, b) => {
      const ka = `${a.companyId}\u0000${a.warehouseId}\u0000${a.productId}`;
      const kb = `${b.companyId}\u0000${b.warehouseId}\u0000${b.productId}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    for (const scope of sorted) {
      await this.acquireValuationLock(tx, scope.companyId, scope.warehouseId, scope.productId);
    }
  }

  // ── valued receipt ─────────────────────────────────────────────────────────

  /**
   * Weighted moving-average receipt:
   *   Qnew = Qold + Qin
   *   Vnew = Vold + Vin            (Vin = Qin x Cin)
   *   if Qold > 0:  Cnew = Vnew / Qnew
   *   if Qold = 0:  Cnew = Cin     (never blend stale cost at zero stock)
   * Running inventoryValue is authoritative; average is derived from Vnew / Qnew.
   */
  async applyValuedReceipt(tx: Tx, input: ValuedReceiptInput): Promise<ValuedPostingResult> {
    await this.acquireValuationLock(tx, input.companyId, input.warehouseId, input.productId);
    const balance = await this.readValuationBalance(tx, input.companyId, input.warehouseId, input.productId);

    const qold = input.qold;
    const vold = balance ? new Prisma.Decimal(balance.inventoryValue.toString()) : new Prisma.Decimal(0);
    const qin = input.quantity;
    const vin = input.authoritativeEventValue ?? qin.mul(input.unitCost);
    const qnew = qold.add(qin);
    const vnew = vold.add(vin);

    const receiptValuePerUnit = vin.dividedBy(qin);
    const cnew = qold.gt(0) && qnew.gt(0) ? vnew.dividedBy(qnew) : receiptValuePerUnit;

    return this.persist(tx, input, balance?.id, qnew, vnew, cnew, vin, input.unitCost, input.currencyCode);
  }

  // ── valued issue ───────────────────────────────────────────────────────────

  /**
   * Weighted moving-average issue:
   *   reject Qout > Qold (no active negative stock)
   *   Vout = Qout x Cissue
   *   Qnew = Qold - Qout
   *   Vnew = Vold - Vout
   *   if Qnew > 0:  averageUnitCost = Vnew / Qnew
   *   if Qnew = 0:  inventoryValue = 0 exactly; averageUnitCost = 0 (no residue)
   *   lastHistoricalUnitCost = current unit cost on issue
   */
  async applyValuedIssue(tx: Tx, input: ValuedIssueInput): Promise<ValuedPostingResult> {
    await this.acquireValuationLock(tx, input.companyId, input.warehouseId, input.productId);
    const balance = await this.readValuationBalance(tx, input.companyId, input.warehouseId, input.productId);
    if (!balance) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.stateMissing',
        message: 'No valuation balance exists to issue against; initialize the product first',
      });
    }

    const qold = input.qold;
    const vold = new Prisma.Decimal(balance.inventoryValue.toString());
    const avg = new Prisma.Decimal(balance.averageUnitCost.toString());
    const qout = input.quantity;

    if (qout.gt(qold)) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.negativeStock',
        message: `Cannot issue more than the available physical stock (available ${qold.toString()}, requested ${qout.toString()})`,
      });
    }

    // Full depletion removes the authoritative residual value exactly. This is
    // important when the stored 8dp average cannot reproduce a 4dp inventory
    // value perfectly by multiplication.
    const fullDepletion = qout.eq(qold);
    const cissue = fullDepletion && qold.gt(0) ? vold.dividedBy(qold) : avg;
    const vout = fullDepletion ? vold : qout.mul(cissue);
    const qnew = qold.minus(qout);
    const vnew = fullDepletion ? new Prisma.Decimal(0) : vold.minus(vout);
    const cnew = qnew.gt(0) ? vnew.dividedBy(qnew) : new Prisma.Decimal(0);

    return this.persist(tx, input, balance.id, qnew, vnew, cnew, vout, cissue, input.currencyCode);
  }

  // ── true return / reversal ─────────────────────────────────────────────────

  /**
   * True return linked to an original valued issue. Returned stock re-enters at
   * the ORIGINAL historical movement snapshot cost (`originalUnitCost`) and
   * reblends — never the current moving average. Only called when the reversal
   * reliably identifies the original valued line; otherwise the reversal is
   * blocked for the ACTIVE warehouse.
   */
  async applyTrueReturn(tx: Tx, input: ValuedReversalInput): Promise<ValuedPostingResult> {
    await this.acquireValuationLock(tx, input.companyId, input.warehouseId, input.productId);
    const balance = await this.readValuationBalance(tx, input.companyId, input.warehouseId, input.productId);

    const qold = input.qold;
    const vold = balance ? new Prisma.Decimal(balance.inventoryValue.toString()) : new Prisma.Decimal(0);
    const qin = input.quantity;
    const vin = input.originalEventValue ?? qin.mul(input.originalUnitCost);
    const qnew = qold.add(qin);
    const vnew = vold.add(vin);
    const cnew = qold.gt(0) && qnew.gt(0) ? vnew.dividedBy(qnew) : input.originalUnitCost;

    return this.persist(tx, input, balance?.id, qnew, vnew, cnew, vin, input.originalUnitCost, input.currencyCode);
  }

  /**
   * R1G-B trusted finished-goods receipt reversal. The physical caller removes
   * the original receipt quantity while this monetary twin removes the ORIGINAL
   * immutable receipt event value, never today's warehouse moving average.
   */
  async applyValuedReceiptReversal(tx: Tx, input: ValuedReceiptReversalInput): Promise<ValuedPostingResult> {
    await this.acquireValuationLock(tx, input.companyId, input.warehouseId, input.productId);
    const balance = await this.readValuationBalance(tx, input.companyId, input.warehouseId, input.productId);
    if (!balance) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.stateMissing',
        message: 'No valuation balance exists to reverse the finished-goods receipt against',
      });
    }

    const qold = input.qold;
    const qout = input.quantity;
    const vold = new Prisma.Decimal(balance.inventoryValue.toString());
    if (qout.gt(qold)) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.negativeStock',
        message: `Cannot reverse more finished goods than physical stock on hand (available ${qold.toString()}, requested ${qout.toString()})`,
      });
    }

    const qnew = qold.minus(qout);
    const vnew = vold.minus(input.originalEventValue);
    if (vnew.isNegative() || (qnew.equals(0) && !vnew.equals(0))) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.receiptReversalStateInvalid',
        message: 'The original finished-goods value cannot be removed from the current valuation state safely',
      });
    }
    const cnew = qnew.gt(0) ? vnew.dividedBy(qnew) : new Prisma.Decimal(0);

    return this.persist(
      tx,
      input,
      balance.id,
      qnew,
      vnew,
      cnew,
      input.originalEventValue,
      input.originalUnitCost,
      input.currencyCode,
    );
  }

  // ── valued warehouse transfer (VAL-R1D) ───────────────────────────────────

  /**
   * Weighted moving-average warehouse transfer with VALUE CONSERVATION:
   *   A single authoritative `transferTotalValue` is used for BOTH the source
   *   decrement and the destination increment, so the COMBINED value across the
   *   two valuation balances is unchanged (source loses V, destination gains V).
   *
   *   Source issue:
   *     if qty < qold:  vout = qty x avgSource ;  Vsrc_new = Vsrc_old - vout
   *     if qty >= qold (FULL DEPLETION):
   *       vout = Vsrc_old exactly, so Vsrc_new = 0 EXACTLY (no residual value)
   *   Destination receipt (reblend at the transferred value):
   *     Vdst_new = Vdst_old + vout ;  Qdst_new = Qdst_old + qty
   *     avgDst = Vdst_new / Qdst_new
   *
   *   transferTotalValue (rounded to 4dp) is the single authoritative figure and
   *   is persisted on the transfer line for audit; both movement-line snapshots
   *   (source unitCost = avgSource, destination unitCost = new avgDst) carry the
   *   same totalCost = transferTotalValue.
   *
   *   The engine acquires the source AND destination valuation applocks in
   *   deterministic sorted order (deadlock avoidance). Both Balance mutations and
   *   movement-line monetary snapshots happen on the caller's OWN transaction,
   *   so source and destination update atomically together.
   */
  async applyValuedTransfer(tx: Tx, input: ValuedTransferInput): Promise<ValuedTransferResult> {
    await this.acquireValuationLocksSorted(tx, [
      {
        companyId: input.source.companyId,
        warehouseId: input.source.warehouseId,
        productId: input.source.productId,
      },
      {
        companyId: input.destination.companyId,
        warehouseId: input.destination.warehouseId,
        productId: input.destination.productId,
      },
    ]);

    // ── Source side (issue) ─────────────────────────────────────────────────
    const srcBalance = await this.readValuationBalance(
      tx,
      input.source.companyId,
      input.source.warehouseId,
      input.source.productId,
    );
    if (!srcBalance) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.stateMissing',
        message: 'No valuation balance exists at the source; initialize the product first',
      });
    }
    const srcQold = input.source.qold;
    const srcVold = new Prisma.Decimal(srcBalance.inventoryValue.toString());
    const srcAvg = new Prisma.Decimal(srcBalance.averageUnitCost.toString());
    const qty = input.quantity;

    if (qty.gt(srcQold)) {
      throw new BadRequestException({
        messageKey: 'inventoryValuation.negativeStock',
        message: `Cannot transfer more than the available physical stock at source (available ${srcQold.toString()}, requested ${qty.toString()})`,
      });
    }

    // Full depletion: remove the ENTIRE residual value so the source reaches
    // exactly zero; otherwise value at the moving average.
    const fullDepletion = qty.gte(srcQold);
    const srcOutValue = fullDepletion ? srcVold : qty.mul(srcAvg);

    const srcQnew = srcQold.minus(qty);
    const srcVnew = fullDepletion ? new Prisma.Decimal(0) : srcVold.minus(srcOutValue);
    const srcCnew = srcQnew.gt(0) ? srcVnew.dividedBy(srcQnew) : new Prisma.Decimal(0);

    const transferTotalValue = srcOutValue.toDecimalPlaces(4);
    const srcSnapshotUnit = (fullDepletion ? srcVold.dividedBy(srcQold) : srcAvg).toDecimalPlaces(6);

    const sourceResult = await this.persist(
      tx,
      input.source,
      srcBalance.id,
      srcQnew,
      srcVnew,
      srcCnew,
      transferTotalValue,
      srcSnapshotUnit,
      input.currencyCode,
    );

    // ── Destination side (receipt / reblend at the transferred value) ──────
    const dstBalance = await this.readValuationBalance(
      tx,
      input.destination.companyId,
      input.destination.warehouseId,
      input.destination.productId,
    );
    const dstQold = input.destination.qold;
    const dstVold = dstBalance ? new Prisma.Decimal(dstBalance.inventoryValue.toString()) : new Prisma.Decimal(0);
    const dstVnew = dstVold.add(transferTotalValue);
    const dstQnew = dstQold.add(qty);
    const dstCnew = dstQold.gt(0) && dstQnew.gt(0) ? dstVnew.dividedBy(dstQnew) : transferTotalValue.dividedBy(qty).toDecimalPlaces(8);

    const destinationResult = await this.persist(
      tx,
      input.destination,
      dstBalance?.id,
      dstQnew,
      dstVnew,
      dstCnew,
      transferTotalValue,
      dstCnew,
      input.currencyCode,
    );

    return { source: sourceResult, destination: destinationResult, transferTotalValue };
  }

  private async readValuationBalance(
    tx: Tx,
    companyId: string,
    warehouseId: string,
    productId: string,
  ) {
    return tx.inventoryValuationBalance.findUnique({
      where: {
        companyId_warehouseId_productId: { companyId, warehouseId, productId },
      },
    });
  }

  private async persist(
    tx: Tx,
    input: BasePostingInput,
    balanceId: string | undefined,
    qnew: Prisma.Decimal,
    vnew: Prisma.Decimal,
    cnew: Prisma.Decimal,
    eventValue: Prisma.Decimal,
    snapshotUnitCost: Prisma.Decimal,
    snapshotCurrency: string,
  ): Promise<ValuedPostingResult> {
    const inventoryValue = vnew.toDecimalPlaces(4);
    const averageUnitCost = cnew.toDecimalPlaces(8);
    const snapshotUnit = snapshotUnitCost.toDecimalPlaces(6);
    const snapshotTotal = eventValue.toDecimalPlaces(4);

    let valuationBalanceId: string;
    if (balanceId) {
      const updated = await tx.inventoryValuationBalance.update({
        where: { id: balanceId },
        data: {
          inventoryValue,
          averageUnitCost,
          lastHistoricalUnitCost: snapshotUnit,
          version: { increment: 1 },
        },
        select: { id: true },
      });
      valuationBalanceId = updated.id;
    } else {
      // First receipt for (company, warehouse, product): create the valuation
      // balance inside the transaction while holding the exclusive applock. The
      // unique index is the backstop against a residual concurrent first-receipt
      // race.
      const created = await tx.inventoryValuationBalance.create({
        data: {
          companyId: input.companyId,
          warehouseId: input.warehouseId,
          productId: input.productId,
          inventoryValue,
          averageUnitCost,
          lastHistoricalUnitCost: snapshotUnit,
          version: 1,
        },
        select: { id: true },
      });
      valuationBalanceId = created.id;
    }

    // Monetary snapshot quartet on the movement line — always written together.
    await tx.inventoryMovementLine.update({
      where: { id: input.lineId },
      data: {
        unitCost: snapshotUnit,
        totalCost: snapshotTotal,
        currencyCode: snapshotCurrency,
        valuationMethod: INVENTORY_VALUATION_METHOD_WEIGHTED_AVERAGE,
      },
    });

    return {
      valuationBalanceId,
      inventoryValue,
      averageUnitCost,
      unitCost: snapshotUnit,
      totalCost: snapshotTotal,
      currencyCode: snapshotCurrency,
      valuationMethod: INVENTORY_VALUATION_METHOD_WEIGHTED_AVERAGE,
    };
  }
}
