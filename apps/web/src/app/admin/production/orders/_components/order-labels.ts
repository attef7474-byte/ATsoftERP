export const ORDER_STATUSES = ['DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED', 'ARCHIVED'];
export const ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const ORDER_EDITABLE_STATUSES = ['DRAFT', 'PLANNED'];
export const ORDER_CANCELLABLE_STATUSES = ['DRAFT', 'PLANNED', 'RELEASED'];
export const ORDER_ARCHIVABLE_STATUSES = ['DRAFT', 'PLANNED', 'CANCELLED'];

export function statusLabelKey(value: string): string {
  switch (value) {
    case 'DRAFT': return 'common.status.DRAFT';
    case 'PLANNED': return 'common.status.PLANNED';
    case 'RELEASED': return 'common.status.RELEASED';
    case 'IN_PROGRESS': return 'common.status.IN_PROGRESS';
    case 'COMPLETED': return 'common.status.COMPLETED';
    case 'CANCELLED': return 'common.status.CANCELLED';
    case 'CLOSED': return 'common.status.CLOSED';
    default: return 'common.status.ARCHIVED';
  }
}

export function priorityLabelKey(value: string): string {
  switch (value) {
    case 'LOW': return 'common.status.LOW';
    case 'HIGH': return 'common.status.HIGH';
    case 'URGENT': return 'common.status.URGENT';
    default: return 'common.status.NORMAL';
  }
}