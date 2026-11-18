export const SPARE_PART_ISSUE_AUDIT_ENTITY = 'SparePartIssue';

/**
 * Canonical standalone spare-part OUT authority. It is independent of any
 * MaintenanceRequest / ProductionOrder so a real spare part can be issued
 * without fabricating unrelated domain records. InventoryMovement remains the
 * sole physical stock posting authority; posting always goes through
 * InventoryMovementsService.postMovementWithinTransaction (one ledger effect).
 */
export const SPARE_PART_ISSUE_SOURCE_TYPE = 'SPARE_PART_ISSUE';

export const SPARE_PART_ISSUE_MOVEMENT_TYPE = 'SPARE_PART_ISSUE';

/**
 * Request lifecycle: DRAFT -> SUBMITTED -> APPROVED -> POSTED. The requester
 * may withdraw a SUBMITTED request back to DRAFT; the warehouse may reject it
 * (terminal) or cancel a prior approval (back to SUBMITTED). POSTED is
 * immutable. The exact permission family below is seeded by
 * `seed-production-inventory-document-permission-keys.ts`, which imports this
 * symbol directly.
 */
export const SPARE_PART_ISSUE_PERMISSION_KEYS = {
  create: 'spare-part-issue:create',
  read: 'spare-part-issue:read',
  update: 'spare-part-issue:update',
  delete: 'spare-part-issue:delete',
  post: 'spare-part-issue:post',
  cancel: 'spare-part-issue:cancel',
  submit: 'spare-part-issue:submit',
  withdraw: 'spare-part-issue:withdraw',
  approve: 'spare-part-issue:approve',
  reject: 'spare-part-issue:reject',
  cancelApproval: 'spare-part-issue:cancel-approval',
} as const;

export const SPARE_PART_ISSUE_INCLUDE = {
  issueWarehouse: { select: { id: true, code: true, name: true, warehouseType: true } },
  movement: {
    select: {
      id: true,
      movementNumber: true,
      movementType: true,
      status: true,
      lines: {
        select: {
          productId: true,
          quantity: true,
          quantityBase: true,
          unit: true,
          productUomId: true,
          warehouseLocationId: true,
          batchNumber: true,
          serialNumber: true,
          direction: true,
        },
      },
    },
  },
  lines: {
    include: {
      sparePart: { select: { id: true, code: true, name: true, unit: true, status: true, productId: true } },
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          uoms: { where: { isActive: true }, include: { unit: true } },
        },
      },
      warehouseLocation: { select: { id: true, code: true, name: true } },
    },
  },
} as const;
