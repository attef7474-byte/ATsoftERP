# ATsofterp Permanent Agent Rules Installation — Proof Report

## Status

**COMPLETED** — permanent engineering-instruction system installed and validated.

## 1. Initial Git State

| Item | Value |
|------|-------|
| Repository path | `C:\Users\attef\PycharmProjects\Trae\ATsofterp` |
| Branch | `main` |
| HEAD (full SHA) | `23f9c655b4eb63d9b61b007e8dd940837817d467` |
| Git status at start | `M AGENTS.md` (user's prior replacement, preserved), `?? docs/proofs/atsofterp-current-architecture-discovery-report.md` (untracked, untouched), `?? opencode.json` (untracked, merged), `?? proof-token.txt` (untracked secret artifact, untouched) |

## 2. Existing Instruction Files Discovered

| Path | State | Decision |
|------|-------|----------|
| `AGENTS.md` | Existed (27-section permanent instructions installed in the previous request) | Merged: added the missing "No Docker" line to Project Identity; preserved all 27 sections |
| `opencode.json` | Existed (untracked, permission config from the previous request) | Merged: kept safe allow-lists, changed dangerous commands from allow → deny/ask per new policy |
| `.opencode/` | Did not exist | Not created (no agents/commands/skills requested) |
| `docs/agent-rules/` | Did not exist | Created: 5 top-level rule files + 3 domain-rules files |
| `.github/` | Exists (CI workflows `ci.yml`, `docs-check.yml`) | Not modified |

## 3. Merge Decisions

### AGENTS.md

The existing 27-section text already covered nearly all mandatory principles (Project Identity, Existing-System Protection, Real Functionality, Minimum Data Entry, Flexible Architecture, Tenant Isolation, Database Safety, Backend/Security, Frontend/UX, Testing, Git Safety, Task Execution, Definition of Done, Detailed Rule Loading).

**Single change**: added `* No Docker for the approved current development baseline unless explicitly changed later.` to Section 1 Project Identity — the one mandatory principle that was missing (SQL Server-only baseline is otherwise implicit in the tech list).

No existing rule was removed, weakened, or rewritten.

### opencode.json

The existing config allowed destructive commands (from the previous request). Per the new permanent policy:

| Command group | Before | After |
|---------------|--------|-------|
| Read-only Git (`status`, `diff`, `log`, `show`, `branch --show-current`, `rev-parse`, `ls-files`) | allow | allow (kept) |
| Search/read (`rg`, `grep`, `Get-Content`, `Get-ChildItem`, `Select-String`) | allow | allow (kept) |
| `npm run build/typecheck/test/i18n`, `npx prisma validate` | allow | allow (kept) |
| `read` of non-secret files; `*.env.example` | allow | allow (kept) |
| `read` of `*.env`, `*.env.*` (secrets) | deny | deny (kept) |
| `glob`, `grep`, `lsp`, `external_directory` | allow/deny | kept unchanged |
| `npx prisma migrate reset*`, `npx prisma db push*` | allow | **deny** |
| `git reset --hard*`, `git clean*` | allow | **deny** |
| `git push --force*`, `git push -f*` | allow | **deny** |
| `rm -rf *`, `rmdir /s *`, `Remove-Item *-Recurse*-Force*` | allow | **deny** |
| `npx prisma generate/migrate dev/migrate deploy`, `npm install/update`, `git commit/push` | allow | **ask** (user approval required) |
| `bash` default (`"*"`) | allow | **ask** |
| `edit` | allow | allow (kept — task-scope discipline enforced by AGENTS.md Section 5 Scope Control) |

Note: per opencode permission semantics, deny rules are ordered after the broader allow/ask patterns so the last matching rule (deny) wins for force-push/reset/clean patterns.

## 4. Files Created

```
docs/agent-rules/architecture-and-tenancy.md      (5,371 bytes)
docs/agent-rules/database-and-migrations.md       (4,117 bytes)
docs/agent-rules/backend-and-security.md          (4,200 bytes)
docs/agent-rules/frontend-and-ux.md               (4,684 bytes)
docs/agent-rules/testing-and-proof.md             (3,712 bytes)
docs/agent-rules/domain-rules/maintenance.md      (3,998 bytes)
docs/agent-rules/domain-rules/inventory.md        (3,555 bytes)
docs/agent-rules/domain-rules/production.md       (4,156 bytes)
docs/proofs/atsofterp-permanent-agent-rules-installation-report.md (this file)
```

## 5. Files Modified

```
AGENTS.md        (1 line added: No-Docker baseline statement)
opencode.json    (permission policy merged: dangerous → deny, side-effectful → ask)
```

## 6. Rule Structure

```
ATsofterp/
├── AGENTS.md
├── opencode.json
└── docs/
    ├── agent-rules/
    │   ├── architecture-and-tenancy.md
    │   ├── database-and-migrations.md
    │   ├── backend-and-security.md
    │   ├── frontend-and-ux.md
    │   ├── testing-and-proof.md
    │   └── domain-rules/
    │       ├── maintenance.md
    │       ├── inventory.md
    │       └── production.md
    └── proofs/
        └── atsofterp-permanent-agent-rules-installation-report.md
```

## 7. Summary of Each Rule File

| File | Contents |
|------|----------|
| `architecture-and-tenancy.md` | Modular-monolith preservation; direct company/branch ownership; active operational context (`x-active-company-id`/`x-active-branch-id`); separation of organizational structures; flexible hierarchies (no hard-coded factory shapes); tenant-safe relations, search, reports; cross-module integration; backward compatibility; cross-company test matrix |
| `database-and-migrations.md` | SQL Server only; permanent prohibition of `migrate reset`/`db push`/truncation/history deletion; phased migration strategy; backfill verification; Decimal money; transactions; index discipline; tenant-aware constraints; soft-delete consistency; audit fields; migration evidence; rollback planning |
| `backend-and-security.md` | Thin controllers; service business rules; DTO validation with unknown-field rejection; permission lifecycle; backend tenant enforcement; audit requirements; dedicated status-transition endpoints; localized error contracts; duplicate prevention; pagination; transactions; cross-company authorization tests |
| `frontend-and-ux.md` | App Router conventions; reuse of existing components (error dialog, toasts, F9 lookup, admin actions, entity components); `POST`/`PATCH /:id` edit-same-record; minimal-input auto-population; cascading selections; loading/empty/error/permission states; Arabic/English + RTL/LTR; accessibility; drawer portal z-index layering; no stale state; no raw keys/IDs |
| `testing-and-proof.md` | Focused-first validation order; mandatory test categories; tenant-isolation matrix; migration validation; create/edit/status runtime proof path; inventory/cost atomicity; i18n verification; build/typecheck; honest COMPLETE/PARTIAL/BLOCKED/NOT_VERIFIED reporting |
| `domain-rules/maintenance.md` | Preserve existing maintenance implementation; request/task/schedule/checklist/downtime/SLA/responsibility/required-part/stock-issue/installed-part/replacement/repair/BOM/preventive-plan integration; maintenance types; production-requested maintenance; part accountability; downtime ownership; return-to-production; expected-life tracking; cost ownership; no direct balance manipulation |
| `domain-rules/inventory.md` | Warehouses/locations; inventory documents; balances as derived transactional truth; no negative balances; source-document requirement; transactions and lock enforcement; spare-part warehouse restriction; issue/return/transfer/adjustment/receipt/count/reconciliation; part condition; installation/replacement; cost traceability; idempotency; no duplicate posting |
| `domain-rules/production.md` | Production does not yet exist as a complete domain; incremental vertical slices; reuse existing Company/Branch/ProductionLine/Machine/Product/Warehouse/CostCenter/Numbering/Audit/Search/Attachments/Notifications; shifts; orders; runs; capacity standards; approved measurement points; no double-counting sequential-machine output; waste/rework; downtime ownership; material consumption; finished-goods receipt; quality; maintenance; cost integration; OEE only after measurement rules are defined |

## 8. OpenCode Permission Policy

* **Automatically allowed**: reading project files except secrets; glob/text search; LSP inspection; read-only Git commands; `npm run build/typecheck/test/i18n`; `npx prisma validate`.
* **User approval required** (`ask`): file editing outside approved task scope (edit kept allowed — scope discipline enforced by AGENTS.md Section 5); package install/update; `prisma generate`; migration create/deploy; git commit; git push; any other bash command.
* **Permanently denied**: `prisma migrate reset`; `prisma db push`; `git reset --hard`; `git clean`; force push; `rm -rf`/`rmdir /s`/recursive forced `Remove-Item`; reading real `.env` secret files.

## 9. JSON Validation Result

`opencode.json` parsed successfully via `ConvertFrom-Json` — **valid JSON**. Schema field `permission` verified non-null. Permission object ordering verified (deny rules placed after broader allow/ask patterns so the last matching rule wins per opencode semantics).

## 10. Conflict Resolution

| Conflict | Resolution |
|----------|------------|
| Old opencode.json allowed `migrate reset`/`db push`/`reset --hard`/`clean`/force-push/recursive delete | Overridden by the new permanent policy: all permanently denied (matches AGENTS.md Section 11 and old AGENTS.md YAML prohibitions) |
| Old opencode.json allowed `git commit/push`, `npm install/update`, `prisma generate`, migrations | Changed to `ask` per "Require User Approval" policy |
| Old bash default `"*": "allow"` | Changed to `"*": "ask"` per "Commands with uncertain side effects" policy |
| AGENTS.md missing Docker statement | Merged: added the No-Docker baseline line to Project Identity (preserves the old AGENTS.md `docker: FORBIDDEN` rule in spirit) |
| `.env` deny vs `.env.example` allow | Kept unchanged (consistent with the task's secret-protection policy) |

## 11. Final Git Diff Summary

* `AGENTS.md` — 1 line added (No-Docker baseline) on top of the previously replaced permanent-instructions text (the large diff vs HEAD is the prior user-requested replacement of the old Arabic AGENTS.md, not this task).
* `opencode.json` — permission policy merged as described (untracked file, staged in working tree only).
* `docs/agent-rules/` — 8 new files (untracked).
* This report — new file (untracked).

## 12. Final Git Status

```
 M AGENTS.md
?? docs/agent-rules/
?? docs/proofs/atsofterp-current-architecture-discovery-report.md   ← pre-existing untracked, untouched
?? docs/proofs/atsofterp-permanent-agent-rules-installation-report.md
?? opencode.json
?? proof-token.txt                                                   ← pre-existing secret artifact, untouched
```

## 13. Confirmation: No Application or Database Files Changed

* No application code changed (no `apps/api` or `apps/web` source files modified).
* No database schema, migration, or Prisma file changed.
* No translation file changed.
* No test file changed.
* No package or lock file changed.
* No runtime configuration file changed.
* No secrets exposed (`.env` files were never read; `proof-token.txt` contents were not displayed).
* No build, typecheck, Prisma generation, or migration was run (governance-only task).

## 14. Commit Status

Not committed, not pushed — per task instructions. Awaiting user request.
