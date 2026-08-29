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

export function shouldShowBranchMismatchWarning(activeBranchId: string | null | undefined, recordBranchId: string | null | undefined): boolean {
  if (!activeBranchId || !recordBranchId) return false;
  return activeBranchId !== recordBranchId;
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
