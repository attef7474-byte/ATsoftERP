# Network Proof Report

## API Endpoints Tested

| Endpoint | Method | Status | Body (truncated) | Auth |
|---|---|---|---|---|
| /api/v1/auth/login | POST | 201 | `{ accessToken: "eyJ..." }` | Public |
| /api/v1/auth/me | GET | 200 | `{ email: "admin@atsofterp.com", id: "cmrl..." }` | Bearer |
| /api/v1/settings/appearance | PATCH | 400 | `{ message: ["property totallyInvalidField should not exist"] }` | Bearer |
| /api/v1/notifications/dispatch | POST | 201 | `{ id: "cmrt...", title: "QA Test Notification" }` | Bearer |
| /api/v1/numbering | GET | 200 | `{ data: [...], meta: {...} }` | Bearer |
| /api/v1/messaging/conversations | POST | 201 | `{ id: "cmrt...", title: "UI Verification Test" }` | Bearer |
| /api/v1/messaging/messages | POST | 201 | `{ id: "cmrt..." }` | Bearer |
| /api/v1/settings/appearance | PATCH | 200 | `{ themeMode: "light" }` | Bearer |

## Unauthenticated Access (Security)

| Endpoint | Status | Result |
|---|---|---|
| /api/v1/numbering | 401 | Protected |
| /api/v1/notifications/inbox | 401 | Protected |
| /api/v1/messaging/conversations | 401 | Protected |

## Secret/Stack Trace Exposure Check

| Check | PATCH Error Response | Result |
|---|---|---|
| JWT/token present | No | PASS |
| passwordHash present | No | PASS |
| Stack trace present | No | PASS |
| DATABASE_URL present | No | PASS |
