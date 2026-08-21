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

export interface HierarchyTreeNode {
  assignmentId: string;
  level: number;
  person: { id: string; name: string; code: string } | null;
  jobTitle: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  branch: { id: string; name: string; code: string } | null;
  administration: { id: string; name: string; code: string } | null;
  leadershipLevel: string;
  assignmentType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  childCount: number;
  children: HierarchyTreeNode[];
}

export interface HierarchyTreeResponse {
  root: HierarchyTreeNode;
  reportingLine: Array<{
    level: number;
    supervisor: { id: string; name: string; code: string } | null;
    department: { id: string; name: string; code: string } | null;
    jobTitle: { id: string; name: string; code: string } | null;
    relationshipType: string;
  }>;
  totalDescendants: number;
  maxDepth: number;
  truncated: boolean;
  asOf: string;
}

export interface HistorySupervisionRow {
  id: string;
  relationshipType: string;
  subordinate: {
    assignmentId: string;
    person: { id: string; name: string; code: string } | null;
    jobTitle: { id: string; name: string; code: string } | null;
    department: { id: string; name: string; code: string } | null;
    branch: { id: string; name: string; code: string } | null;
    administration: { id: string; name: string; code: string } | null;
    assignmentType: string;
  } | null;
  supervisor: {
    assignmentId: string;
    person: { id: string; name: string; code: string } | null;
    jobTitle: { id: string; name: string; code: string } | null;
    department: { id: string; name: string; code: string } | null;
    branch: { id: string; name: string; code: string } | null;
    administration: { id: string; name: string; code: string } | null;
    assignmentType: string;
  } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  status: string;
  temporalStatus: 'PAST' | 'CURRENT' | 'FUTURE';
  createdAt: string;
  updatedAt: string;
}

export interface HistoryLeadershipRow {
  id: string;
  person: { id: string; name: string; code: string } | null;
  personCode: string | null;
  leadershipLevel: string;
  assignmentType: string;
  jobTitle: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  branch: { id: string; name: string; code: string } | null;
  administration: { id: string; name: string; code: string } | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  status: string;
  temporalStatus: 'PAST' | 'CURRENT' | 'FUTURE';
  createdAt: string;
  updatedAt: string;
}

export interface HistoryResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HistoryFilters {
  personId?: string;
  assignmentId?: string;
  supervisorAssignmentId?: string;
  leadershipLevel?: string;
  assignmentType?: string;
  relationshipType?: string;
  branchId?: string;
  administrationId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

// HIER-G: Transfer Preview & Reconciliation Types

export type RelationshipResolutionAction = 'END_AT_TRANSFER' | 'CONTINUE_ON_NEW_ASSIGNMENT';
export type TemporalCategory = 'HISTORICAL' | 'CURRENT' | 'FUTURE';
export type RelationshipDirection = 'INBOUND' | 'OUTBOUND';

export interface AffectedRelationshipOtherParty {
  person?: { id: string; name: string; code: string } | null;
  jobTitle?: { id: string; name: string; code: string } | null;
  department?: { id: string; name: string; code: string } | null;
  branch?: { id: string; name: string } | null;
  administration?: { id: string; name: string } | null;
  leadershipLevel?: string;
  assignmentType?: string;
  assignmentId: string;
}

export interface AffectedRelationship {
  id: string;
  direction: RelationshipDirection;
  relationshipType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  temporalCategory: TemporalCategory;
  otherParty: AffectedRelationshipOtherParty;
  allowedResolutions: RelationshipResolutionAction[];
}

export interface TransferPreviewResponse {
  oldAssignment: {
    id: string;
    person?: { id: string; name: string; code: string } | null;
    department?: { id: string; name: string; code: string } | null;
    jobTitle?: { id: string; name: string; code: string } | null;
    branch?: { id: string; name: string } | null;
    administration?: { id: string; name: string } | null;
    assignmentType: string;
    leadershipLevel: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  proposedNewAssignment: {
    departmentId: string;
    branchId: string | null;
    administrationId: string | null;
    jobTitleId: string | null;
    assignmentType: string;
    leadershipLevel: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  transferDate: string;
  summary: {
    historicalUnaffected: number;
    currentInbound: number;
    currentOutbound: number;
    futureInbound: number;
    futureOutbound: number;
    directCount: number;
    matrixCount: number;
    functionalCount: number;
    totalAffected: number;
  };
  affectedRelationships: AffectedRelationship[];
}

export interface TransferApplyRequest {
  departmentId: string;
  branchId?: string;
  administrationId?: string;
  jobTitleId?: string;
  assignmentType?: string;
  leadershipLevel?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  relationshipResolutions?: Array<{
    relationshipId: string;
    action: RelationshipResolutionAction;
  }>;
}

export interface TransferApplyResponse {
  newAssignment: OperationalPersonAssignment;
  relationshipsEnded: number;
  relationshipsContinued: number;
}
