export const GENERAL_INVENTORY_ISSUE_AUDIT_ENTITY = 'GeneralInventoryIssue';

/**
 * Canonical general inventory OUT authority for the three non-spare, non-FG,
 * non-raw item classifications: PACKAGING_MATERIAL, CONSUMABLE and GENERAL.
 * It deliberately selects Product directly and never creates a generic issue
 * persistence model for the unified UI. Posting always goes through the single
 * InventoryMovement posting contract (one ledger effect).
 */
export const GENERAL_INVENTORY_ISSUE_SOURCE_TYPE = 'GENERAL_INVENTORY_ISSUE';

export const GENERAL_INVENTORY_ISSUE_MOVEMENT_TYPE = 'GENERAL_INVENTORY_ISSUE';

export const GENERAL_INVENTORY_ISSUE_REVERSAL_MOVEMENT_TYPE = 'GENERAL_INVENTORY_ISSUE_REVERSAL';

/** Exact issue types owned by this authority (never null/unclassified). */
export const GENERAL_INVENTORY_ISSUE_TYPES = [
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'GENERAL',
] as const;

/**
 * Request lifecycle: DRAFT -> SUBMITTED -> APPROVED -> POSTED. The requester
 * may withdraw a SUBMITTED request back to DRAFT; the warehouse may reject it
 * (terminal) or cancel a prior approval (back to SUBMITTED). POSTED is
 * immutable and can only be corrected by a separately posted reversal.
 */
export const GENERAL_INVENTORY_ISSUE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
] as const;

export const GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS = {
  create: 'general-inventory-issue:create',
  read: 'general-inventory-issue:read',
  update: 'general-inventory-issue:update',
  delete: 'general-inventory-issue:delete',
  post: 'general-inventory-issue:post',
  cancel: 'general-inventory-issue:cancel',
  reverse: 'general-inventory-issue:reverse',
  // Requester vs warehouse separation of duties.
  submit: 'general-inventory-issue:submit',
  withdraw: 'general-inventory-issue:withdraw',
  approve: 'general-inventory-issue:approve',
  reject: 'general-inventory-issue:reject',
  cancelApproval: 'general-inventory-issue:cancel-approval',
} as const;

export const GENERAL_INVENTORY_ISSUE_INCLUDE = {
  issueWarehouse: { select: { id: true, code: true, name: true } },
  movement: {
    select: {
      id: true,
      movementNumber: true,
      movementType: true,
      status: true,
      lines: { select: { productId: true, quantity: true, unit: true, productUomId: true } },
    },
  },
  reversesIssue: { select: { id: true, issueNumber: true, status: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true, uoms: { where: { isActive: true }, include: { unit: true } } } },
      warehouseLocation: { select: { id: true, code: true, name: true } },
    },
  },
} as const;
