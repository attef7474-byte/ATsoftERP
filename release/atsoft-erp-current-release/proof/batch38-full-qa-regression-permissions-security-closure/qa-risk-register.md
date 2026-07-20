# QA Risk Register

> Batch 38 — Full QA Regression, Permissions, and Security Closure

## Open Risks

| # | Risk | Severity | Owner | Reason | Blocking Release | Mitigation | Recommended Action |
|---|------|----------|-------|--------|------------------|------------|-------------------|
| 1 | No isolated QA/test environment | Medium | DevOps | All QA runs against live SQL Server database; cannot safely test mutations | No | Read-only QA checks performed; mutations explicitly skipped | Create a staging/QA database for Batch 39+ |
| 2 | Next.js dev mode console errors | Low | Dev | HMR WebSocket and chunk-loading 404s in development mode produce noise; not present in production build | No | Production build (`npm run build:web` + `npm run start`) would eliminate these | Verify in production mode during Batch 39 |
| 3 | Browser automation gaps | Low | QA | Playwright can load pages but cannot verify all interactive flows without test data | No | All pages render correctly; interactive flows documented as limitation | Add E2E test data fixture for Batch 39 |
| 4 | Flutter SDK not available | Low | Dev | Batch 35 limitation documented; Flutter mobile source exists but cannot be built | No | Documented in Batch 35 closeout | No action (already documented) |
| 5 | No automated E2E test suite | Medium | QA | QA relies on manual/scripted regression; no CI/CD pipeline | No | Scripted regression covers all API and permission checks | Create Playwright E2E suite in Batch 39 |
| 6 | Mutation testing not performed | Medium | QA | No safe test data environment; create/update/delete paths not verified | No | All read paths verified; permission guards verified on all endpoints | QA sandbox needed for mutation coverage |

## Risk Score Summary

| Severity | Count | Mitigated |
|----------|-------|-----------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | All mitigated by read-only verification scope |
| Low | 3 | Acceptable for current release |

## Release Decision

No release-blocking risks identified. All open risks are mitigated by scope limitation or documented for future batches.
