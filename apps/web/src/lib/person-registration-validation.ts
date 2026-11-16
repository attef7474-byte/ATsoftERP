import type { ApiFieldError } from './error-utils';

/** Registration DTO paths differ from the flat names used by the unified form. */
export const PERSON_REGISTRATION_FIELDS: Record<string, string> = {
  'placement.branchId': 'branchId',
  'placement.administrationId': 'administrationId',
  'placement.departmentId': 'departmentId',
  'placement.jobTitleId': 'jobTitleId',
  'placement.assignmentType': 'assignmentType',
  'placement.effectiveFrom': 'effectiveFrom',
  'placement.notes': 'assignmentNotes',
  'login.email': 'loginEmail',
  'login.password': 'loginPassword',
  password: 'loginPassword', // Credential-policy responses from older API builds.
  'login.roleIds': 'roleIds',
  'maintenance.role': 'maintenanceRole',
  'maintenance.specialty': 'maintenanceSpecialty',
  'maintenance.dailyCapacityMinutes': 'dailyCapacityMinutes',
  'maintenance.isActive': 'maintenanceIsActive',
};

export function personRegistrationErrors(errors: ApiFieldError[], fallback: string) {
  const fields: Record<string, string> = {};
  const messages: string[] = [];
  for (const error of errors) {
    const message = error.message || fallback;
    if (!messages.includes(message)) messages.push(message);
    if (error.field) {
      const field = PERSON_REGISTRATION_FIELDS[error.field] || error.field;
      if (!fields[field]) fields[field] = message;
      else if (!fields[field].includes(message)) fields[field] += ` ${message}`;
    }
  }
  // Always keep a summary, including errors without a field or without a matching control.
  return { fields, summary: messages.join(' ') || fallback };
}
