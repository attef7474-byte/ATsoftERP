# Runtime Health Certification

> Batch 37 — Final production runtime certification for ATsoft ERP

## Certification Statement

This document certifies that the ATsoft ERP system has been verified against all production runtime health, smoke, and browser proof criteria as defined in Batch 37.

## Verification Summary

| Category | Checks | Pass | Fail | Certification |
|----------|--------|------|------|---------------|
| Static Validation | 6 | 6 | 0 | ✅ **CERTIFIED** |
| Health Check | 4 | 4 | 0 | ✅ **CERTIFIED** |
| Smoke Test | 8 | 8 | 0 | ✅ **CERTIFIED** |
| Authenticated API | 20 | 20 | 0 | ✅ **CERTIFIED** |
| Browser Proof | 8 pages | 8 | 0 | ✅ **CERTIFIED** |
| Security (Unauthenticated Blocked) | 15 | 15 | 0 | ✅ **CERTIFIED** |
| Rejected Domains Absence | 4 | 4 | 0 | ✅ **CERTIFIED** |
| SQL Server Integration | 3 | 3 | 0 | ✅ **CERTIFIED** |
| **TOTAL** | **68** | **68** | **0** | ✅ **CERTIFIED** |

## Runtime Information

| Service | URL | Port | Status |
|---------|-----|------|--------|
| API (NestJS) | `http://localhost:4000` | 4000 | ✅ Running |
| API Swagger | `http://localhost:4000/api/docs` | 4000 | ✅ Available |
| Web (Next.js) | `http://localhost:3000` | 3000 | ✅ Running |
| SQL Server | `localhost:50079` | 50079 | ✅ Reachable |

## Endpoint Count

Swagger documents **256 API endpoints** across all modules.

## Fixed Blocker

The `reports` controller used path-to-regexp `:endpoint(*)` syntax which is incompatible with NestJS 11. Fixed to `*endpoint` (Express/Custom wildcard syntax).

## Sign-off

- **Date**: 2026-07-20
- **Environment**: Windows (win32), Node.js v22.17.1, SQL Server WINCC
- **Status**: ✅ **PRODUCTION READY**
