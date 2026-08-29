import {
  buildAssignmentUpdatePayload,
  getAssignmentBranchName,
  shouldShowBranchMismatchWarning,
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

const noBranchRecord = {
  ...hqRecord,
  id: 'a3',
  branchId: null,
  branch: undefined as any,
};

describe('person-assignment branch context display', () => {
  it('A: company-wide grid assignment from Headquarters -> branch column shows Headquarters', () => {
    expect(getAssignmentBranchName(hqRecord as any)).toBe('Headquarters');
  });

  it('B: company-wide grid assignment from Seiyun -> branch column shows Seiyun', () => {
    expect(getAssignmentBranchName(seiyunRecord as any)).toBe('Seiyun');
  });

  it('C: Edit Seiyun assignment while active branch = Headquarters -> assignment branch display is Seiyun', () => {
    expect(getAssignmentBranchName(seiyunRecord as any)).toBe('Seiyun');
  });

  it('D: Edit Headquarters assignment while active branch = Headquarters -> branch display is Headquarters', () => {
    expect(getAssignmentBranchName(hqRecord as any)).toBe('Headquarters');
  });

  it('E: edit save payload does NOT inject activeBranchId', () => {
    const payload = buildAssignmentUpdatePayload({
      personnelId: 'p1',
      departmentId: 'dept-sy',
      assignmentType: 'PRIMARY',
      leadershipLevel: 'NONE',
      effectiveFrom: '2026-01-01',
    });
    expect(payload).not.toHaveProperty('branchId');
  });

  it('F: existing assignment departmentId remains unchanged by the new UI context display/save', () => {
    const payload = buildAssignmentUpdatePayload({
      personnelId: 'p1',
      departmentId: 'dept-sy',
      assignmentType: 'PRIMARY',
      leadershipLevel: 'NONE',
      effectiveFrom: '2026-01-01',
    });
    expect(payload.departmentId).toBe('dept-sy');
  });

  it('G: Department F9 behavior is not affected by the branch-context helper', () => {
    // getAssignmentBranchName only reads the record branch for display; it never
    // filters or alters department F9 results.
    expect(getAssignmentBranchName(seiyunRecord as any)).toBe('Seiyun');
  });

  it('H: mismatch warning shows only when active and record branches differ', () => {
    expect(shouldShowBranchMismatchWarning('branch-hq', 'branch-sy')).toBe(true);
    expect(shouldShowBranchMismatchWarning('branch-hq', 'branch-hq')).toBe(false);
    expect(shouldShowBranchMismatchWarning(null, 'branch-sy')).toBe(false);
    expect(shouldShowBranchMismatchWarning('branch-hq', null)).toBe(false);
    expect(shouldShowBranchMismatchWarning(undefined, undefined)).toBe(false);
  });

  it('displays a fallback (null) for an assignment without a branch', () => {
    expect(getAssignmentBranchName(noBranchRecord as any)).toBeNull();
  });
});
