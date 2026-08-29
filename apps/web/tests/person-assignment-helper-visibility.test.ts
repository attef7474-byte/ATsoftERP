import {
  LEADERSHIP_REQUIRES_DEPARTMENT,
  requiresDepartmentForLeadership,
  shouldShowLeadershipDepartmentHelper,
} from '../src/lib/person-assignment-leadership';

describe('person-assignment leadership department helper visibility', () => {
  it('A: SUPERVISOR with empty departmentId shows the helper', () => {
    expect(shouldShowLeadershipDepartmentHelper('SUPERVISOR', '')).toBe(true);
  });

  it('B: SUPERVISOR with a present departmentId hides the helper', () => {
    expect(shouldShowLeadershipDepartmentHelper('SUPERVISOR', 'dept-1')).toBe(false);
  });

  it('C: TEAM_LEAD with a present departmentId hides the helper', () => {
    expect(shouldShowLeadershipDepartmentHelper('TEAM_LEAD', 'dept-1')).toBe(false);
  });

  it('D: DEPARTMENT_HEAD with a present departmentId hides the helper', () => {
    expect(shouldShowLeadershipDepartmentHelper('DEPARTMENT_HEAD', 'dept-1')).toBe(false);
  });

  it('E: ADMINISTRATION_MANAGER is not a department-requiring level and never shows the department helper', () => {
    expect(requiresDepartmentForLeadership('ADMINISTRATION_MANAGER')).toBe(false);
    expect(shouldShowLeadershipDepartmentHelper('ADMINISTRATION_MANAGER', '')).toBe(false);
    expect(shouldShowLeadershipDepartmentHelper('ADMINISTRATION_MANAGER', 'dept-1')).toBe(false);
    expect(LEADERSHIP_REQUIRES_DEPARTMENT).toEqual(['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD']);
  });

  it('F: leadership NONE never shows the helper', () => {
    expect(shouldShowLeadershipDepartmentHelper('NONE', '')).toBe(false);
    expect(shouldShowLeadershipDepartmentHelper('NONE', 'dept-1')).toBe(false);
  });

  it('handles empty/unknown leadershipLevel defensively without showing the helper', () => {
    expect(shouldShowLeadershipDepartmentHelper('', '')).toBe(false);
    expect(shouldShowLeadershipDepartmentHelper(undefined, '')).toBe(false);
    expect(shouldShowLeadershipDepartmentHelper('UNKNOWN', '')).toBe(false);
  });
});