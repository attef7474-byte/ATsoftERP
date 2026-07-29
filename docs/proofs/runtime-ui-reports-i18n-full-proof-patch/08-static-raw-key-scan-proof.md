# 08 — Static Raw-Key Scan Proof

## Scans

| Pattern | Result |
|---|---|
| `page=0` and zero page assignments in active web source | 0 |
| Literal `property page should not exist` | 0 |
| Uppercase `REPORTS.*`, `COMMON.*`, `STATUS.*` calls | 0 |
| Forbidden module admin links | 0 |
| Mock/fake/placeholder-page markers in the changed scope | 0 |
| Missing keys in the exact 21 required routes and modified report scope | 0 |
| EN/AR key parity | 3351 = 3351 |

Seven `data.map` occurrences remain across the broad active source scan; they are page-local mappings with controlled array state, not reusable table assumptions. The two reusable grid components are defensively normalized.

A repository-wide heuristic scanner reports legacy namespace false positives because locale modules are merged through the runtime index and because some providers prepend namespaces. Per the task rule, literal `t('...')` occurrences are not failures by themselves. Acceptance therefore uses the authoritative parity checker plus real visible-DOM detection. The browser scan found zero visible raw keys over 36 routes.
