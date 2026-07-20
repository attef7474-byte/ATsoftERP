# Current Release Known Limitations

> Batch 39 — Honest documentation of all known limitations

## Runtime Limitations

1. **Windows local runtime only** — The system is designed for Windows local deployment. No Docker, Linux, or cloud deployment is supported.
2. **SQL Server only** — The system uses SQL Server (WINCC instance, port 50079). No PostgreSQL or other databases are supported.
3. **Node.js v22.17.1 required** — Older versions may not work correctly.

## QA & Testing Limitations

4. **No isolated QA test environment** — All QA runs against the live SQL Server database. Mutation (create/update/delete) testing was skipped to avoid data corruption.
5. **No automated E2E test suite** — All regression testing was performed manually via scripts (PowerShell for API, Playwright for browser).
6. **Next.js dev-mode console noise** — In development mode, the browser console shows HMR WebSocket and chunk-loading 404s. These do not appear in production mode (`npm run build:web` followed by `npm run start`).

## Feature Limitations

7. **PDF is browser print-to-PDF** — The system does not generate server-side PDF files. The print feature opens the browser's print dialog; users must select "Save as PDF" manually.
8. **Mobile APK not validated** — Flutter source code exists but the Flutter SDK is not available on this workstation. `flutter pub get`, `flutter analyze`, `flutter test`, and `flutter build` have not been run locally.
9. **Settings require seed data** — Some settings endpoints return 404 ("System setting not found") because the corresponding settings records have not been seeded in the database.

## Security Limitations

10. **JWT stored in localStorage** — The web SPA stores the JWT access token in the browser's localStorage. This is the standard pattern for SPAs but means the token is accessible to JavaScript in the same origin.
11. **No two-factor authentication** — 2FA is not implemented in the current release.

## Documentation Limitations

12. **Mutation testing not performed** — All QA notes reflect that mutation tests were skipped. No claims of mutation test coverage are made.
