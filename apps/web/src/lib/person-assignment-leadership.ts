export const LEADERSHIP_REQUIRES_DEPARTMENT = ['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD'] as const;

export function requiresDepartmentForLeadership(level: string | null | undefined): boolean {
  return (LEADERSHIP_REQUIRES_DEPARTMENT as readonly string[]).includes(level ?? '');
}

export function shouldShowLeadershipDepartmentHelper(
  leadershipLevel: string | null | undefined,
  departmentId: string | null | undefined,
): boolean {
  return requiresDepartmentForLeadership(leadershipLevel) && !departmentId;
}