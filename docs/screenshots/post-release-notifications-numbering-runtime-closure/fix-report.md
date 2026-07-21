# Fix Report

## Changed Files

### Backend — API
1. `apps/api/src/modules/notifications/notifications.controller.ts`
   - unreadCount now returns `{ count }` object
2. `apps/api/src/modules/numbering/numbering.module.ts`
   - Added @Global() decorator for universal DI access
3. `apps/api/src/modules/numbering/numbering.service.ts`
   - generateNumber and generateNumberAtomic wrapped in $transaction
4. `apps/api/src/modules/companies/dto/create-company.dto.ts`
   - code made optional (@IsOptional)
5. `apps/api/src/modules/companies/companies.service.ts`
   - Injected NumberingService; auto-generates code if absent
6. `apps/api/src/modules/admin/branches/dto/create-branch.dto.ts`
   - code made optional
7. `apps/api/src/modules/admin/branches/branches.service.ts`
   - Injected NumberingService; auto-generates code if absent
8. `apps/api/src/modules/admin/departments/dto/create-department.dto.ts`
   - code made optional
9. `apps/api/src/modules/admin/departments/departments.service.ts`
   - Injected NumberingService; auto-generates code if absent
10. `apps/api/src/modules/factory/inventory/dto/create-warehouse.dto.ts`
    - code made optional
11. `apps/api/src/modules/factory/inventory/dto/create-warehouse-location.dto.ts`
    - code made optional
12. `apps/api/src/modules/factory/inventory/inventory.service.ts`
    - Injected NumberingService; auto-generates for warehouse & location
13. `apps/api/src/modules/factory/products/dto/create-product.dto.ts`
    - code made optional
14. `apps/api/src/modules/factory/products/products.service.ts`
    - Injected NumberingService; auto-generates code if absent
15. `apps/api/src/modules/factory/maintenance/dto/maintenance.dto.ts`
    - CreateMachineDto.code and CreateMachinePartDto.code made optional
16. `apps/api/src/modules/factory/maintenance/maintenance.service.ts`
    - Injected NumberingService; auto-generates for machine & part

### Frontend — Web
17. `apps/web/src/app/admin/core/companies/page.tsx`
18. `apps/web/src/app/admin/core/branches/page.tsx`
19. `apps/web/src/app/admin/core/departments/page.tsx`
20. `apps/web/src/app/admin/inventory/warehouses/page.tsx`
21. `apps/web/src/app/admin/inventory/warehouses/new/page.tsx`
22. `apps/web/src/app/admin/inventory/products/new/page.tsx`
23. `apps/web/src/app/admin/inventory/locations/new/page.tsx`
24. `apps/web/src/app/admin/maintenance/machines/new/page.tsx`
25. `apps/web/src/app/admin/maintenance/machine-parts/new/page.tsx`
    - All: removed editable code field from create form, removed code validation
