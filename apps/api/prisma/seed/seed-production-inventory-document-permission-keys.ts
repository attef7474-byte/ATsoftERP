import { GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS } from '../../src/modules/factory/general-inventory-issues/general-inventory-issues.constants';
import { SPARE_PART_ISSUE_PERMISSION_KEYS } from '../../src/modules/factory/spare-part-issues/spare-part-issues.constants';

export const PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS = [
  'production-material-document:create',
  'production-material-document:read',
  'production-material-document:update',
  'production-material-document:delete',
  'production-material-document:post',
  'production-material-document:cancel',
  'production-material-document:reverse',
  // Unified Issue Requests & Warehouse Approvals lifecycle.
  'production-material-document:submit',
  'production-material-document:withdraw',
  'production-material-document:approve',
  'production-material-document:reject',
  'production-material-document:cancel-approval',
] as const;

export const FINISHED_GOODS_ISSUE_PERMISSION_KEYS = [
  'finished-goods-issue:create',
  'finished-goods-issue:read',
  'finished-goods-issue:update',
  'finished-goods-issue:delete',
  'finished-goods-issue:post',
  'finished-goods-issue:cancel',
  'finished-goods-issue:reverse',
  'finished-goods-issue:submit',
  'finished-goods-issue:withdraw',
  'finished-goods-issue:approve',
  'finished-goods-issue:reject',
  'finished-goods-issue:cancel-approval',
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

// The module constants export may be a keyed record or a flat array; Object.values
// accepts both and keeps the seed tied to the single canonical permission family.
export const SPARE_PART_ISSUE_DOCUMENT_PERMISSION_KEYS: readonly string[] = Object.values(SPARE_PART_ISSUE_PERMISSION_KEYS);

export const GENERAL_INVENTORY_ISSUE_DOCUMENT_PERMISSIONS: readonly string[] = Object.values(GENERAL_INVENTORY_ISSUE_PERMISSION_KEYS);

export const PRODUCTION_INVENTORY_DOCUMENT_PERMISSIONS = [
  ...PRODUCTION_MATERIAL_DOCUMENT_PERMISSION_KEYS,
  ...PRODUCTION_FG_RECEIPT_PERMISSION_KEYS,
  ...FINISHED_GOODS_ISSUE_PERMISSION_KEYS,
  ...SPARE_PART_ISSUE_DOCUMENT_PERMISSION_KEYS,
  ...GENERAL_INVENTORY_ISSUE_DOCUMENT_PERMISSIONS,
  ...PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS,
  ...PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS,
  ...PRODUCTION_TRACEABILITY_PERMISSION_KEYS,
].map((key) => ({
  key,
  module: key.split(':')[0],
  action: key.split(':')[1],
}));
