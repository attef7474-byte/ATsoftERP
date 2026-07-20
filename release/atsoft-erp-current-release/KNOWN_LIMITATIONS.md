# Known Limitations — ATsoft ERP Current Release

> Documented limitations from all accepted batches

## 1. PDF Export (Batch 33, 39)

Reports support browser print-to-PDF. No server-side PDF generation is claimed.

## 2. Flutter SDK (Batch 35)

Flutter source exists under `apps/mobile`. Flutter SDK was unavailable on the development machine. `flutter pub get` / `analyze` / `test` / `apk build` must be run on a Flutter-enabled workstation.

## 3. QA Mutation Testing (Batch 38)

Safe mutation tests were skipped because no separate QA sandbox was available. Read-only/API/security/browser checks passed.

## 4. Automated E2E (Batch 38)

No full automated E2E suite exists yet. Browser proof and QA regression were performed and documented manually.

## 5. Dev-Mode Console Noise (Batch 38)

Next.js dev-mode console noise may appear. No fatal approved-page browser errors were accepted.

## 6. Windows Local Runtime Only (Batch 27, 39)

The system is designed for Windows local deployment. No Docker, Linux, or cloud deployment is supported or documented.

## 7. SQL Server Only (Batch 24, 39)

The system uses SQL Server (WINCC instance, port 50079). No PostgreSQL or other databases are supported.

## 8. JWT in localStorage (Batch 38)

The web SPA stores the JWT access token in the browser's localStorage. This is the standard pattern for SPAs but means the token is accessible to JavaScript in the same origin.

## 9. Web Dev Server vs Production (Batch 40)

Health check may report Web unreachable if only the dev server is running. Production deployment requires `npm run build:web` followed by `npm start --workspace apps/web`.

## 10. Documentation-Only Release (Batch 39)

Batch 39 added no code changes, no new features, no database migrations, and no bug fixes. It was a documentation-only release.
