import type { OperationalPersonAssignment } from './admin-types/core';

export interface AssignmentFormData {
  personnelId: string;
  departmentId: string;
  jobTitleId?: string | null;
  assignmentType: string;
  leadershipLevel: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
}

export function getAssignmentBranchName(record: Pick<OperationalPersonAssignment, 'branch' | 'branchId'>): string | null {
  if (record.branch?.name) return record.branch.name;
  return null;
}

export function buildPersonAssignmentListParams(activeBranchId: string | null | undefined, extras?: { page?: number; limit?: number; search?: string }): Record<string, string | number | boolean | null | undefined> {
  const params: Record<string, string | number | boolean | null | undefined> = {
    page: extras?.page ?? undefined,
    limit: extras?.limit ?? undefined,
    search: extras?.search || undefined,
  };
  if (activeBranchId) params.branchId = activeBranchId;
  return params;
}

export function buildAssignmentUpdatePayload(form: AssignmentFormData): AssignmentFormData & { effectiveTo: string | null; jobTitleId: string | null } {
  return {
    personnelId: form.personnelId,
    departmentId: form.departmentId,
    jobTitleId: form.jobTitleId || null,
    assignmentType: form.assignmentType,
    leadershipLevel: form.leadershipLevel,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo || null,
    notes: form.notes || null,
  };
}
