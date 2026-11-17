export const FINISHED_GOODS_ISSUE_AUDIT_ENTITY = 'FinishedGoodsIssue';

/**
 * Canonical finished-goods OUT authority. It is deliberately separate from
 * `ProductionFinishedGoodsReceipt`, which is an IN receipt and is never reused
 * for an outbound issue. Posting always goes through the canonical
 * InventoryMovement posting contract (one ledger effect).
 */
export const FINISHED_GOODS_ISSUE_SOURCE_TYPE = 'FINISHED_GOODS_ISSUE';

export const FINISHED_GOODS_ISSUE_MOVEMENT_TYPE = 'FINISHED_GOODS_ISSUE';

export const FINISHED_GOODS_ISSUE_REVERSAL_MOVEMENT_TYPE = 'FINISHED_GOODS_ISSUE_REVERSAL';

/**
 * Request lifecycle: DRAFT -> SUBMITTED -> APPROVED -> POSTED. The requester
 * may withdraw a SUBMITTED request back to DRAFT; the warehouse may reject it
 * (terminal) or cancel a prior approval (back to SUBMITTED). POSTED is
 * immutable and can only be corrected by a reversal.
 */
export const FINISHED_GOODS_ISSUE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
] as const;

export const FINISHED_GOODS_ISSUE_PERMISSION_KEYS = {
  create: 'finished-goods-issue:create',
  read: 'finished-goods-issue:read',
  update: 'finished-goods-issue:update',
  delete: 'finished-goods-issue:delete',
  post: 'finished-goods-issue:post',
  cancel: 'finished-goods-issue:cancel',
  reverse: 'finished-goods-issue:reverse',
  // Requester vs warehouse separation of duties.
  submit: 'finished-goods-issue:submit',
  withdraw: 'finished-goods-issue:withdraw',
  approve: 'finished-goods-issue:approve',
  reject: 'finished-goods-issue:reject',
  cancelApproval: 'finished-goods-issue:cancel-approval',
} as const;

export const FINISHED_GOODS_ISSUE_INCLUDE = {
  issueWarehouse: { select: { id: true, code: true, name: true } },
  movement: { select: { id: true, movementNumber: true, movementType: true, status: true } },
  reversesIssue: { select: { id: true, issueNumber: true, status: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      warehouseLocation: { select: { id: true, code: true, name: true } },
    },
  },
} as const;
