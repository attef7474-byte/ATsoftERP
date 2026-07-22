# Phase 1 - Safe CRUD report

## Shared foundation

- `apps/web/src/lib/form-utils.ts`
  - Normalizes raw, wrapped, nested, and paginated API responses through
    `unwrapApiData` and `unwrapApiList`.
  - Provides safe string, number, boolean, and date-input conversion.
  - Provides top-level read-only field stripping without treating business
    `code` fields as globally read-only.
  - Provides record-ID assertion, non-empty ID checking, recursive form-value
    normalization, and safe error-message extraction.
- `apps/web/src/hooks/useCrudList.ts`
  - Owns list loading/error/meta state and safe refresh behavior.
  - Owns create, edit, view/detail, and delete-confirm state.
  - Tracks `detailLoading`, `detailReady`, `saving`, and `deleting` separately.
  - Always loads the full detail before mapping an edit form. A failed detail
    request closes the edit/view state, reports an error, and never exposes an
    editable blank form.
  - Blocks update while detail loading or before detail readiness.
  - Keeps form input open after failed create/update and reports success only
    after the mutation resolves.
  - Requires every caller to provide an explicit payload mapper. This avoids
    PATCHing partial list rows, relationships, audit fields, or unrelated
    properties.
  - Refreshes the last successful list query after create/update/delete.

## Pages migrated to `useCrudList`

| Page | Hook coverage | Payload safety |
| --- | --- | --- |
| Companies | list, create, detail-before-edit, update, delete | Explicit editable company fields only |
| Branches | list, create, detail-before-edit, update | Explicit editable branch fields only |
| Departments | list, create, detail-before-edit, update | Explicit editable fields; optional branch/parent retained with the prior request contract |

The existing routed View actions remain routed detail pages; the hook's view
state is available for future modal-based pages without changing current UX.
Activation/deactivation remains page-specific because those operations have a
separate confirmation and status contract.

## Pages using shared helpers only

| Page | Helpers used | Reason the hook was not imposed |
| --- | --- | --- |
| Users | list/detail unwrapping | Password creation, role assignment, and access relationships need a dedicated typed migration |
| Roles | list/permission-list unwrapping | System-role protections and the separate permission editor are a multi-operation flow |
| Number Sequences | list/detail/preview unwrapping and safe form conversion | Specialized edit-only preview/reset behavior; this is the ERP reference page and was intentionally kept structurally unchanged |
| Notification Rules | list/detail unwrapping and safe form conversion | Custom total shape plus activate/deactivate/delete endpoints; row status actions were corrected to use the clicked ID directly |
| Warehouses | list/detail unwrapping and safe form conversion | Location and hierarchy behavior should be migrated together in a later focused pass |
| Products | list unwrapping | Create/edit/view use routed pages and product-specific payload rules |
| Machines | list unwrapping | Machine lifecycle and related asset actions are not generic CRUD |
| Maintenance Requests | list unwrapping | Workflow state transitions and routed create/edit must remain page-specific |
| Inventory Counts | list unwrapping | Permission checks, counting workflow, lines, and adjustment generation are page-specific |
| Barcode Records | paginated list unwrapping | Read-only record browsing; no generic create/edit/delete modal exists |

## Edit and response safety

- Migrated edit forms never use list rows as form data; `GET /:id` must succeed
  before editable controls are available.
- Wrapped and unwrapped entity/list responses are accepted without changing the
  global API client or registering an interceptor.
- Explicit payload mappers preserve unrelated persisted fields by sending only
  fields owned by each form.
- No fake success path, mock data, local business storage, schema change, API
  route change, permission change, or rejected-domain activation was added.

## Deferred verification

Per the ordered refactor contract, build, typecheck, i18n, Prisma, health,
smoke, runtime, and browser verification were not run during Phase 1. They are
deferred until all seven phases and global import cleanup are complete.
