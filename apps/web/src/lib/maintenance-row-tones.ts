import type { GridRowTone } from '../components/admin/datagrid/types';
import type { DowntimeLog } from './admin-types/maintenance';

export function maintenanceRequestRowTone(record: { status: string }): GridRowTone {
  if (record.status === 'OPEN') return 'attention';
  if (record.status === 'IN_PROGRESS') return 'in-progress';
  return 'normal';
}

export function maintenanceWorkOrderRowTone(record: { status: string }): GridRowTone {
  if (record.status === 'DRAFT' || record.status === 'PLANNED') return 'attention';
  if (record.status === 'IN_PROGRESS') return 'in-progress';
  return 'normal';
}

export function downtimeRowTone(record: Pick<DowntimeLog,
  'status' | 'endTime' | 'cancelledAt' | 'repairStartedAt' | 'repairCompletedAt' | 'execution' | 'request'
>): GridRowTone {
  if (record.cancelledAt || record.endTime || record.repairCompletedAt
    || ['CLOSED', 'COMPLETED', 'CANCELLED'].includes(record.status ?? '')) return 'normal';
  const execution = record.execution;
  if (execution?.completedAt || execution?.status === 'DONE') return 'normal';
  if (record.repairStartedAt) return 'in-progress';
  // A pending execution without startedAt, or a cancelled execution, is not
  // evidence of repair. Stop startTime and first-response time never participate.
  if (execution) {
    return execution.status === 'IN_PROGRESS' || execution.status !== 'CANCELLED' && !!execution.startedAt
      ? 'in-progress' : 'attention';
  }
  // Legacy request start is the canonical repair start when no execution is linked.
  if (record.request?.status === 'COMPLETED' || record.request?.status === 'CLOSED') return 'normal';
  return record.request?.status === 'IN_PROGRESS' ? 'in-progress' : 'attention';
}
