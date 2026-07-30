# Before / After Menu Structure

## Before (v8 flat list)

```
Dashboard (direct link)
Core → Companies, Branches, Administrations, Departments
Access Control → Users, Roles, Permissions
Inventory → Warehouses, Locations, Product Categories, Products, ...
Maintenance (flat) → Machine Categories, Machines, Machine Parts, ...
Barcode (flat) → Generate, Print, Scan, ...
Reports (flat) → Maintenance Reports, Inventory Reports, ...
Settings (flat) → Settings, Company Profile, Language, ...
Documents → Attachments
Notifications (direct)
Messaging (direct)
Search (direct)
Alerts (direct)
```

## After (v9 hierarchical 10-group)

```
1. Dashboard — direct link

2. Organization
   ─ Organization Structure
     Companies, Branches, Administrations, Departments
   ─ Operational Data
     Production Lines, Operation Types, Cost Centers

3. Access Control
   ─ Users & Permissions
     Users, Roles, Permissions

4. Assets & Equipment
   ─ Assets
     Machines, Machine Categories, Machine Documents
   ─ Technical Structure
     Machine Components, Machine Parts

5. Maintenance
   ─ Operations
     Requests, Tasks, Schedules, Checklist Items, Downtime Logs
   ─ Planning
     Calendar, Workload, SLA, MTTR
   ─ Staff
     Personnel, Machine Responsibilities, Accountability
   ─ Spare Parts
     Spare Parts, Conditions, Installed Parts, Repair Orders, BOM, Plans

6. Inventory
   ─ Definitions
     Warehouses, Locations, Product Categories, Products
   ─ Operations
     Opening Balances, Movements, Counts, Adjustments, Stock Adjustments, Locks
   ─ Monitoring
     Balances, Ledger, Reconciliation, Governance Audit

7. Barcode
   ─ Operations
     Overview, Generate, Print, Scan, Preview
   ─ Administration
     Records, Templates, Product Labels, Machine Cards, Scans, Print Jobs

8. Reports & Analytics
   ─ Main
     Reports Home
   ─ Maintenance Reports
     Overview, KPIs, Requests, Downtime, Costs, Schedules, ...
   ─ Inventory Reports
     Overview, Balances, Movements, Adjustments, Count Variance
   ─ Barcode Reports
     Barcode Scans
   ─ System Reports
     Audit, User Activity, Notifications, Attachments, Partners

9. Documents
   Attachments (flat items)

10. System
    ─ Settings
      Settings, Company Profile, Language, Appearance, Security, Numbering, Notification Rules
    ─ Logs
      Audit Log, User Activity, Login History
    ─ Communication
      Notifications, Messaging
```

## Key Organizational Changes

1. **Production Lines, Operation Types, Cost Centers** moved from Maintenance → Organization (Operational Data)
2. **Machine Components** extracted from flat Machine Parts into dedicated section under Assets
3. **Spare Parts** section under Maintenance consolidated from scattered links
4. **Barcode** given full section structure (operations + admin)
5. **Reports** organized by domain (maintenance, inventory, barcode, system)
6. **System** grouped into Settings, Logs, Communication
7. **Notifications, Messaging, Search, Alerts** moved under System or grouped with related items
