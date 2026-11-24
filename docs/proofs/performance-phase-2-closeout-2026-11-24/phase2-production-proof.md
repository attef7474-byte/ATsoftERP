# Phase 2 Production Proof

## Deployment
- Main SHA: `1a74a54986535f474eb2ddaafbae087574192604` (origin/main == HEAD).
- Release dir: `C:\ATsoftERP\App\perf-phase2-1a74a549`.
- NSSM: `ATsoftERP_API` AppDirectory -> `...\perf-phase2-1a74a549pi`, `ATsoftERP_Web` -> `...\perf-phase2-1a74a549\web`; both restarted successfully.
- `current` symlink repointed to `C:\ATsoftERP\App\perf-phase2-1a74a549`.
- `DEPLOYED_RUNTIME_CODE_SHA == PERFORMANCE_PHASE_2_MAIN_COMMIT`: PASS (release-manifest + NSSM paths + restarted services).

## Health / Connectivity
- `API_HEALTH=PASS` (`http://localhost:4000/api/v1/health` status ok).
- `WEB_HEALTH=PASS` (`http://localhost:3000/login` 200).
- `DATABASE_CONNECTIVITY=PASS` (API health ok; read-only SQL Server checks succeeded).
- `PROXY_HEALTH=PASS` (configured hostname `DELL` verified from `C:\ATsoftERP\Config\Caddyfile`: `tls internal`, `/api/* -> localhost:4000`, fallback `-> localhost:3000`; `ATsoftERP_Caddy` Running; 443 LISTEN pid 8608 caddy.exe; cert SAN DNS Name=dell, issuer Caddy Local Authority - ECC Intermediate. `curl.exe --ssl-no-revoke https://DELL/api/v1/health`=200, `https://DELL/login`=200. Browser proof through `https://dell/...` (not localhost:3000): `/admin/performance/kpis` and `/admin/performance/kpi-coverage` loaded, `/api/v1/health` via proxy 200, console errors 0, page errors 0, unexpected 5xx 0, failed required network calls 0, failed chunks 0, `/production/operational-people` seen, `/core/operational-people` requests 0. Previous `https://localhost` PS5.1 schannel revocation/TLS error classified as `NON_BLOCKING_PROOF_CLIENT/HOSTNAME_LIMITATION`; no proxy/service fault).

## Production DB migration
- Backup: `C:\ATsoftERP\Backups\ATsoftERP_DB_pre_phase2_20261124_034358.bak` COPY_ONLY+CHECKSUM PASS; RESTORE VERIFYONLY PASS.
- Phase 2 migration `20261124090000_add_performance_kpi_library_phase2` applied once via `sqlcmd -E -C -I -b`; checksum `a15e8ae896794506c7ebdbf6516d4cbb1cd9938f681c882a0eab02aa63567619`; ledger APPLIED.
- Post-migration counts unchanged: OperationalPerson=86, MaintenanceRequest=22, ProductionRun=4, DowntimeLog=5, InventoryMovement=125, InventoryBalance=24. `PRODUCTION_PHASE2_MIGRATION=PASS`.

## Production API proof (read-only)
- `GET /api/v1/performance/kpis?limit=5` -> 200, count 0.
- `GET /api/v1/performance/kpis/coverage?...` -> 200, items 0.
- `GET /api/v1/performance/profiles?limit=5` -> 200, count 0.
- `GET /api/v1/production/operational-people?limit=1` -> 200. PASS.

## Production browser proof (read-only, Playwright, localhost:3000)
- Pages: `/admin/performance/kpis`, `/admin/performance/kpi-coverage`, `/admin/performance/profiles` loaded.
- `PRODUCTION_OBSOLETE_CORE_OPERATIONAL_PEOPLE_REQUESTS=0`: PASS (no /core/operational-people requests observed).
- `/production/operational-people` request observed: PASS.
- No-score UI, no console errors, no page errors, no unexpected HTTP 4xx/5xx, no failed chunks: PASS.
- Arabic visible + RTL dir=rtl + no raw keys: PASS.
- Artifacts: `docs/proofs/performance-phase-2-closeout-2026-11-24/prod-browser-proof/`.

## Security
- No secrets printed or committed. Temp proof token/script removed after use. `PRODUCTION_WRITE_OCCURRED=NO` beyond approved migration.
