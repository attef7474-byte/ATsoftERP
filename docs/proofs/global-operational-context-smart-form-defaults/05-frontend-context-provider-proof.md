# 05 — Frontend Context Provider Proof

## Architecture

1. **`lib/operational-context.ts`** (253 lines)
   - Types: `OperationalContext`, `OperationalContextIdentity`, `OperationalContextsResult`
   - Normalization: `normalizeOperationalContext()`, `normalizeOperationalContextsResponse()`
   - Storage: `setStoredOperationalContext()`, `getStoredOperationalContext()`, `clearStoredOperationalContext()` — localStorage persistence per-user
   - Comparison: `isSameOperationalContext()`, `findMatchingOperationalContext()`, `getOperationalContextKey()`
   - Headers: `getOperationalContextHeaders()` → `x-active-company-id`, `x-active-branch-id`, `x-active-administration-id`, `x-active-department-id`

2. **`lib/auth.ts`** (127 lines)
   - `login()`: clears stored context, saves token
   - `getProfile()`: fetches profile with `skipOperationalContext: true`
   - `getOperationalContexts()`: fetches `/auth/contexts`
   - `validateOperationalContext()`: posts to `/auth/context/validate`
   - `logout()`: clears token + stored context, redirects to `/login`

3. **`lib/api.ts`** (161 lines)
   - `getApiRequestHeaders()`: attaches JWT + operational context headers from localStorage
   - All HTTP methods (`get`, `post`, `patch`, `delete`, `put`) use `skipOperationalContext` option

4. **`lib/auth-context.tsx`** (376 lines)
   - `AuthProvider`: manages user, permissions, allowedContexts, activeContext
   - Bootstrap flow: token → profile + permissions → load contexts → resolve stored/fallback context → ready
   - `selectContext()`: validates context, persists, dispatches event, optionally reloads
   - `useOperationalContext()` / `useActiveContext()`: convenience hooks

## State Management

| State | Type | Description |
|-------|------|-------------|
| `allowedContexts` | `OperationalContext[]` | All available contexts for the user |
| `defaultContext` | `OperationalContext \| null` | Default context |
| `activeContext` | `OperationalContext \| null` | Currently active context |
| `contextLoading` | `boolean` | Loading state |
| `contextError` | `string \| null` | Error state |
| `contextVersion` | `number` | Incremented on context change (triggers F9 refresh) |
| `contextReady` | `boolean` | `!!user && !contextLoading && !!activeContext` |
| `contextSelectionRequired` | `boolean` | User authenticated but no active context |

## Context Resolution Order

1. Stored context (localStorage per userId)
2. Single context (auto-select)
3. Default context from API
4. Validation against backend
5. Fallback: clear storage, show selector

## Events

- `atsoft:operational-context-changed` dispatched on context switch
- Used by F9 components, notifications polling, and auto-refresh
