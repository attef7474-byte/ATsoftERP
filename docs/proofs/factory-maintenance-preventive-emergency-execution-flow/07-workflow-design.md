# Workflow Design: Preventive & Emergency Maintenance Execution

## Status Transition Diagram

### Maintenance Request
```
OPEN ──assign──> ASSIGNED (via assignedToId)
  │
  ├──start──> IN_PROGRESS
  │              │
  │              ├──complete──> COMPLETED ──close──> CLOSED
  │              │                  │
  │              │                  └──reopen──> OPEN
  │              │
  │              └──cancel──> CANCELLED ──reopen──> OPEN
  │
  └──cancel──> CANCELLED ──reopen──> OPEN
```

### Maintenance Task
```
PENDING ──start──> IN_PROGRESS ──complete──> DONE
  │                       │
  └──cancel──> CANCELLED  └──cancel──> CANCELLED
```

### Schedule
```
ACTIVE ──generate──> (creates OPEN request + updates nextDueDate)
ACTIVE ──execute──> (creates IN_PROGRESS checklist execution)
ACTIVE ──deactivate──> INACTIVE
INACTIVE ──activate──> ACTIVE
```

### Checklist Execution
```
IN_PROGRESS
  │
  ├──update items (OK / NOT_OK / NA / Notes)
  │
  └──complete──> COMPLETED (only when all items done)
```

## Transition Rules
- Invalid transitions return **400 BadRequest** with descriptive message
- Duplicate generation returns **409 Conflict**
- Unauthorized access returns **401 Unauthorized**
- Insufficient permissions return **403 Forbidden**
- Completing checklist with pending items returns **400 BadRequest**

## Key Permissions
| Permission | Action |
|---|---|
| `maintenance-schedule:generateRequest` | Schedule → Generate Request |
| `maintenance-request:createEmergency` | Create Emergency Request |
| `maintenance-request:start` | Start Request |
| `maintenance-request:complete` | Complete Request |
| `maintenance-request:close` | Close Request |
| `maintenance-request:cancel` | Cancel Request |
| `maintenance-request:reopen` | Reopen Request |
| `maintenance-request:assign` | Assign Request |
| `maintenance-task:start` | Start Task |
| `maintenance-task:complete` | Complete Task |
| `maintenance-task:cancel` | Cancel Task |
| `maintenance-task:assign` | Assign Task |
| `maintenance-checklist-execution:complete` | Complete Checklist |
| `maintenance-checklist-execution:update` | Update Checklist Item |
