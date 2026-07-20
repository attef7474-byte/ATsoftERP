# Login and Navigation

> User Manual — Section 1

## Purpose

How to log in to ATsoft ERP and navigate the main interface.

## Who Uses This

All users.

## Steps

### Login

1. Open your browser and go to http://localhost:3000
2. You will see the login page with email and password fields
3. Enter your email address (e.g., admin@atsofterp.com)
4. Enter your password
5. Click **Sign In** or press Enter
6. If credentials are correct, you are taken to the Dashboard

### Login Error

- If you see "Invalid credentials", check your email and password
- If you see a blank page, contact your admin (port or server issue)

### Main Navigation

After login, you see:

- **Top bar**: User menu, language switch, notifications bell, search (F9)
- **Sidebar**: Links to all available modules
- **Main content area**: Shows the current page

### Sidebar Sections

- Dashboard
- Alerts
- Notifications
- Settings
- Audit
- Attachments
- Companies / Branches / Departments
- Warehouses / Locations
- Products / Product Categories
- Inventory (Balances, Movements, Counts, Adjustments)
- Maintenance (Dashboard, Machines, Parts, Documents, Requests, Tasks, Preventive, Downtime)
- Barcodes / QR
- Reports
- Search
- Users / Roles / Permissions (admin only)

### Language Switch

Click the language icon in the top bar to toggle between English and Arabic (RTL).

## Expected Result

You should see the Dashboard with summary cards after login.

## Permissions Required

- Login: None (public endpoint)
- Access to specific modules: Depends on your role

## Related Pages

- Dashboard: `/dashboard`
- User profile: `/auth/me` (API)
