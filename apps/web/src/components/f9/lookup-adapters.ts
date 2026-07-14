import { LookupAdapter } from './types';
import type { Company, Branch, Department, Warehouse, ProductCategory, Product, MachineCategory, Machine, User, Role } from '../../lib/admin-types';

export const companyAdapter: LookupAdapter<Company> = {
  endpoint: '/companies',
  displayLabel: (c) => `[${c.code}] ${c.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (c) => c.status },
  ],
};

export const branchAdapter: LookupAdapter<Branch> = {
  endpoint: '/branches',
  displayLabel: (b) => `[${b.code}] ${b.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'company', header: 'Company', render: (b) => b.company?.name || '-' },
    { key: 'status', header: 'Status', render: (b) => b.status },
  ],
};

export const departmentAdapter: LookupAdapter<Department> = {
  endpoint: '/departments',
  displayLabel: (d) => `[${d.code}] ${d.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'company', header: 'Company', render: (d) => d.company?.name || '-' },
    { key: 'branch', header: 'Branch', render: (d) => d.branch?.name || '-' },
    { key: 'status', header: 'Status', render: (d) => d.status },
  ],
};

export const warehouseAdapter: LookupAdapter<Warehouse> = {
  endpoint: '/inventory/warehouses',
  displayLabel: (w) => `[${w.code}] ${w.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'company', header: 'Company', render: (w) => w.company?.name || '-' },
    { key: 'branch', header: 'Branch', render: (w) => w.branch?.name || '-' },
    { key: 'status', header: 'Status', render: (w) => w.status },
  ],
};

export const productCategoryAdapter: LookupAdapter<ProductCategory> = {
  endpoint: '/product-categories',
  displayLabel: (pc) => `[${pc.code}] ${pc.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (pc) => pc.status },
  ],
};

export const productAdapter: LookupAdapter<Product> = {
  endpoint: '/products',
  displayLabel: (p) => `[${p.code}] ${p.name}`,
  searchFields: ['code', 'name', 'barcode'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category', render: (p) => p.category?.name || '-' },
    { key: 'unit', header: 'Unit' },
    { key: 'status', header: 'Status', render: (p) => p.status },
  ],
};

export const machineCategoryAdapter: LookupAdapter<MachineCategory> = {
  endpoint: '/maintenance/machine-categories',
  displayLabel: (mc) => `[${mc.code}] ${mc.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (mc) => mc.status },
  ],
};

export const machineAdapter: LookupAdapter<Machine> = {
  endpoint: '/maintenance/machines',
  displayLabel: (m) => `[${m.code}] ${m.name}`,
  searchFields: ['code', 'name', 'serialNumber'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category', render: (m) => m.category?.name || '-' },
    { key: 'model', header: 'Model', render: (m) => m.model || '-' },
    { key: 'status', header: 'Status', render: (m) => m.status },
  ],
};

export const userAdapter: LookupAdapter<User> = {
  endpoint: '/users',
  displayLabel: (u) => `${u.name} (${u.email})`,
  searchFields: ['name', 'email'],
  columns: [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'status', header: 'Status', render: (u) => u.status },
  ],
};

export const roleAdapter: LookupAdapter<Role> = {
  endpoint: '/roles',
  displayLabel: (r) => `[${r.code}] ${r.name}`,
  searchFields: ['code', 'name'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status', render: (r) => r.status },
  ],
};
