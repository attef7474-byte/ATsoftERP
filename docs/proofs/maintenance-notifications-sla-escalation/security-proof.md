# Security Proof — Batch M

## Authentication
- JwtAuthGuard on all notification and SLA endpoints
- Token required for all notification operations
- Invalid token returns 401

## Authorization (Permissions)
- `notifications:dispatch` — POST /notifications/dispatch
- `notifications:read` — GET /notifications/inbox, GET /notifications/unread-count
- `notifications:mark-read` — PATCH /notifications/{id}/read, POST /notifications/mark-all-read
- `notifications:delete` — DELETE /notifications/{id}
- `maintenance-request:read` — GET /maintenance/sla/{id}, GET /maintenance/sla/stats/overview, GET /maintenance/sla/overdue/list
- `maintenance-request:update` — POST /maintenance/sla/{id}/calculate, POST /maintenance/sla/{id}/recalculate
- `maintenance.dashboard.slaOverdue.view` — GET /maintenance/dashboard/sla-overdue
- `maintenance.dashboard.slaEscalated.view` — GET /maintenance/dashboard/sla-escalated
- Insufficient permissions → 403 Forbidden

## Data Access
- Notification queries filter by userId from JWT token
- SLA queries use requestId parameter (no user-level restriction needed)
- No client-side authentication bypass possible
- All API calls use Bearer token in Authorization header

## Injection Prevention
- Prisma ORM parameterized queries — no SQL injection
- DTO validation with class-validator decorators
- Query parameters parsed with parseInt (safe numeric parsing)

## No Secrets Exposure
- No API keys, passwords, or secrets exposed in code
- JWT tokens handled via localStorage + Authorization header
- Environment variables for database connection string

## Audit Trail
- All maintenance request operations logged via AuditService
- Notification operations are self-auditing (read/unread timestamps)
