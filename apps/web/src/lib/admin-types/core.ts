export interface Company {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  taxNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { branches: number; departments: number; users: number; warehouses: number; machines: number };
}

export interface Branch {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string; code: string };
}

export interface Administration {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string; company?: { id: string; name: string; code: string } };
  _count?: { departments: number };
}

export interface Department {
  id: string;
  companyId: string;
  branchId?: string | null;
  administrationId?: string | null;
  parentId?: string | null;
  code: string;
  name: string;
  classification?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  administration?: { id: string; name: string };
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { children: number; users: number; machines: number; personAssignments?: number };
}

export interface JobTitle {
  id: string;
  companyId: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  category?: string;
  description?: string | null;
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string; code: string };
  _count?: { assignments: number };
}

export interface OperationalPersonAssignment {
  id: string;
  companyId: string;
  branchId?: string | null;
  administrationId?: string | null;
  departmentId: string;
  jobTitleId?: string | null;
  personnelId: string;
  assignmentType: string;
  leadershipLevel: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  notes?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  administration?: { id: string; name: string };
  department?: { id: string; name: string; code: string };
  jobTitle?: { id: string; name: string; code: string };
  person?: { id: string; name: string; code: string };
}

export interface SupervisorAssignment {
  id: string;
  companyId: string;
  assignmentId: string;
  supervisorAssignmentId?: string | null;
  relationshipType: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  assignment?: OperationalPersonAssignment;
  supervisorAssignment?: OperationalPersonAssignment;
}

export type EligibilityCode =
  | 'ELIGIBLE'
  | 'SELF'
  | 'OUTSIDE_ALLOWED_BRANCH_SCOPE'
  | 'ALREADY_ON_THIS_TEAM'
  | 'HAS_OTHER_DIRECT_SUPERVISOR'
  | 'DATE_WINDOW_CONFLICT'
  | 'DIRECT_OVERLAP'
  | 'CYCLE_DETECTED'
  | 'MISSING';

export interface TeamMember {
  assignmentId: string;
  person: { id: string; name: string; code: string };
  department: { id: string; name: string; code: string } | null;
  jobTitle: { id: string; name: string; code: string } | null;
  branch: { id: string; name: string; code: string } | null;
  administration: { id: string; name: string; code: string } | null;
  assignmentType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface TeamResponse {
  supervisor: {
    id: string;
    name: string;
    code: string;
    department: { id: string; name: string; code: string } | null;
    jobTitle: { id: string; name: string; code: string } | null;
    branch: { id: string; name: string; code: string } | null;
  };
  team: TeamMember[];
  teamCount: number;
  asOf: string;
}

export interface CandidateRow {
  id: string;
  personnelId: string;
  branchId: string | null;
  departmentId: string | null;
  jobTitleId: string | null;
  administrationId: string | null;
  assignmentType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  person: { id: string; name: string; code: string };
  department: { id: string; name: string; code: string } | null;
  jobTitle: { id: string; name: string; code: string } | null;
  branch: { id: string; name: string; code: string } | null;
  administration: { id: string; name: string; code: string } | null;
  status: EligibilityCode;
  reasonCode: EligibilityCode;
  currentDirectSupervisor: { id: string; person?: { id: string; name: string; code: string } } | null;
}

export interface CandidateResponse {
  data: CandidateRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  supervisor: {
    assignmentId: string;
    person: { id: string; name: string; code: string };
    branch: { id: string; name: string; code: string } | null;
  };
}

export interface PreviewRow {
  assignmentId: string;
  person: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  jobTitle: { id: string; name: string; code: string } | null;
  branch: { id: string; name: string; code: string } | null;
  assignmentType: string | null;
  status: EligibilityCode;
  reasonCode: EligibilityCode;
  currentSupervisor?: { id: string };
}

export interface PreviewResponse {
  summary: {
    requested: number;
    eligible: number;
    alreadyAssigned: number;
    conflicts: number;
    invalid: number;
  };
  rows: PreviewRow[];
}

export interface BulkApplyResponse {
  created: Array<{
    id: string;
    assignmentId: string;
    supervisorAssignmentId: string;
    relationshipType: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;
  count: number;
}

export interface OrganizationalUnit {
  id: string;
  companyId: string;
  branchId: string;
  parentId?: string | null;
  code: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { children: number };
}
