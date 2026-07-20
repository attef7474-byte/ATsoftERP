# API Endpoints Inventory

> Batch 36 Audit — All controller routes discovered in `apps/api/src/modules/`

**Legend**: 🔒 = Guarded (JWT + Permissions), 🔓 = Public (no auth)

---

## Auth
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| POST | `/auth/login` | 🔓 | — |
| POST | `/auth/refresh` | 🔓 | — |

## Dashboard
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/dashboard` | 🔒 | `dashboard:read` |
| GET | `/dashboard/stats` | 🔒 | `dashboard:read` |

## Access Control — Users
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/users` | 🔒 | `users:read` |
| POST | `/users` | 🔒 | `users:create` |
| GET | `/users/:id` | 🔒 | `users:read` |
| PATCH | `/users/:id` | 🔒 | `users:update` |
| DELETE | `/users/:id` | 🔒 | `users:delete` |

## Access Control — Roles
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/roles` | 🔒 | `roles:read` |
| POST | `/roles` | 🔒 | `roles:create` |
| GET | `/roles/:id` | 🔒 | `roles:read` |
| PATCH | `/roles/:id` | 🔒 | `roles:update` |
| DELETE | `/roles/:id` | 🔒 | `roles:delete` |

## Access Control — Permissions
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/permissions` | 🔒 | `permissions:read` |

## Companies
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/companies` | 🔒 | `companies:read` |
| POST | `/companies` | 🔒 | `companies:create` |
| GET | `/companies/:id` | 🔒 | `companies:read` |
| PATCH | `/companies/:id` | 🔒 | `companies:update` |
| DELETE | `/companies/:id` | 🔒 | `companies:delete` |

## Branches
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/branches` | 🔒 | `branches:read` |
| POST | `/branches` | 🔒 | `branches:create` |
| GET | `/branches/:id` | 🔒 | `branches:read` |
| PATCH | `/branches/:id` | 🔒 | `branches:update` |
| DELETE | `/branches/:id` | 🔒 | `branches:delete` |

## Departments
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/departments` | 🔒 | `departments:read` |
| POST | `/departments` | 🔒 | `departments:create` |
| GET | `/departments/:id` | 🔒 | `departments:read` |
| PATCH | `/departments/:id` | 🔒 | `departments:update` |
| DELETE | `/departments/:id` | 🔒 | `departments:delete` |

## Settings — Security
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/settings/security` | 🔒 | `settings:read` |
| PATCH | `/settings/security` | 🔒 | `settings:update` |

## Settings — Appearance
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/settings/appearance` | 🔒 | `settings:read` |
| PATCH | `/settings/appearance` | 🔒 | `settings:update` |

## Settings — Company Profile
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/settings/company-profile` | 🔒 | `settings:read` |
| PATCH | `/settings/company-profile` | 🔒 | `settings:update` |

## Settings — Language
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/settings/language` | 🔒 | `settings:read` |
| PATCH | `/settings/language` | 🔒 | `settings:update` |

## Settings — Notification Rules
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/notifications/rules` | 🔒 | `notifications:read` |
| POST | `/notifications/rules` | 🔒 | `notifications:create` |
| GET | `/notifications/rules/:id` | 🔒 | `notifications:read` |
| PATCH | `/notifications/rules/:id` | 🔒 | `notifications:update` |
| DELETE | `/notifications/rules/:id` | 🔒 | `notifications:delete` |

## Alerts
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/alerts` | 🔒 | `alerts:read` |
| GET | `/alerts/:id` | 🔒 | `alerts:read` |
| GET | `/alerts/unread/count` | 🔒 | `alerts:read` |

## Notifications
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/notifications` | 🔒 | `notifications:read` |
| PATCH | `/notifications/:id/read` | 🔒 | `notifications:update` |
| POST | `/notifications/read-all` | 🔒 | `notifications:update` |

## Audit
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/audit` | 🔒 | `audit:read` |
| GET | `/audit/:id` | 🔒 | `audit:read` |

## Attachments
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/attachments` | 🔒 | `attachments:read` |
| POST | `/attachments/upload` | 🔒 | `attachments:create` |
| GET | `/attachments/:id` | 🔒 | `attachments:read` |
| GET | `/attachments/:id/download` | 🔒 | `attachments:read` |
| PATCH | `/attachments/:id` | 🔒 | `attachments:update` |
| DELETE | `/attachments/:id` | 🔒 | `attachments:delete` |

## Warehouses
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/warehouses` | 🔒 | `warehouses:read` |
| POST | `/warehouses` | 🔒 | `warehouses:create` |
| GET | `/warehouses/:id` | 🔒 | `warehouses:read` |
| PATCH | `/warehouses/:id` | 🔒 | `warehouses:update` |
| DELETE | `/warehouses/:id` | 🔒 | `warehouses:delete` |

## Products
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/products` | 🔒 | `products:read` |
| POST | `/products` | 🔒 | `products:create` |
| GET | `/products/:id` | 🔒 | `products:read` |
| PATCH | `/products/:id` | 🔒 | `products:update` |
| DELETE | `/products/:id` | 🔒 | `products:delete` |

## Inventory — Counts
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/inventory/counts` | 🔒 | `inventory:read` |
| POST | `/inventory/counts` | 🔒 | `inventory:create` |
| GET | `/inventory/counts/:id` | 🔒 | `inventory:read` |
| PATCH | `/inventory/counts/:id` | 🔒 | `inventory:update` |
| DELETE | `/inventory/counts/:id` | 🔒 | `inventory:delete` |

## Inventory — Balances
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/inventory/balances` | 🔒 | `inventory:read` |
| GET | `/inventory/balances/:id` | 🔒 | `inventory:read` |

