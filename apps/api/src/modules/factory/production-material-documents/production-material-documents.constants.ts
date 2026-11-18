export const PRODUCTION_MATERIAL_DOCUMENT_AUDIT_ENTITY = 'ProductionMaterialDocument';

export const PRODUCTION_MATERIAL_DOCUMENT_TYPES = ['ISSUE', 'CONSUMPTION', 'RETURN', 'SUBSTITUTION'] as const;

export const PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS = {
  create: 'production-material-document:create',
  read: 'production-material-document:read',
  update: 'production-material-document:update',
  delete: 'production-material-document:delete',
  post: 'production-material-document:post',
  cancel: 'production-material-document:cancel',
  reverse: 'production-material-document:reverse',
  // Unified Issue Requests & Warehouse Approvals — raw-material issue requests
  // follow DRAFT -> SUBMITTED -> APPROVED -> POSTED. The requester submits and
  // withdraws; the warehouse (a separate actor) approves, rejects or cancels an
  // approval. Posting still uses the existing `post` permission.
  submit: 'production-material-document:submit',
  withdraw: 'production-material-document:withdraw',
  approve: 'production-material-document:approve',
  reject: 'production-material-document:reject',
  cancelApproval: 'production-material-document:cancel-approval',
} as const;

/**
 * Statuses a material document can be in. DRAFT/SUBMITTED are editable/withdrawable
 * by the requester; APPROVED is the only status that can be posted; POSTED is
 * immutable and can only be corrected through a reversal. REJECTED/CANCELLED are
 * terminal for the request lifecycle.
 */
export const PRODUCTION_MATERIAL_DOCUMENT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'POSTED',
  'CANCELLED',
] as const;

export const PRODUCTION_MATERIAL_DOCUMENT_INCLUDE = {
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  productionRun: {
    select: {
      id: true,
      runNumber: true,
      status: true,
      startedAt: true,
      endedAt: true,
    },
  },
  issueWarehouse: { select: { id: true, code: true, name: true } },
  movement: { select: { id: true, movementNumber: true, movementType: true, status: true, lines: { select: { productId: true, quantity: true, unit: true, productUomId: true } } } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true, uoms: { where: { isActive: true }, include: { unit: true } } } },
      substitutedProduct: { select: { id: true, code: true, name: true } },
      warehouseLocation: { select: { id: true, code: true, name: true } },
    },
  },
} as const;
