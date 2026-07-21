# Notification Unread-Count Fix Report

## Problem
GET /api/v1/notifications/unread-count returned raw number instead of { count }.
Frontend polling expected json.count or json.data.count.

## Fix
- Changed NotificationsController.unreadCount to return `{ count }`.
- Frontend polling hook already handles `json.count` fallback.

## Result
- Unread-count endpoint returns consistent object format.
- Badge shows actual unread count from database.
- No ERR_CONNECTION_REFUSED when API is running.
