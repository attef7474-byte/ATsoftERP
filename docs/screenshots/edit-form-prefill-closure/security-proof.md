# Security Proof

- Edit endpoints guarded: All controllers use JwtAuthGuard and PermissionsGuard
- Unauthorized edit returns 401/403: Guard decorators enforce
- passwordHash never exposed: User detail endpoint explicitly excludes passwordHash via `select`
- JWT/token not exposed: No token handling in edit form flow
- Secrets not exposed: API layer strips sensitive data
- Stack traces not exposed: NestJS production mode
- Rejected domains inactive: Sales, Purchasing, Finance, HR, AI, IoT, BI, Forecasting workflows remain untouched
- No .env/cookies/tokens committed: .env in .gitignore
