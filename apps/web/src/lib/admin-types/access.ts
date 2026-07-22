export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  status: string;
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roles?: UserRole[];
}

export interface UserRole {
  role: { id: string; code: string; name: string };
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  permissions?: RolePermission[];
  _count?: { users: number };
}

export interface RolePermission {
  permission: Permission;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  description?: string | null;
  status: string;
}
