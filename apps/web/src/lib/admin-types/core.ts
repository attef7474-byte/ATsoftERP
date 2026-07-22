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
