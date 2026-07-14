export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

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

export interface Department {
  id: string;
  companyId: string;
  branchId?: string | null;
  parentId?: string | null;
  code: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { children: number; users: number; machines: number };
}

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

export interface Warehouse {
  id: string;
  companyId: string;
  branchId?: string | null;
  code: string;
  name: string;
  location?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  locations?: WarehouseLocation[];
  _count?: { locations: number; balances: number };
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  barcode?: string | null;
  status: string;
}

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { children: number; products: number };
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  unit: string;
  barcode?: string | null;
  qrCode?: string | null;
  image?: string | null;
  minStock: number;
  maxStock: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; code: string };
}

export interface MachineCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { machines: number };
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  categoryId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  purchaseDate?: string | null;
  warrantyEnd?: string | null;
  location?: string | null;
  status: string;
  qrCode?: string | null;
  image?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; code: string };
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  department?: { id: string; name: string };
}
