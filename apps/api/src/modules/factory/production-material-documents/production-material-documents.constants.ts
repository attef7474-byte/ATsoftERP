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
} as const;

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
  movement: { select: { id: true, movementNumber: true, movementType: true, status: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      substitutedProduct: { select: { id: true, code: true, name: true } },
      warehouseLocation: { select: { id: true, code: true, name: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
  postedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} as const;
