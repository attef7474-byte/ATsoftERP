# Security Validation

## Global ValidationPipe (in apps/api/src/main.ts)
- whitelist: true ✓
- forbidNonWhitelisted: true ✓
- transform: true ✓ (implied by ValidationPipe default)

## Unauthenticated Mutation Tests
All endpoints reject unauthenticated requests with 401:
- PATCH /settings/company-profile → 401
- PATCH /settings/language → 401
- PATCH /settings/appearance → 401
- PATCH /settings/security → 401
- PATCH /numbering/:id → 401
- PATCH /notifications/rules/:id → 401
- POST /notifications/rules → 401
- DELETE /notifications/rules/:id → 401
- GET /audit-logs → 401

## Sensitive Data Exposure
Audit log response checked for:
- passwordHash: NOT FOUND ✓
- password: NOT FOUND ✓
- secret: NOT FOUND ✓
- JWT/token: NOT FOUND ✓
- DATABASE_URL: NOT FOUND ✓

## .env File
- Only .env.example is tracked in git
- Actual .env is in .gitignore (not committed)

## Rejected Domains
The following domains remain inactive (not wired in the application):
- Sales
- Purchasing
- Finance
- HR
- AI
- IoT
- BI
- Forecasting
- Workflows
- Import/Export Designer
- Print Template Designer

## Invalid Payload Rejection
All PATCH endpoints return 400 for extra unknown fields:
- `{ "totallyInvalidField": "should fail" }` → 400 Bad Request with message "property totallyInvalidField should not exist"
