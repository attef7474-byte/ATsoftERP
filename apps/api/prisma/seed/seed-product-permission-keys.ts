export const PRODUCT_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // Product master (canonical inventory product surface).
  //
  // These keys are enforced by ProductsController and ProductCategoriesController and
  // consumed by the unified ProductsWorkspace and navigation, but the canonical seed only
  // ever declared the UNUSED singular `product:*` CRUD keys (from the MODULES x ACTIONS
  // matrix) plus `product-category:*`. That made every product route a permanently-denied
  // 403 for every non-SUPER_ADMIN role. Declared here so the guard keys are grantable.
  { key: 'products:create', module: 'products', action: 'create' },
  { key: 'products:read', module: 'products', action: 'read' },
  { key: 'products:update', module: 'products', action: 'update' },
  { key: 'products:delete', module: 'products', action: 'delete' },
];
