# Admin Guide — ATsoft ERP

> For system administrators responsible for installation, configuration, and maintenance

## Sections

| # | Section | Description |
|---|---------|-------------|
| 1 | Installation (Windows Local Runtime) | System requirements and first-time setup |
| 2 | API / Web Startup | How to start the backend and frontend |
| 3 | SQL Server Configuration | Database setup and connection |
| 4 | Users, Roles, Permissions | Managing access control |
| 5 | Security Model | Auth, guards, and best practices |
| 6 | Backup / Restore / Runtime Tools | Data protection and maintenance |
| 7 | Health / Smoke Checks | Monitoring system status |
| 8 | Troubleshooting | Common issues and solutions |

## Quick Commands

```powershell
# Start API
npm run start:dev --workspace apps/api

# Start Web
npm run dev --workspace apps/web

# Health check
powershell -ExecutionPolicy Bypass -File tools/health/health-check.ps1

# Smoke test
powershell -ExecutionPolicy Bypass -File tools/health/smoke-check.ps1
```

## URLs

| Service | URL |
|---------|-----|
| API | http://localhost:4000 |
| API (with prefix) | http://localhost:4000/api/v1 |
| Swagger Docs | http://localhost:4000/api/docs |
| Web App | http://localhost:3000 |

## SQL Server

| Parameter | Value |
|-----------|-------|
| Instance | WINCC |
| Port | 50079 |
| Database | ATsoftERP_DB |
