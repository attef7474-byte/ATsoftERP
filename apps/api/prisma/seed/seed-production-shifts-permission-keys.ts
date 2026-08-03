export const PRODUCTION_SHIFTS_EXTRA_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // production-shift (Phase 1.2 shift & assignments)
  { key: "production-shift:create", module: "production-shift", action: "create" },
  { key: "production-shift:read", module: "production-shift", action: "read" },
  { key: "production-shift:update", module: "production-shift", action: "update" },
  { key: "production-shift:delete", module: "production-shift", action: "delete" },
  { key: "production-shift:activate", module: "production-shift", action: "activate" },
  { key: "production-shift:deactivate", module: "production-shift", action: "deactivate" },
  // production-shift-template
  { key: "production-shift-template:create", module: "production-shift-template", action: "create" },
  { key: "production-shift-template:read", module: "production-shift-template", action: "read" },
  { key: "production-shift-template:update", module: "production-shift-template", action: "update" },
  { key: "production-shift-template:delete", module: "production-shift-template", action: "delete" },
  { key: "production-shift-template:activate", module: "production-shift-template", action: "activate" },
  { key: "production-shift-template:deactivate", module: "production-shift-template", action: "deactivate" },
  // production-shift-calendar
  { key: "production-shift-calendar:create", module: "production-shift-calendar", action: "create" },
  { key: "production-shift-calendar:read", module: "production-shift-calendar", action: "read" },
  { key: "production-shift-calendar:update", module: "production-shift-calendar", action: "update" },
  { key: "production-shift-calendar:delete", module: "production-shift-calendar", action: "delete" },
  { key: "production-shift-calendar:activate", module: "production-shift-calendar", action: "activate" },
  { key: "production-shift-calendar:deactivate", module: "production-shift-calendar", action: "deactivate" },
  // production-shift-assignment
  { key: "production-shift-assignment:create", module: "production-shift-assignment", action: "create" },
  { key: "production-shift-assignment:read", module: "production-shift-assignment", action: "read" },
  { key: "production-shift-assignment:update", module: "production-shift-assignment", action: "update" },
  { key: "production-shift-assignment:delete", module: "production-shift-assignment", action: "delete" },
  { key: "production-shift-assignment:activate", module: "production-shift-assignment", action: "activate" },
  { key: "production-shift-assignment:deactivate", module: "production-shift-assignment", action: "deactivate" },
  // production-operational-assignment
  { key: "production-operational-assignment:create", module: "production-operational-assignment", action: "create" },
  { key: "production-operational-assignment:read", module: "production-operational-assignment", action: "read" },
  { key: "production-operational-assignment:update", module: "production-operational-assignment", action: "update" },
  { key: "production-operational-assignment:delete", module: "production-operational-assignment", action: "delete" },
  { key: "production-operational-assignment:activate", module: "production-operational-assignment", action: "activate" },
  { key: "production-operational-assignment:deactivate", module: "production-operational-assignment", action: "deactivate" },
];
