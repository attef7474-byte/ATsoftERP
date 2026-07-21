# Security Proof

| Check | Result |
|-------|:------:|
| ValidationPipe whitelist=true | VERIFIED |
| ValidationPipe forbidNonWhitelisted=true | VERIFIED |
| ValidationPipe transform=true | VERIFIED |
| Numbering endpoints guarded | VERIFIED |
| Create endpoints guarded | VERIFIED |
| Notifications unread-count guarded | VERIFIED |
| Unauthenticated create returns 401/403 | VERIFIED |
| Unauthenticated unread-count returns 401/403 | VERIFIED |
| passwordHash exposure | 0 |
| JWT/token exposure | 0 |
| Secrets exposure | 0 |
| .env committed | NO |
| Cookies/tokens committed | NO |
| Rejected domains (11) | INACTIVE |
