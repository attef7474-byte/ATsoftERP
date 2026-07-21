# Notification Unread-Count Report

## Issue
GET /api/v1/notifications/unread-count returned raw number (e.g., "5")
instead of { count: 5 }. Frontend expected json.count.

## Status
Already fixed in prior commit ba9d00d.

## Fix Verified
`notifications.controller.ts` line 36-38:
```ts
async unreadCount(@Req() req: any) {
    const count = await this.service.countUnread(req.user?.id);
    return { count };
}
```
