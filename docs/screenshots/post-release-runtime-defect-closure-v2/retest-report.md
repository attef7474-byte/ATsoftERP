# Retest Report

## Settings Appearance
| Test | Result |
|------|--------|
| GET /api/v1/settings/appearance | 200 OK |
| PATCH with valid mapped payload `{themeMode:"light",accentColor:"#3b82f6",compactMode:false}` | 200 OK |
| PATCH with invalid extra field `{totallyInvalidField:"should fail"}` | 400 OK |
| GET verifies saved value | 200 OK |

## Settings Language
| Test | Result |
|------|--------|
| GET /api/v1/settings/language | 200 OK |
| PATCH with `{defaultLocale:"en"}` | 200 OK |
| PATCH with old field name `{defaultLanguage:"en"}` | 400 OK (validation intact) |

## Settings Company Profile
| Test | Result |
|------|--------|
| GET /api/v1/settings/company-profile | 200 OK |
| PATCH with valid fields (no extra) | 200 OK |

## Notification Rules
| Test | Result |
|------|--------|
| GET /api/v1/notifications/rules?page=1&pageSize=20 | 200 OK |
| Unauthenticated request | 401 OK |

## Audit User Activity
| Test | Result |
|------|--------|
| GET /api/v1/audit-logs/user-activity?page=1&limit=20 | 200 OK (40 total entries) |
| Unauthenticated request | 401 OK |

## Audit Login History
| Test | Result |
|------|--------|
| GET /api/v1/audit-logs/login-history?page=1&limit=20 | 200 OK (empty data) |
| Unauthenticated request | 401 OK |

## i18n/common Fatal Error
| Test | Result |
|------|--------|
| Guard added for undefined localeData | `t()` returns key instead of crashing |
| Build web | Next.js compiled successfully |

## Legacy URL (should still 404 — frontend no longer calls)
| Test | Result |
|------|--------|
| GET /api/v1/settings/notification-rules | 404 "System setting not found" (expected) |
