import {
  ActiveOperationalContext,
  OperationalContextSelection,
} from './operational-context.types';

export function buildOperationalContextWhere(
  context: ActiveOperationalContext,
): OperationalContextSelection {
  return {
    companyId: context.companyId,
    branchId: context.branchId,
    ...(context.administrationId
      ? { administrationId: context.administrationId }
      : {}),
    ...(context.departmentId ? { departmentId: context.departmentId } : {}),
  };
}

export function withOperationalContext<T extends Record<string, unknown>>(
  data: T,
  context: ActiveOperationalContext,
): T & { companyId: string; branchId: string } {
  return {
    ...data,
    companyId: context.companyId,
    branchId: context.branchId,
  };
}
