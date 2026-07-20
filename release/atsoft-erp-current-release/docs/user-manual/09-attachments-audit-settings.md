# Attachments, Audit, and Settings

> User Manual — Section 9

## Purpose

Manage file attachments, view audit logs, and configure system settings.

## Who Uses This

All users (attachments/audit), Administrators (settings).

## Attachments

### View Attachments

1. Navigate to **Attachments** in the sidebar
2. The list shows all uploaded files

### Features

- Files are linked to entities (products, machines, requests, etc.)
- Preview available for images and documents
- Download original files

**Note**: Upload requires the appropriate permission.

## Audit

### View Audit Logs

1. Navigate to **Audit** in the sidebar
2. The list shows all system activity with:
   - Timestamp
   - User
   - Action (create, update, delete, login, etc.)
   - Entity type and ID
   - Details

### Audit Summary

The summary view shows activity counts grouped by action type.

## Settings

### View Settings

1. Navigate to **Settings** in the sidebar
2. Settings are grouped by category: General, Security, Appearance, etc.

### Available Settings Groups

- General settings
- Security settings
- Appearance / Theme
- Company profile
- Language / Locale

**Note**: Some settings may return "not found" if not yet seeded in the database.

## Expected Result

- Attachments list shows uploaded files
- Audit log shows system activity
- Settings page shows configuration options

## Permissions Required

- Attachments: `attachments:read`
- Audit: `audit:read`
- Settings: `settings:read`

## Related API Routes

- `GET /api/v1/attachments`
- `GET /api/v1/audit-logs`
- `GET /api/v1/settings`
