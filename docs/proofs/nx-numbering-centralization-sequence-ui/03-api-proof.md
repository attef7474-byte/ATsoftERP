# API Proof

## Endpoint Verification

### Numbering Controller Endpoints
| Endpoint | Method | Permission | Notes |
|----------|--------|-----------|-------|
| `/numbering` | GET | `numbering:read` | Lists sequences, supports search + filter |
| `/numbering` | POST | `numbering:create` | Create new sequence |
| `/numbering/:id` | GET | `numbering:read` | Get by ID |
| `/numbering/:id/preview` | GET | `numbering:read` | Preview without consuming number |
| `/numbering/code/:code` | GET | `numbering:read` | Get by code |
| `/numbering/:id` | PATCH | `numbering:update` | Update editable fields |
| `/numbering/generate` | POST | `numbering:generate` | Generate next number (returns object) |

### Service Hardening
- `generateNumberAtomic()` returns a plain `string` (the generated code)
- Both `generateNumber()` and `generateNumberAtomic()` now check `seq.status !== 'ACTIVE'` and throw `BadRequestException` with key `numbering.sequenceInactive`
- i18n message keys exist for both `numbering.sequenceNotFound` and `numbering.sequenceInactive`

## Sequence Inactive Check

The following error flow is now enforced:

```
POST /numbering/generate  { code: "SOME_CODE" }
  → if sequence not found: 404 { messageKey: "numbering.sequenceNotFound" }
  → if sequence not ACTIVE: 400 { messageKey: "numbering.sequenceInactive" }
  → otherwise: 200 { number, sequence, currentNumber }
```

## Static Analysis: No Remaining Bypasses

`grep` for `numberSequence` across all `*.service.ts` files outside `numbering/` module returned **zero matches**. Every `numberSequence` access is now inside `numbering.service.ts`.
