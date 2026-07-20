# Dashboard, Alerts, and Notifications

> User Manual — Section 2

## Dashboard

The Dashboard shows a summary of key metrics:

- **Summary cards**: Total machines, active requests, inventory counts, etc.
- **KPIs**: Key performance indicators
- **Operations**: Recent operational data

### How to Use

1. Navigate to Dashboard from the sidebar
2. View summary cards at the top
3. Scroll to see KPIs and operations sections
4. Cards auto-refresh; use the refresh button if available

## Alerts

Alerts are time-sensitive system messages.

### View Alerts

1. Click **Alerts** in the sidebar
2. You see a list of alerts with severity, message, and timestamp
3. Use filters to narrow by severity or date range

### Alert Summary

The summary view shows alert counts grouped by severity.

## Notifications

Notifications are user-specific messages.

### Viewing Notifications

1. Click the bell icon in the top bar, or
2. Navigate to Notifications from the sidebar

### Notification Features

- **Inbox**: All your notifications
- **Unread count**: Shows on the bell icon
- **Mark as read**: Click a notification to mark it read
- **Mark all read**: Use the button to clear all

## Expected Result

- Dashboard loads with real data from the API
- Alerts show system-generated entries
- Notifications show user-specific messages

## Permissions Required

- Dashboard: `dashboard:read`
- Alerts: `alerts:read`
- Notifications: `notifications:read`

## Related API Routes

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/alerts`
- `GET /api/v1/notifications/inbox`
