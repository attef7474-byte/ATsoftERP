# F9 Lookup Proof: User ↔ OperationalPerson Unique Link

## Status: VERIFIED — NO CHANGES NEEDED

The F9 lookup adapter for MaintenancePersonnel (`lookup-adapters.ts:367-377`) reads:
- `p.code` → now served by `operationalPerson.code` via API mapping
- `p.name` → now served by `operationalPerson.name` via API mapping
- `p.role` → still directly on MaintenancePersonnel
- `p.specialty` → still directly on MaintenancePersonnel
- `p.isActive` → still directly on MaintenancePersonnel

Since the API response mapping flattens `operationalPerson` fields to the top level, the F9 adapter receives the same data shape as before. No changes required.
