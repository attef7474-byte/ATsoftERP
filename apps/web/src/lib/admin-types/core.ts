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
