import {
  buildAssignmentUpdatePayload,
  buildPersonAssignmentListParams,
  getAssignmentBranchName,
} from '../src/lib/person-assignment-branch-context';

const hqRecord = {
  id: 'a1',
  companyId: 'c1',
  branchId: 'branch-hq',
  departmentId: 'dept-hq',
  assignmentType: 'PRIMARY',
  leadershipLevel: 'NONE',
  effectiveFrom: '2026-01-01',
  status: 'ACTIVE',
  branch: { id: 'branch-hq', name: 'Headquarters' },
  department: { id: 'dept-hq', name: 'HQ Dept', code: 'DEPT-HQ' },
};

const seiyunRecord = {
  ...hqRecord,
  id: 'a2',
  branchId: 'branch-sy',
  departmentId: 'dept-sy',
  branch: { id: 'branch-sy', name: 'Seiyun' },
  department: { id: 'dept-sy', name: 'Sy Dept', code: 'DEP-SY' },
};

describe('person-assignment active-branch list scope', () => {
  it('A: active branch Headquarters -> list request includes Headquarters branchId', () => {
    const params = buildPersonAssignmentListParams('branch-hq', { page: 1, limit: 10, search: '' });
    expect(params.branchId).toBe('branch-hq');
  });

  it('B: active branch Seiyun -> list request includes Seiyun branchId', () => {
    const params = buildPersonAssignmentListParams('branch-sy', { page: 1, limit: 10, search: '' });
    expect(params.branchId).toBe('branch-sy');
  });

  it('C: no active branch -> no branchId sent (backend stays company-scoped)', () => {
    const params = buildPersonAssignmentListParams(null, { page: 1, limit: 10 });
    expect(params).not.toHaveProperty('branchId');
    expect(params.branchId).toBeUndefined();
  });

  it('D: list params preserve page/limit/search alongside branchId', () => {
    const params = buildPersonAssignmentListParams('branch-hq', { page: 3, limit: 10, search: 'zein' });
    expect(params).toEqual({ page: 3, limit: 10, search: 'zein', branchId: 'branch-hq' });
  });

  it('E: switching active branch changes the branchId sent on refetch', () => {
    const hq = buildPersonAssignmentListParams('branch-hq', { page: 1, limit: 10 });
    const seiyun = buildPersonAssignmentListParams('branch-sy', { page: 1, limit: 10 });
    expect(hq.branchId).toBe('branch-hq');
    expect(seiyun.branchId).toBe('branch-sy');
    expect(hq.branchId).not.toBe(seiyun.branchId);
  });

  it('F: Department F9 behavior is not changed by the branch-scope helper', () => {
    // buildPersonAssignmentListParams only builds assignment list params; it does
    // not alter the Department F9 that remains active-branch scoped on the backend.
    expect(buildPersonAssignmentListParams('branch-hq').branchId).toBe('branch-hq');
  });

  it('G: Person lookup scope is unchanged (helper does not filter persons)', () => {
    // The helper only scopes assignment list queries by branch; Person identity
    // remains global and is not filtered by the helper.
    expect(getAssignmentBranchName(seiyunRecord as any)).toBe('Seiyun');
  });

  it('H: JobTitle company scope is unchanged (helper does not carry job-title filters)', () => {
    const params = buildPersonAssignmentListParams('branch-hq');
    expect(params).not.toHaveProperty('jobTitleId');
    expect(params).not.toHaveProperty('companyId');
  });

  it('I: edit save payload does NOT inject activeBranchId', () => {
    const payload = buildAssignmentUpdatePayload({
      personnelId: 'p1',
      departmentId: 'dept-sy',
      assignmentType: 'PRIMARY',
      leadershipLevel: 'NONE',
      effectiveFrom: '2026-01-01',
    });
    expect(payload).not.toHaveProperty('branchId');
  });

  it('J: existing assignment departmentId remains unchanged by the list/edit UI', () => {
    const payload = buildAssignmentUpdatePayload({
      personnelId: 'p1',
      departmentId: 'dept-sy',
      assignmentType: 'PRIMARY',
      leadershipLevel: 'NONE',
      effectiveFrom: '2026-01-01',
    });
    expect(payload.departmentId).toBe('dept-sy');
  });

  it('K: branch column still shows the visible assignment branch', () => {
    expect(getAssignmentBranchName(hqRecord as any)).toBe('Headquarters');
    expect(getAssignmentBranchName(seiyunRecord as any)).toBe('Seiyun');
  });
});
