export const PRODUCTION_ORDER_AUDIT_ENTITY = 'ProductionOrder';
export const PRODUCTION_ORDER_ATTACHMENT_ENTITY = 'ProductionOrder';
export const PRODUCTION_ORDER_NUMBER_SEQUENCE = 'PRODUCTION_ORDER';

export const PRODUCTION_ORDER_STATUSES = ['DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED', 'ARCHIVED'] as const;
export const PRODUCTION_ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const PRODUCTION_ORDER_SOURCE_TYPES = ['MANUAL', 'REPLENISHMENT', 'FORECAST', 'OTHER'] as const;
export const PRODUCTION_ORDER_EDITABLE_STATUSES = ['DRAFT', 'PLANNED'] as const;
export const PRODUCTION_ORDER_CANCELLABLE_STATUSES = ['DRAFT', 'PLANNED', 'RELEASED'] as const;
export const PRODUCTION_ORDER_ARCHIVABLE_STATUSES = ['DRAFT', 'PLANNED', 'CANCELLED'] as const;

export const PRODUCTION_ORDER_PERMISSION_KEYS = [
  'production-order:read',
  'production-order:create',
  'production-order:update',
  'production-order:delete',
  'production-order:recalculate',
  'production-order:plan',
  'production-order:readiness',
  'production-order:release',
  'production-order:cancel',
  'production-order:archive',
  'production-order:attach',
] as const;
