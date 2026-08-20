export const ORDER_STATUSES = ['DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'CLOSED', 'ARCHIVED'];
export const ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const ORDER_EDITABLE_STATUSES = ['DRAFT', 'PLANNED'];
export const ORDER_CANCELLABLE_STATUSES = ['DRAFT', 'PLANNED', 'RELEASED'];
export const ORDER_ARCHIVABLE_STATUSES = ['DRAFT', 'PLANNED', 'CANCELLED'];
export const ORDER_CLOSEABLE_STATUSES = ['COMPLETED'];
export const ORDER_REOPENABLE_STATUSES = ['CLOSED'];

export function statusLabelKey(value: string): string {
  switch (value) {
    case 'DRAFT': return 'status.DRAFT';
    case 'PLANNED': return 'status.PLANNED';
    case 'RELEASED': return 'status.RELEASED';
    case 'IN_PROGRESS': return 'status.IN_PROGRESS';
    case 'COMPLETED': return 'status.COMPLETED';
    case 'CANCELLED': return 'status.CANCELLED';
    case 'CLOSED': return 'status.CLOSED';
    default: return 'status.ARCHIVED';
  }
}

export function priorityLabelKey(value: string): string {
  switch (value) {
    case 'LOW': return 'status.LOW';
    case 'HIGH': return 'status.HIGH';
    case 'URGENT': return 'status.URGENT';
    default: return 'status.NORMAL';
  }
}