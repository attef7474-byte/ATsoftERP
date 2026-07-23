# Migration Proof — Batch D Machine Components

## Migration: 20260723123029_add_machine_components

### Changes
1. Created `machine_components` table
2. Added `components` relation to `Machine` model

### Table Structure
- `id` — varchar(30) primary key
- `machineId` — varchar(30), NOT NULL, FK → machines(id)
- `parentComponentId` — varchar(30), nullable, FK → machine_components(id)
- `code` — varchar(191), NOT NULL
- `name` — varchar(191), NOT NULL
- `componentType` — enum(MECHANICAL, ELECTRICAL, CONTROL, PNEUMATIC, HYDRAULIC, HEATING, COOLING, SENSOR, SAFETY, CONVEYOR, FRAME, UTILITY, OTHER), NOT NULL
- `description` — text, nullable
- `locationInMachine` — varchar(191), nullable
- `manufacturer` — varchar(191), nullable
- `model` — varchar(191), nullable
- `serialNumber` — varchar(191), nullable
- `criticality` — enum(LOW, MEDIUM, HIGH, CRITICAL), default MEDIUM
- `status` — varchar(191), default 'ACTIVE'
- `createdAt` — datetime(3), NOT NULL
- `updatedAt` — datetime(3), NOT NULL
- `deletedAt` — datetime(3), nullable

### Constraints
- UNIQUE(machineId, code)
- FK machineId → machines(id)
- FK parentComponentId → machine_components(id) ON DELETE SET NULL

### Indexes
- machineId, parentComponentId, status, deletedAt, componentType

### Safety
- All new columns are either NOT NULL with defaults or nullable
- No existing data affected
- Rollback: DROP TABLE machine_components, remove relation from Machine
