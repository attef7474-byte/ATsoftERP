# Defect Register

| ID | Description | Root Cause | Fix | Status |
|----|-------------|------------|-----|--------|
| EFP-001 | Inline edit modals use grid list data instead of detail fetch | No detail API call before opening edit form | Added async detail fetch (GET /:id) with loading state | Fixed |
| EFP-002 | Separate edit pages access res.field instead of res.data.field | Response response interceptor wraps in { success: true, data: Entity } but code accessed top-level fields | Changed to access res.data then entity fields | Fixed |

## Open Items
- Browser proof screenshots: Not captured (requires running dev servers)
- Edge case: if detail endpoint itself fails, error toast shown + modal closed (intentional safeguard)
