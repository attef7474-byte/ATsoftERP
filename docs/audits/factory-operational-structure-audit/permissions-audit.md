# Permissions Audit

> Date: 2026-07-23

---

## Existing Maintenance Permissions

| Module | Actions | Status |
|---|---|---|
| `machine` | create, read, update, delete | ✅ EXISTS |
| `machine-category` | create, read, update, delete | ✅ EXISTS |
| `machine-document` | create, read, update, delete | ✅ EXISTS |
| `machine-part` | create, read, update, delete | ✅ EXISTS |
| `maintenance-request` | create, read, update, delete, start, complete, assign, cancel, reopen, delete | ✅ EXISTS |
| `maintenance-task` | create, read, update, delete, complete, assign | ✅ EXISTS |
| `maintenance-schedule` | create, read, update, delete, execute | ✅ EXISTS |
| `maintenance-checklist` | create, read, update, delete | ✅ EXISTS |
| `downtime-log` | create, read, update, delete | ✅ EXISTS |

---

## Missing Permission Modules

| Permission Key | Actions Needed | Priority |
|---|---|---|
| `production-line` | create, read, update, delete | **HIGH** |
| `operation-type` | create, read, update, delete | **HIGH** |
| `cost-center` | create, read, update, delete | **HIGH** |
| `machine-component` | create, read, update, delete | **HIGH** |
| `spare-part` | create, read, update, delete | **HIGH** |
| `component-spare-part` | create, read, update, delete | **MEDIUM** |

---

## Subscription Limitations

- Modules must be registered in both free and premium subscription tiers
- Free tier limit of 5 modules may restrict how many factory modules can be added
- Spare part catalog likely falls under premium
- Production lines & cost centers may need premium allocation