## Inventory — Movements
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/inventory/movements` | 🔒 | `inventory:read` |
| POST | `/inventory/movements` | 🔒 | `inventory:create` |
| GET | `/inventory/movements/:id` | 🔒 | `inventory:read` |
| PATCH | `/inventory/movements/:id` | 🔒 | `inventory:update` |

## Inventory — Adjustments
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/inventory/adjustments` | 🔒 | `inventory:read` |
| POST | `/inventory/adjustments` | 🔒 | `inventory:create` |
| GET | `/inventory/adjustments/:id` | 🔒 | `inventory:read` |
| PATCH | `/inventory/adjustments/:id` | 🔒 | `inventory:update` |

## Maintenance — Machines
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/machines` | 🔒 | `machines:read` |
| POST | `/machines` | 🔒 | `machines:create` |
| GET | `/machines/:id` | 🔒 | `machines:read` |
| PATCH | `/machines/:id` | 🔒 | `machines:update` |
| DELETE | `/machines/:id` | 🔒 | `machines:delete` |

## Maintenance — Requests
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/maintenance/requests` | 🔒 | `maintenance:read` |
| POST | `/maintenance/requests` | 🔒 | `maintenance:create` |
| GET | `/maintenance/requests/:id` | 🔒 | `maintenance:read` |
| PATCH | `/maintenance/requests/:id` | 🔒 | `maintenance:update` |
| DELETE | `/maintenance/requests/:id` | 🔒 | `maintenance:delete` |

## Maintenance — Tasks
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/maintenance/tasks` | 🔒 | `maintenance:read` |
| POST | `/maintenance/tasks` | 🔒 | `maintenance:create` |
| GET | `/maintenance/tasks/:id` | 🔒 | `maintenance:read` |
| PATCH | `/maintenance/tasks/:id` | 🔒 | `maintenance:update` |
| DELETE | `/maintenance/tasks/:id` | 🔒 | `maintenance:delete` |

## Maintenance — Schedules
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/maintenance/schedules` | 🔒 | `maintenance:read` |
| POST | `/maintenance/schedules` | 🔒 | `maintenance:create` |
| GET | `/maintenance/schedules/:id` | 🔒 | `maintenance:read` |
| PATCH | `/maintenance/schedules/:id` | 🔒 | `maintenance:update` |
| DELETE | `/maintenance/schedules/:id` | 🔒 | `maintenance:delete` |

## Maintenance — Downtime Logs
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/maintenance/downtime-logs` | 🔒 | `maintenance:read` |
| POST | `/maintenance/downtime-logs` | 🔒 | `maintenance:create` |
| GET | `/maintenance/downtime-logs/:id` | 🔒 | `maintenance:read` |
| PATCH | `/maintenance/downtime-logs/:id` | 🔒 | `maintenance:update` |
| DELETE | `/maintenance/downtime-logs/:id` | 🔒 | `maintenance:delete` |

## Maintenance — Parts
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/maintenance/parts` | 🔒 | `maintenance:read` |
| POST | `/maintenance/parts` | 🔒 | `maintenance:create` |
| GET | `/maintenance/parts/:id` | 🔒 | `maintenance:read` |
| PATCH | `/maintenance/parts/:id` | 🔒 | `maintenance:update` |
| DELETE | `/maintenance/parts/:id` | 🔒 | `maintenance:delete` |

## Maintenance — Documents
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/maintenance/documents` | 🔒 | `maintenance:read` |
| POST | `/maintenance/documents` | 🔒 | `maintenance:create` |
| GET | `/maintenance/documents/:id` | 🔒 | `maintenance:read` |
| PATCH | `/maintenance/documents/:id` | 🔒 | `maintenance:update` |
| DELETE | `/maintenance/documents/:id` | 🔒 | `maintenance:delete` |

## Barcodes
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/barcodes` | 🔒 | `barcodes:read` |
| POST | `/barcodes/generate` | 🔒 | `barcodes:create` |
| GET | `/barcodes/:id` | 🔒 | `barcodes:read` |

## Business Partners
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/business-partners` | 🔒 | `partners:read` |
| POST | `/business-partners` | 🔒 | `partners:create` |
| GET | `/business-partners/:id` | 🔒 | `partners:read` |
| PATCH | `/business-partners/:id` | 🔒 | `partners:update` |
| DELETE | `/business-partners/:id` | 🔒 | `partners:delete` |

## Numbering
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/numbering` | 🔒 | `numbering:read` |
| POST | `/numbering` | 🔒 | `numbering:create` |
| GET | `/numbering/:id` | 🔒 | `numbering:read` |
| PATCH | `/numbering/:id` | 🔒 | `numbering:update` |
| DELETE | `/numbering/:id` | 🔒 | `numbering:delete` |

## Search
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/search` | 🔒 | `search:read` |
| GET | `/search/recent` | 🔒 | `search:read` |

## Reports
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/reports` | 🔒 | `reports:read` |
| GET | `/reports/:type` | 🔒 | `reports:read` |

## System Health
| Method | Path | Guard | Permission |
|--------|------|-------|------------|
| GET | `/health` | 🔒 | `system:read` |
