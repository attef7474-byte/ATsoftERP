export const PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS = [
  'production-material-document:create',
  'production-material-document:read',
  'production-material-document:update',
  'production-material-document:delete',
  'production-material-document:post',
  'production-material-document:cancel',
  'production-material-document:reverse',
] as const;

export const PRODUCTION_FG_RECEIPT_PERMISSION_KEYS = [
  'production-finished-goods-receipt:create',
  'production-finished-goods-receipt:read',
  'production-finished-goods-receipt:update',
  'production-finished-goods-receipt:delete',
  'production-finished-goods-receipt:post',
  'production-finished-goods-receipt:cancel',
  'production-finished-goods-receipt:reverse',
] as const;

export const PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS = [
  'production-material-requirement:read',
  'production-material-requirement:prepare',
  'production-material-requirement:freeze',
  'production-material-requirement:cancel',
] as const;

export const PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS = [
  'production-material-consumption:read',
  'production-material-consumption:record',
  'production-material-consumption:correct',
  'production-material-consumption:history',
] as const;

export const PRODUCTION_TRACEABILITY_PERMISSION_KEYS = [
  'production-traceability:read',
] as const;

export const PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS = [
  ...PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS,
  ...PRODUCTION_FG_RECEIPT_PERMISSION_KEYS,
  ...PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS,
  ...PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS,
  ...PRODUCTION_TRACEABILITY_PERMISSION_KEYS,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
