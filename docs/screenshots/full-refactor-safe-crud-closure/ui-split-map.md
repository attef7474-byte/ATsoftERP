# Admin UI split map

## Compatibility contract

- Existing imports from `@/components/admin/ui` and current relative equivalents remain unchanged.
- `apps/web/src/components/admin/ui.tsx` remains the compatibility entry point and explicitly re-exports `./ui/index` to avoid file-versus-directory self-resolution.
- The compatibility wrapper, the directory barrel, and every component module retain the `'use client'` boundary.
- Component markup, class names, default labels, props, loading behavior, and event handlers are unchanged.
- Component modules do not import from the barrel. This prevents circular barrel dependencies.

## Old component to new file mapping

| New file | Exported components |
| --- | --- |
| `ui/button.tsx` | `Button` |
| `ui/input.tsx` | `Input` |
| `ui/select.tsx` | `Select` |
| `ui/textarea.tsx` | `Textarea` |
| `ui/card.tsx` | `Card`, `CardHeader`, `CardContent` |
| `ui/data-table.tsx` | `DataTable` |
| `ui/pagination.tsx` | `Pagination` |
| `ui/status-badge.tsx` | `StatusBadge` |
| `ui/loading-state.tsx` | `LoadingState` |
| `ui/empty-state.tsx` | `EmptyState` |
| `ui/error-state.tsx` | `ErrorState` |
| `ui/page-header.tsx` | `PageHeader` |
| `ui/toolbar.tsx` | `Toolbar` |
| `ui/modal.tsx` | `Modal` |
| `ui/toast.tsx` | `Toast` |
| `ui/confirm-dialog.tsx` | `ConfirmDialog` |
| `ui/alert-banner.tsx` | `AlertBanner` |

`DataTable` was part of the original public `ui.tsx` surface and therefore has its own file even though the initial target-file list omitted it.

## Barrel layout

`ui/index.ts` re-exports all 17 component modules and their 19 existing component exports. The original `ui.tsx` now contains only:

```tsx
'use client';

export * from './ui/index';
```

No consumer import migration is required in this phase. Validation is intentionally deferred until all seven refactor phases are complete.
