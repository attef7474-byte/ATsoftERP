# 01 — Scope and Rules

## Batch Scope

Per AGENTS.md priority plan: **DX-0 — API Module Registry + Frontend Route Alignment**

### In Scope
- Audit all modules in `app.module.ts` — verify 71 registered count
- Scan all frontend API calls for path bugs (missing leading `/`)
- Scan navigation/sidebar for routes pointing to unregistered or forbidden modules
- Create alignment decision matrix
- Fix any safe, non-registration bugs (path fixes)
- Document found issues

### Explicitly Not In Scope
- Registering new modules in `app.module.ts`
- Changing Prisma schema or running migrations
- Adding i18n keys
- Changing permissions or audit configuration
- Starting modules that are READY_TO_REGISTER
- Activating forbidden modules (Finance, Sales, Purchasing, HR, AI, IoT, BI, Workflows, etc.)
- Removing or reorganizing sidebar items
- Creating new API endpoints

## Rules Enforced
- Module Activation Policy: No module registered without all prerequisites
- Frontend/API Route Alignment Rules: All 97 sidebar entries verified against registered modules
- No forbidden module activation: Verified zero sidebar links to forbidden modules
- No mock/placeholder: Not applicable (no new pages created)
- AGENTS.md global rules: All followed
